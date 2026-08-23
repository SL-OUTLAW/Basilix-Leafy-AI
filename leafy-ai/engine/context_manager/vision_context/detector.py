from pathlib import Path
import json
import sys

import cv2
import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
OUTPUT_DIR = BASE_DIR / "analysed_images"
OUTPUT_DIR.mkdir(exist_ok=True)

DEVICE = 0 if torch.cuda.is_available() else "cpu"

health_model = YOLO(str(MODEL_DIR / "basil_health_yolo26s_final.pt"))
plant_model = YOLO(str(MODEL_DIR / "basil_segmentation_yolo26s.pt"))


def classify_health(image):
    result = health_model.predict(
        image,
        imgsz=224,
        device=DEVICE,
        verbose=False
    )[0]

    class_id = int(result.probs.top1)
    condition = result.names[class_id]

    return {
        "condition": condition,
        "confidence": round(float(result.probs.top1conf), 4),
        "flagged": condition != "healthy"
    }


def detect_plants(image):
    result = plant_model.predict(
        image,
        conf=0.25,
        iou=0.5,
        imgsz=1280,
        device=DEVICE,
        end2end=False,
        verbose=False
    )[0]

    plants = []

    for box in result.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()

        plants.append({
            "confidence": round(float(box.conf[0]), 4),
            "center": {
                "x": round((x1 + x2) / 2),
                "y": round((y1 + y2) / 2)
            },
            "box": {
                "x1": round(x1),
                "y1": round(y1),
                "x2": round(x2),
                "y2": round(y2)
            }
        })

    plants.sort(key=lambda p: (p["center"]["y"], p["center"]["x"]))

    for i, plant in enumerate(plants):
        plant["id"] = i + 1

    return result, plants


def analyse_plants(image_path):
    try:
        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError("Image not found.")

        image = cv2.imread(str(image_path))

        if image is None:
            raise ValueError("Could not read image.")

        height, width = image.shape[:2]

        health = classify_health(image)
        result, plants = detect_plants(image)

        annotated = image.copy()

        annotated = result.plot(
            labels=False,
            boxes=False,
            conf=False
        )

        for plant in plants:
            x = plant["center"]["x"]
            y = plant["center"]["y"]

            cv2.putText(
            annotated,
            f'{plant["id"]}',
            (x, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            2
        )

        output_name = image_path.stem + "_analysed" + image_path.suffix
        output_path = OUTPUT_DIR / output_name

        if not cv2.imwrite(str(output_path), annotated):
            raise OSError("Could not save analysed image.")

        camera = "unknown"

        if "camera1" in image_path.name.lower():
            camera = "camera1"
        elif "camera2" in image_path.name.lower():
            camera = "camera2"

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