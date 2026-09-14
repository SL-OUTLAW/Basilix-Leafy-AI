from pathlib import Path
import json
import sys

import cv2

from engine.hal.ai_vision.features.plants import analyse_canopy


def get_camera(image_path):
    name = image_path.name.lower()

    if "camera1" in name:
        return "camera1"

    if "camera2" in name:
        return "camera2"

    return "unknown"


def analyse_image(image_path):
    try:
        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError("Image not found.")

        image = cv2.imread(str(image_path))

        if image is None:
            raise ValueError("Could not read image.")

        height, width = image.shape[:2]
        camera = get_camera(image_path)

        canopy = analyse_canopy(image)

        return {
            "source": "vision",
            "status": "success",
            "camera": camera,
            "image": {
                "width": width,
                "height": height,
            },
            "canopy": canopy,
            "health": {
                "status": "not_available",
                "reason": (
                    "The current single vision model "
                    "does not classify plant health."
                ),
            },
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
