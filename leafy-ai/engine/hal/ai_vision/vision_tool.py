import asyncio
import json
from copy import deepcopy

from engine.hal.ai_vision.detector import analyse_plants
from engine.managers.db_manager import run_query


MODEL_NAME = "basil_segmentation_yolo26s_final.pt"

_latest_analysis = None


async def analyse_camera_images(image_paths):
    """
    Analyse camera images supplied as:

    {
        image_id: image_path,
        ...
    }

    Successful analyses are stored in plant_image_analysis.
    The full result is returned as a JSON-compatible dictionary.
    """

    global _latest_analysis

    if not isinstance(image_paths, dict) or not image_paths:
        return {
            "source": "vision",
            "status": "error",
            "error": (
                "image_paths must be a non-empty dictionary "
                "of {image_id: image_path}."
            ),
        }

    results = {}
    successful = 0

    for image_id, image_path in image_paths.items():

        try:
            image_id = int(image_id)
        except (TypeError, ValueError):
            results[str(image_id)] = {
                "status": "error",
                "error": "Invalid image_id.",
            }
            continue

        if not isinstance(image_path, str) or not image_path:
            results[str(image_id)] = {
                "status": "error",
                "error": "Invalid image_path.",
            }
            continue

        analysis = await asyncio.to_thread(
            analyse_plants,
            image_path,
        )

        if analysis.get("status") != "success":
            results[str(image_id)] = analysis
            continue

        analysis["image_id"] = image_id

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
    elif status == "success":
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


VISION_TOOL_SCHEMA = {
    "name": "analyse_camera_images",
    "description": (
        "Analyse basil camera image paths, save successful "
        "analyses and return the Vision results."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "image_paths": {
                "type": "object",
                "description": (
                    "Dictionary mapping plant image IDs "
                    "to camera image paths."
                ),
                "additionalProperties": {
                    "type": "string"
                },
            }
        },
        "required": ["image_paths"],
        "additionalProperties": False,
    },
}
