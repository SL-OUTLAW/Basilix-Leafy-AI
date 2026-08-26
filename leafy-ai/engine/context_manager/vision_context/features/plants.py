from pathlib import Path

import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

DEVICE = 0 if torch.cuda.is_available() else "cpu"

plant_model = YOLO(
    str(MODEL_DIR / "basil_segmentation_yolo26s.pt")
)


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

    plants.sort(
        key=lambda p: (
            -round(p["center"]["y"] / 35),
            p["center"]["x"]
        )
    )

    for i, plant in enumerate(plants):
        plant["id"] = i + 1

    return result, plants