import asyncio
import json

from copy import deepcopy
from datetime import datetime
from typing import Any

from engine.hal.ai_vision.detector import analyse_image
from engine.logger.logger import audit_log
from engine.managers.db_manager import (
    get_connection,
    run_query,
)
from engine.managers.settings_manager import settings

MODEL_NAME = "basil_segmentation_yolo26s_final.pt"


class VisionAnalysis:

    def __init__(self):
        self.loop = False

        self.latest_analysis: dict[str, Any] | None = None

    async def get_latest_images(
        self,
    ) -> list[dict[str, Any]]:

        rows = await run_query("""
            SELECT DISTINCT ON (c.camera_id)
                pi.image_id,
                pi.camera_id,
                c.camera_name,
                c.level_no,
                pi.image_path,
                pi.captured_at
            FROM cameras c
            JOIN plant_images pi
                ON pi.camera_id = c.camera_id
            WHERE c.status = 'ACTIVE'
            ORDER BY
                c.camera_id ASC,
                pi.captured_at DESC,
                pi.image_id DESC;
            """)

        return [
            {
                "image_id": row[0],
                "camera_id": row[1],
                "camera_name": row[2],
                "level_no": row[3],
                "image_path": row[4],
                "captured_at": (row[5].isoformat() if row[5] is not None else None),
            }
            for row in rows
        ]

    async def get_latest_unanalysed_images(
        self,
    ) -> list[dict[str, Any]]:

        rows = await run_query("""
            SELECT
                latest.image_id,
                latest.camera_id,
                latest.camera_name,
                latest.level_no,
                latest.image_path,
                latest.captured_at
            FROM (
                SELECT DISTINCT ON (c.camera_id)
                    pi.image_id,
                    pi.camera_id,
                    c.camera_name,
                    c.level_no,
                    pi.image_path,
                    pi.captured_at
                FROM cameras c
                JOIN plant_images pi
                    ON pi.camera_id = c.camera_id
                WHERE c.status = 'ACTIVE'
                ORDER BY
                    c.camera_id ASC,
                    pi.captured_at DESC,
                    pi.image_id DESC
            ) AS latest
            LEFT JOIN plant_image_analysis pia
                ON pia.image_id = latest.image_id
            WHERE pia.analysis_id IS NULL
            ORDER BY
                latest.level_no ASC,
                latest.camera_id ASC;
            """)

        return [
            {
                "image_id": row[0],
                "camera_id": row[1],
                "camera_name": row[2],
                "level_no": row[3],
                "image_path": row[4],
                "captured_at": (row[5].isoformat() if row[5] is not None else None),
            }
            for row in rows
        ]

    def _build_public_analysis(
        self,
        analysis: dict[str, Any],
        image_id: int,
    ) -> dict[str, Any]:

        return {
            "source": "vision",
            "status": "success",
            "image_id": image_id,
            "camera": analysis.get("camera"),
            "image": analysis.get("image"),
            "health": analysis.get("health"),
            "canopy": analysis.get("canopy"),
        }

    async def analyse_image(
        self,
        image: dict[str, Any],
    ) -> dict[str, Any]:

        image_id = image["image_id"]

        try:

            analysis = await asyncio.to_thread(
                analyse_image,
                image["image_path"],
            )

            if not isinstance(
                analysis,
                dict,
            ):
                raise RuntimeError("Vision model returned an invalid result.")

            if analysis.get("status") != "success":

                raise RuntimeError(
                    analysis.get(
                        "error",
                        "Vision analysis failed.",
                    )
                )

            analysis = self._build_public_analysis(
                analysis,
                image_id,
            )

            rows = await run_query(
                """
                INSERT INTO plant_image_analysis (
                    image_id,
                    model_name,
                    analysis
                )
                VALUES (
                    %s,
                    %s,
                    %s::jsonb
                )
                RETURNING
                    analysis_id,
                    created_at;
                """,
                (
                    image_id,
                    MODEL_NAME,
                    json.dumps(analysis),
                ),
            )

            if not rows:

                raise RuntimeError("Database insert returned no result.")

            analysis_id = rows[0][0]
            created_at = rows[0][1]

            result = {
                "status": "success",
                "image_id": image_id,
                "analysis_id": analysis_id,
                "created_at": (
                    created_at.isoformat() if created_at is not None else None
                ),
                "analysis": analysis,
            }

            try:

                await self._audit_success(
                    image=image,
                    analysis_id=analysis_id,
                    created_at=created_at,
                )

            except Exception as audit_error:
                print(f"Vision success audit failed: {audit_error}.")

            return result

        except Exception as error:

            try:

                await self._audit_failure(
                    image=image,
                    error=error,
                )

            except Exception as audit_error:
                print(
                    f"Vision failure audit failed: {audit_error}. "
                    f"Original error: {error}."
                )

            return {
                "status": "error",
                "image_id": image_id,
                "error": str(error),
            }

    async def analyse_latest_images(
        self,
    ) -> dict[str, Any]:

        images = await self.get_latest_unanalysed_images()

        if not images:

            latest_images = await self.get_latest_images()

            if not latest_images:

                return {
                    "source": "vision",
                    "status": "no_data",
                    "processed": 0,
                    "successful": 0,
                    "results": {},
                    "message": (
                        "No camera images are currently " "available for analysis."
                    ),
                }

            return {
                "source": "vision",
                "status": "no_new_data",
                "processed": 0,
                "successful": 0,
                "results": {},
                "message": (
                    "The latest available camera images " "have already been analysed."
                ),
            }

        results: dict[str, Any] = {}

        successful = 0

        analyses = await asyncio.gather(
            *[self.analyse_image(image) for image in images],
            return_exceptions=True,
        )

        for image, result in zip(
            images,
            analyses,
        ):

            image_id = image["image_id"]

            if isinstance(
                result,
                Exception,
            ):

                results[str(image_id)] = {
                    "status": "error",
                    "image_id": image_id,
                    "error": str(result),
                }

                continue

            results[str(image_id)] = result

            if result.get("status") == "success":

                successful += 1

        if successful == len(images):

            status = "success"

        elif successful > 0:

            status = "partial_success"

        else:

            status = "error"

        result = {
            "source": "vision",
            "status": status,
            "processed": len(images),
            "successful": successful,
            "results": results,
        }

        if successful > 0:

            self.latest_analysis = deepcopy(result)

        return result

    async def _audit_success(
        self,
        image: dict[str, Any],
        analysis_id: int,
        created_at: datetime | None,
    ) -> None:

        async with get_connection() as conn:

            await audit_log(
                conn=conn,
                action_type="VISION_ANALYSIS_COMPLETED",
                entity_type="plant_image_analysis",
                entity_id=analysis_id,
                description=(
                    "Vision analysis completed successfully "
                    f"for {image['camera_name']}."
                ),
                metadata={
                    "analysis_id": analysis_id,
                    "image_id": image["image_id"],
                    "camera_id": image["camera_id"],
                    "camera_name": image["camera_name"],
                    "level_no": image["level_no"],
                    "image_path": image["image_path"],
                    "captured_at": image["captured_at"],
                    "analysed_at": (
                        created_at.isoformat() if created_at is not None else None
                    ),
                    "model_name": MODEL_NAME,
                },
            )

    async def _audit_failure(
        self,
        image: dict[str, Any],
        error: Exception,
    ) -> None:

        async with get_connection() as conn:

            await audit_log(
                conn=conn,
                action_type="VISION_ANALYSIS_FAILED",
                entity_type="plant_image",
                entity_id=image["image_id"],
                description=("Vision analysis failed " f"for {image['camera_name']}."),
                metadata={
                    "image_id": image["image_id"],
                    "camera_id": image["camera_id"],
                    "camera_name": image["camera_name"],
                    "level_no": image["level_no"],
                    "image_path": image["image_path"],
                    "captured_at": image["captured_at"],
                    "model_name": MODEL_NAME,
                    "error_type": type(error).__name__,
                    "error": str(error),
                },
            )

    async def run_once(
        self,
    ) -> dict[str, Any]:

        return await self.analyse_latest_images()

    def get_latest_analysis(
        self,
    ) -> dict[str, Any] | None:

        return deepcopy(self.latest_analysis)

    async def start(
        self,
    ) -> None:

        self.loop = True

        while self.loop:

            try:

                await self.analyse_latest_images()

            except Exception as error:

                try:

                    async with get_connection() as conn:

                        await audit_log(
                            conn=conn,
                            action_type="VISION_ANALYSIS_LOOP_FAILED",
                            entity_type="vision",
                            description=(
                                "The scheduled vision analysis " "loop failed."
                            ),
                            metadata={
                                "error_type": type(error).__name__,
                                "error": str(error),
                            },
                        )

                except Exception as audit_error:
                    print(
                        f"Vision loop error: {error}. "
                        f"Audit logging also failed: {audit_error}."
                    )

            polling_rate = settings.get(
                "vision",
                {},
            ).get(
                "polling_rate",
                1800,
            )

            try:

                polling_rate = float(polling_rate)

            except (
                TypeError,
                ValueError,
            ):

                polling_rate = 1800.0

            if polling_rate <= 0:

                polling_rate = 1800.0

            await asyncio.sleep(polling_rate)

    async def stop(
        self,
    ) -> None:

        self.loop = False
