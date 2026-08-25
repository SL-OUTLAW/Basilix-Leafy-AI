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


def remove_mask_duplicates(result):
    if result.masks is None or len(result.boxes) < 2:
        return result

    masks = result.masks.data > 0.5

    order = sorted(
        range(len(result.boxes)),
        key=lambda i: float(result.boxes[i].conf[0]),
        reverse=True
    )

    keep = []

    for i in order:
        area1 = masks[i].sum().item()
        duplicate = False

        for j in keep:
            area2 = masks[j].sum().item()
            intersection = (masks[i] & masks[j]).sum().item()

            if intersection == 0:
                continue

            containment = intersection / min(area1, area2)
            size_ratio = min(area1, area2) / max(area1, area2)

            if containment >= 0.90 and size_ratio >= 0.75:
                duplicate = True
                break

        if not duplicate:
            keep.append(i)

    keep.sort()

    return result[keep]


def detect_plants(image, camera):
    conf = 0.25
    iou = 0.3

    if camera == "camera1":
        conf = 0.18
        iou = 0.3
    elif camera == "camera2":
        conf = 0.10
        iou = 0.5

    result = plant_model.predict(
        image,
        conf=conf,
        iou=iou,
        imgsz=1280,
        device=DEVICE,
        end2end=False,
        verbose=False
    )[0]
    result = remove_mask_duplicates(result)
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

    plants.sort(key=lambda p: (-round(p["center"]["y"] / 35), p["center"]["x"]))
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

        camera = "unknown"

        if "camera1" in image_path.name.lower():
            camera = "camera1"
        elif "camera2" in image_path.name.lower():
            camera = "camera2"

        health = classify_health(image)
        result, plants = detect_plants(image, camera)

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