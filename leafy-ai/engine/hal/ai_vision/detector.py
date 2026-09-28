from pathlib import Path
import json
import sys

import cv2

from engine.hal.ai_vision.features.health import classify_health
from engine.hal.ai_vision.features.anomaly import analyse_visual_anomaly
from engine.hal.ai_vision.features.plants import analyse_canopy


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

        if not image_path.exists():
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

        canopy = analyse_canopy(image)
        health = classify_health(image)
        visual_anomaly = analyse_visual_anomaly(
            image,
            camera,
        )

        appearance = canopy.pop("appearance")

        size = {
            "scope": "camera_view_image_space",
            "metric": "canopy_coverage_percent",
            "value": canopy["coverage_percent"],
            "unit": "percent",
        }

        crowding = {
            "scope": "camera_view_image_space",
            "metric": "canopy_coverage_percent",
            "value": canopy["coverage_percent"],
            "unit": "percent",
            "assessment": "not_classified",
        }

        water_stress = {
            "status": "requires_sensor_context",
            "assessment": "not_classified",
            "visual_features_source": "appearance",
            "requires_sensor_context": True,
        }

        nutrient_stress = {
            "status": "requires_sensor_context",
            "assessment": "not_classified",
            "visual_features_source": "appearance",
            "requires_sensor_context": True,
        }

        growth = {
            "status": "requires_history_context",
            "assessment": "not_classified",
            "metric": "canopy_coverage_percent",
            "value": canopy["coverage_percent"],
            "requires_history_context": True,
        }

        harvest_readiness = {
            "status": "requires_history_context",
            "assessment": "not_classified",
            "visual_features_source": [
                "canopy",
                "appearance",
            ],
            "requires_history_context": True,
        }

        return {
            "source": "vision",
            "status": "success",
            "camera": camera,
            "image": {
                "width": width,
                "height": height,
            },
            "canopy": canopy,
            "size": size,
            "crowding": crowding,
            "appearance": appearance,
            "water_stress": water_stress,
            "nutrient_stress": nutrient_stress,
            "growth": growth,
            "harvest_readiness": harvest_readiness,
            "health": health,
            "visual_anomaly": visual_anomaly,
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
