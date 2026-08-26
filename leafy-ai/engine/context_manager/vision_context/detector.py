from pathlib import Path
import json
import sys

import cv2

from features.canopy import analyse_canopy
from features.health import classify_health
from features.plants import detect_plants


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "analysed_images"
OUTPUT_DIR.mkdir(exist_ok=True)


def analyse_plants(image_path):
    try:
        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError("Image not found.")

        image = cv2.imread(str(image_path))

        if image is None:
            raise ValueError("Could not read image.")

        height, width = image.shape[:2]

        camera = "unknown"

        if "camera1" in image_path.name.lower():
            camera = "camera1"
        elif "camera2" in image_path.name.lower():
            camera = "camera2"

        health = classify_health(image)
        result, plants = detect_plants(image, camera)
        canopy = analyse_canopy(image_path)

        annotated = result.plot(
            labels=False,
            boxes=False,
            conf=False
        )

        for plant in plants:
            x = plant["center"]["x"]
            y = plant["center"]["y"]

            cv2.putText(annotated, str(plant["id"]), (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        cv2.putText(annotated, f"Plants: {len(plants)}", (15, height - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        output_name = image_path.stem + "_analysed" + image_path.suffix
        output_path = OUTPUT_DIR / output_name

        if not cv2.imwrite(str(output_path), annotated):
            raise OSError("Could not save analysed image.")
        return {
            "source": "vision",
            "status": "success",
            "camera": camera,
            "image": {
                "width": width,
                "height": height
            },
            "health": health,
            "plants": {
                "count": len(plants),
                "items": plants
            },
            "canopy": canopy,
            "analysed_image": {
                "filename": output_name,
                "relative_path": (
                    "engine/context_manager/vision_context/"
                    "analysed_images/" + output_name
                )
            }
        }

    except Exception as error:
        return {
            "source": "vision",
            "status": "error",
            "error": str(error)
        }


def detect_health(image_path):
    try:
        image = cv2.imread(str(image_path))

        if image is None:
            raise ValueError("Could not read image.")

        return {
            "source": "vision",
            "status": "success",
            "health": classify_health(image)
        }

    except Exception as error:
        return {
            "source": "vision",
            "status": "error",
            "error": str(error)
        }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python detector.py <image_path>")
        sys.exit(1)

    print(json.dumps(analyse_plants(sys.argv[1]), indent=2))