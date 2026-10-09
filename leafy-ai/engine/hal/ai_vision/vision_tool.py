import asyncio
import json

from copy import deepcopy
from datetime import datetime
from typing import Any

from engine.hal.ai_vision.detector import analyse_image
from engine.hal.ai_vision.features.growth_history import get_growth_history
from engine.managers.db_manager import run_query


MODEL_NAME = "basil_vision_gemini_v4_5"

_latest_analysis = None


def _build_public_analysis(analysis, image_id):
    return {
        "source": "vision",
        "status": "success",
        "image_id": image_id,
        "camera": analysis.get("camera"),
        "image": analysis.get("image"),
        "vision_version": analysis.get("vision_version"),
        "schema_version": analysis.get("schema_version"),
        "source_sha256": analysis.get("source_sha256"),
        "model": analysis.get("model"),
        "thinking_level": analysis.get("thinking_level"),
        "prompt_sha256": analysis.get("prompt_sha256"),
        "schema_sha256": analysis.get("schema_sha256"),
        "health": analysis.get("health"),
        "plant_size": analysis.get("plant_size"),
        "canopy": analysis.get("canopy"),
        "growth": analysis.get("growth"),
        "growth_history": analysis.get("growth_history"),
        "image_quality": analysis.get("image_quality"),
        "review": analysis.get("review"),
    }


async def analyse_camera_images(image_paths):
    global _latest_analysis

    if not isinstance(image_paths, dict) or not image_paths:
        return {
            "source": "vision",
            "status": "error",
            "error": (
                "image_paths must be a non-empty dictionary."
            ),
        }

    results = {}
    successful = 0

    for image_id, image_data in image_paths.items():
        try:
            image_id = int(image_id)
        except (TypeError, ValueError):
            results[str(image_id)] = {
                "status": "error",
                "error": "Invalid image_id.",
            }
            continue

        camera_name = None

        if isinstance(image_data, dict):
            image_path = image_data.get("image_path")
            camera_name = image_data.get("camera_name")
        else:
            image_path = image_data

        if not isinstance(image_path, str) or not image_path:
            results[str(image_id)] = {
                "status": "error",
                "error": "Invalid image_path.",
            }
            continue

        if camera_name is not None and not isinstance(camera_name, str):
            results[str(image_id)] = {
                "status": "error",
                "error": "Invalid camera_name.",
            }
            continue

        analysis = await asyncio.to_thread(
            analyse_image,
            image_path,
            camera_name,
        )

        if analysis.get("status") != "success":
            results[str(image_id)] = analysis
            continue

        try:
            analysis["growth_history"] = await get_growth_history(
                image_id,
                analysis,
                MODEL_NAME,
                run_query,
            )

            analysis = _build_public_analysis(
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
