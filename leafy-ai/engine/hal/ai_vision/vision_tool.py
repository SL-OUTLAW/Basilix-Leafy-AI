import asyncio
import json
from copy import deepcopy

from engine.hal.ai_vision.detector import analyse_image
from engine.managers.db_manager import run_query


MODEL_NAME = "basil_vision_pipeline_v1"

_latest_analysis = None

def _build_public_analysis(analysis, image_id):
    return {
        "source": "vision",
        "status": "success",
        "image_id": image_id,
        "camera": analysis.get("camera"),
        "image": analysis.get("image"),
        "health": analysis.get("health"),
        "visual_anomaly": analysis.get("visual_anomaly"),
        "canopy": analysis.get("canopy"),
        "size": analysis.get("size"),
        "crowding": analysis.get("crowding"),
        "appearance": analysis.get("appearance"),
        "water_stress": analysis.get("water_stress"),
        "nutrient_stress": analysis.get("nutrient_stress"),
        "growth": analysis.get("growth"),
        "harvest_readiness": analysis.get("harvest_readiness"),
    }

async def analyse_camera_images(image_paths):
    """
    Analyse camera images supplied as either:

    {
        image_id: image_path,
        ...
    }

    or:

    {
        image_id: {
            "image_path": image_path,
            "camera_name": camera_name,
        },
        ...
    }

    Successful analyses are stored in plant_image_analysis.
    A compact whole-camera analysis is returned as a JSON-compatible dictionary.
    """

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

        analysis = _build_public_analysis(
            analysis,
            image_id,
        )

        try:
            rows = await run_query(
                """
                INSERT INTO plant_image_analysis (
                    image_id,
                    model_name,
                    analysis
                )
                VALUES (%s, %s, %s::jsonb)
                RETURNING analysis_id, created_at;
                """,
                (
                    image_id,
                    MODEL_NAME,
                    json.dumps(analysis),
                ),
            )

            if not rows:
                raise RuntimeError(
                    "Database insert returned no result."
                )

            analysis_id, created_at = rows[0]

            results[str(image_id)] = {
                "status": "success",
                "analysis_id": analysis_id,
                "created_at": created_at.isoformat(),
                "analysis": analysis,
            }

            successful += 1

        except Exception as error:
            results[str(image_id)] = {
                "status": "error",
                "error": str(error),
                "analysis": analysis,
            }

    if successful == len(image_paths):
        status = "success"
    elif successful > 0:
        status = "partial_success"
    else:
        status = "error"

    result = {
        "source": "vision",
        "status": status,
        "processed": len(image_paths),
        "successful": successful,
        "results": results,
    }

    if status == "success":
        _latest_analysis = deepcopy(result)

    return result


def get_latest_analysis():
    return deepcopy(_latest_analysis)
