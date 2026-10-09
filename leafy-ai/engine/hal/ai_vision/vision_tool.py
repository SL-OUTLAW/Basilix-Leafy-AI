import asyncio
import logging
import os
from copy import deepcopy
from typing import Any

from psycopg.types.json import Jsonb

from engine.hal.ai_vision.detector import MODEL_NAME, VisionError, analyse_image
from engine.logger.logger import audit_log
from engine.managers.db_manager import get_connection, run_query
from engine.managers.settings_manager import settings

logger = logging.getLogger(__name__)
MAX_IMAGE_ATTEMPTS = 3
DEFAULT_BATCH_SIZE = 4
MAX_BATCH_SIZE = 20


class VisionAnalysis:
    def __init__(self):
        self.loop = False
        self.latest_analysis: dict[str, Any] | None = None

    async def get_latest_unanalysed_images(self) -> list[dict[str, Any]]:

        raw_batch = os.getenv("GEMINI_VISION_BATCH_SIZE", str(DEFAULT_BATCH_SIZE))
        try:
            batch_size = int(raw_batch)
        except (TypeError, ValueError):
            batch_size = DEFAULT_BATCH_SIZE
        batch_size = max(1, min(MAX_BATCH_SIZE, batch_size))

        rows = await run_query(
            """
            SELECT
                pi.image_id, c.camera_id, c.camera_name, c.level_no,
                pi.image_path, pi.captured_at
            FROM plant_images pi
            JOIN cameras c ON c.camera_id = pi.camera_id
            LEFT JOIN vision_analysis_jobs job ON job.image_id = pi.image_id
            WHERE c.status = 'ACTIVE'
              AND NOT EXISTS (
                  SELECT 1
                  FROM plant_image_analysis pia
                  WHERE pia.image_id = pi.image_id
                    AND pia.model_name = %s
              )
              AND (
                  job.image_id IS NULL
                  OR job.status = 'PENDING'
                  OR (
                      job.status = 'FAILED'
                      AND job.attempts < %s
                      AND job.next_attempt_at <= NOW()
                  )
              )
            ORDER BY pi.captured_at ASC, pi.image_id ASC
            LIMIT %s;
            """,
            (MODEL_NAME, MAX_IMAGE_ATTEMPTS, batch_size),
        )
        return [
            {
                "image_id": row[0],
                "camera_id": row[1],
                "camera_name": row[2],
                "level_no": row[3],
                "image_path": row[4],
                "captured_at": row[5].isoformat() if row[5] else None,
            }
            for row in rows
        ]

    async def _claim(self, image_id: int) -> bool:
        rows = await run_query(
            """
            INSERT INTO vision_analysis_jobs (
                image_id, status, attempts, next_attempt_at, updated_at
            ) VALUES (%s, 'PROCESSING', 1, NOW(), NOW())
            ON CONFLICT (image_id) DO UPDATE SET
                status = 'PROCESSING',
                attempts = vision_analysis_jobs.attempts + 1,
                updated_at = NOW(),
                last_error = NULL
            WHERE (
                    vision_analysis_jobs.status = 'PENDING'
                    OR (
                        vision_analysis_jobs.status = 'FAILED'
                        AND vision_analysis_jobs.next_attempt_at <= NOW()
                    )
                  )
              AND vision_analysis_jobs.attempts < %s
            RETURNING image_id;
            """,
            (image_id, MAX_IMAGE_ATTEMPTS),
        )
        return bool(rows)

    async def analyse_image(self, image: dict[str, Any]) -> dict[str, Any]:
        image_id = image["image_id"]
        if not await self._claim(image_id):
            return {"status": "skipped", "image_id": image_id}

        try:
            assessment = await analyse_image(image["image_path"])
            assessment.update(
                {
                    "image_id": image_id,
                    "camera": image["camera_name"],
                    "camera_id": image["camera_id"],
                    "level_no": image["level_no"],
                }
            )

            async with get_connection() as conn:
                async with conn.transaction():
                    rows = await run_query(
                        """
                        INSERT INTO plant_image_analysis (
                            image_id, model_name, analysis
                        ) VALUES (%s, %s, %s)
                        ON CONFLICT (image_id, model_name) DO NOTHING
                        RETURNING analysis_id, created_at;
                        """,
                        (image_id, MODEL_NAME, Jsonb(assessment)),
                        conn=conn,
                    )
                    if not rows:
                        raise VisionError(
                            "Analysis already exists for this image and model"
                        )
                    analysis_id, created_at = rows[0]
                    await run_query(
                        """
                        UPDATE vision_analysis_jobs
                        SET status = 'SUCCEEDED', updated_at = NOW(),
                            next_attempt_at = NOW(), last_error = NULL
                        WHERE image_id = %s;
                        """,
                        (image_id,),
                        conn=conn,
                    )
                    await audit_log(
                        conn=conn,
                        action_type="VISION_ANALYSIS_COMPLETED",
                        entity_type="plant_image_analysis",
                        entity_id=analysis_id,
                        description="Gemini vision assessment stored.",
                        metadata={
                            "image_id": image_id,
                            "camera_id": image["camera_id"],
                            "model": MODEL_NAME,
                        },
                    )
            return {
                "status": "success",
                "image_id": image_id,
                "analysis_id": analysis_id,
                "created_at": created_at.isoformat() if created_at else None,
                "analysis": assessment,
            }

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            reason = (
                str(exc) if isinstance(exc, VisionError) else "Vision processing error"
            )
            logger.warning("Vision image %s failed: %s", image_id, reason)
            try:
                async with get_connection() as conn:
                    async with conn.transaction():
                        await run_query(
                            """
                            UPDATE vision_analysis_jobs
                            SET status = 'FAILED', last_error = %s,
                                updated_at = NOW(),
                                next_attempt_at = NOW() +
                                    (LEAST(3600, 300 * POWER(2, attempts - 1))
                                     * INTERVAL '1 second')
                            WHERE image_id = %s;
                            """,
                            (reason[:250], image_id),
                            conn=conn,
                        )
                        await audit_log(
                            conn=conn,
                            action_type="VISION_ANALYSIS_FAILED",
                            entity_type="plant_image",
                            entity_id=image_id,
                            description="Gemini vision assessment failed.",
                            metadata={
                                "camera_id": image["camera_id"],
                                "model": MODEL_NAME,
                                "reason": reason[:250],
                            },
                        )
            except Exception:
                logger.exception(
                    "Could not persist vision failure for image %s", image_id
                )
            return {"status": "error", "image_id": image_id, "error": reason}

    async def analyse_latest_images(self) -> dict[str, Any]:
        images = await self.get_latest_unanalysed_images()
        if not images:
            return {
                "source": "vision",
                "status": "no_new_data",
                "processed": 0,
                "successful": 0,
                "results": {},
            }
        results: dict[str, Any] = {}
        successful = 0
        for image in images:
            result = await self.analyse_image(image)
            results[str(image["image_id"])] = result
            if result["status"] == "success":
                successful += 1
        status = (
            "success"
            if successful == len(images)
            else ("partial_success" if successful else "error")
        )
        batch = {
            "source": "vision",
            "status": status,
            "processed": len(images),
            "successful": successful,
            "results": results,
        }
        if successful:
            self.latest_analysis = deepcopy(batch)
        return batch

    async def run_once(self) -> dict[str, Any]:
        return await self.analyse_latest_images()

    def get_latest_analysis(self) -> dict[str, Any] | None:
        return deepcopy(self.latest_analysis)

    async def start(self) -> None:
        self.loop = True
        if os.getenv("GEMINI_VISION_ENABLED", "false").lower() == "true":
            try:
                await run_query("""
                    UPDATE vision_analysis_jobs
                    SET status = 'FAILED', updated_at = NOW(),
                        next_attempt_at = NOW() + INTERVAL '5 minutes',
                        last_error = 'Interrupted by engine restart'
                    WHERE status = 'PROCESSING';
                    """)
            except Exception:
                logger.exception("Vision job recovery failed")
        while self.loop:
            try:
                if os.getenv("GEMINI_VISION_ENABLED", "false").lower() == "true":
                    await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Vision worker iteration failed")
            raw_interval = settings.get("vision", {}).get("polling_rate", 60)
            try:
                interval = max(30.0, float(raw_interval))
            except (ValueError, TypeError):
                interval = 60.0
            await asyncio.sleep(interval)

    async def stop(self) -> None:
        self.loop = False
