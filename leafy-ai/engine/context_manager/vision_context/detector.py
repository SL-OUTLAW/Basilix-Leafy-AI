from pathlib import Path
import json
import sys

import cv2

from features.plants import detect_plants, calculate_canopy_percent
from features.growth import calculate_growth
from features.measurements import (
    add_plant_spacing,
    calculate_crowding,
    calculate_size_summary
)
from features.visualization import draw_analysis
from features.multi_camera import build_camera_summary


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "analysed_images"
OUTPUT_DIR.mkdir(exist_ok=True)

def get_camera(image_path):
    name = image_path.name.lower()

    if "camera1" in name:
        return "camera1"

    if "camera2" in name:
        return "camera2"

    return "unknown"

def analyse_plants(image_path):
    try:
        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError("Image not found.")

        image = cv2.imread(str(image_path))

        if image is None:
            raise ValueError("Could not read image.")

        height, width = image.shape[:2]

        camera = get_camera(image_path)

        result, plants = detect_plants(image)

        health = {
            "status": "not_available",
            "reason": "The current single vision model does not classify plant health."
        }
        add_plant_spacing(plants)
        canopy = round(
            calculate_canopy_percent(
                result,
                height,
                width
            ),
            2
        )

        crowding = calculate_crowding(plants)
        size = calculate_size_summary(plants)

        annotated = draw_analysis(
            image,
            result,
            plants
        )
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
            "crowding": crowding,
            "size": size,
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

def compare_growth(previous_image_path, current_image_path):
    previous = analyse_plants(previous_image_path)
    current = analyse_plants(current_image_path)

    if previous["status"] != "success":
        return {
            "source": "vision",
            "status": "error",
            "error": "Previous image analysis failed."
        }

    if current["status"] != "success":
        return {
            "source": "vision",
            "status": "error",
            "error": "Current image analysis failed."
        }
    if previous["camera"] == "unknown" or current["camera"] == "unknown":
        return {
            "source": "vision",
            "status": "error",
            "error": "Could not identify camera from image name."
        }
    return calculate_growth(
        previous,
        current,
        previous_image_path,
        current_image_path
    )

def analyse_cameras(image_paths):
    if not image_paths:
        return {
            "source": "vision",
            "status": "error",
            "error": "No camera images provided."
        }

    results = []

    for image_path in image_paths:
        result = analyse_plants(image_path)

        if result["status"] != "success":
            return {
                "source": "vision",
                "status": "error",
                "error": f"Could not analyse {image_path}"
            }

        results.append(result)

    cameras = [
        result["camera"]
        for result in results
    ]

    if "unknown" in cameras:
        return {
            "source": "vision",
            "status": "error",
            "error": "Could not identify camera from image name."
        }

    if len(cameras) != len(set(cameras)):
        return {
            "source": "vision",
            "status": "error",
            "error": "Only one image per camera can be summarised."
        }

    return build_camera_summary(results)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python detector.py <image_path>")
        sys.exit(1)

    print(json.dumps(analyse_plants(sys.argv[1]), indent=2))