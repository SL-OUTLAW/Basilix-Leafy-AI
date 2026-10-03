from pathlib import Path
import json
import sys

import cv2

from engine.hal.ai_vision.gemini_provider import analyse_with_gemini


def get_camera(image_path):
    name = image_path.name.lower()

    if "camera1" in name:
        return "camera1"

    if "camera2" in name:
        return "camera2"

    return "unknown"


def analyse_image(image_path, camera_name=None):
    try:
        image_path = Path(image_path)

        if not image_path.is_file():
            raise FileNotFoundError("Image not found.")

        image = cv2.imread(str(image_path))

        if image is None:
            raise ValueError("Could not read image.")

        height, width = image.shape[:2]

        if camera_name and "camera1" in str(camera_name).lower():
            camera = "camera1"
        elif camera_name and "camera2" in str(camera_name).lower():
            camera = "camera2"
        else:
            camera = get_camera(image_path)

        result = analyse_with_gemini(
            image_path,
            camera,
        )
        assessment = result["assessment"]

        return {
            "source": "vision",
            "status": "success",
            "camera": camera,
            "image": {
                "width": width,
                "height": height,
            },
            "vision_version": result["vision_version"],
            "schema_version": result["schema_version"],
            "source_sha256": result["source_sha256"],
            "model": result["model"],
            "thinking_level": result["thinking_level"],
            "prompt_sha256": result["prompt_sha256"],
            "schema_sha256": result["schema_sha256"],
            "health": assessment["health"],
            "plant_size": assessment["plant_size"],
            "canopy": assessment["canopy"],
            "growth": assessment["growth"],
            "image_quality": assessment["image_quality"],
            "review": assessment["review"],
        }

    except Exception as error:
        return {
            "source": "vision",
            "status": "error",
            "error": str(error),
        }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(
            "Usage: python -m "
            "engine.hal.ai_vision.detector <image_path>"
        )
        sys.exit(1)

    print(
        json.dumps(
            analyse_image(sys.argv[1]),
            indent=2,
        )
    )
