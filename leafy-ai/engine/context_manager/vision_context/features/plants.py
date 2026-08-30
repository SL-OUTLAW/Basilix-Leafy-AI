from pathlib import Path

import cv2
import numpy as np
import torch
from ultralytics import YOLO



BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

DEVICE = 0 if torch.cuda.is_available() else "cpu"

plant_model = YOLO(
    str(MODEL_DIR / "basil_segmentation_yolo26s_final.pt")
)

def make_mask(poly, height, width):
    mask = np.zeros(
        (height, width),
        dtype=np.uint8
    )

    if len(poly) >= 3:
        cv2.fillPoly(
            mask,
            [poly],
            1
        )

    return mask


def calculate_canopy_percent(result, height, width):
    pred_masks = []

    if result.masks is not None:
        for polygon in result.masks.xy:
            poly = np.asarray(
                np.round(polygon),
                dtype=np.int32
            )

            if len(poly) < 3:
                continue

            pred_masks.append(
                make_mask(
                    poly,
                    height,
                    width
                )
            )

    pred_union = np.zeros(
        (height, width),
        dtype=np.uint8
    )

    for mask in pred_masks:
        pred_union = np.maximum(
            pred_union,
            mask
        )

    canopy_percent = (
        pred_union.sum()
        / (height * width)
        * 100.0
    )

    return float(canopy_percent)

def detect_plants(image):
    result = plant_model.predict(
        image,
        conf=0.20,
        iou=0.30,
        imgsz=1280,
        max_det=300,
        device=DEVICE,
        end2end=False,
        verbose=False
    )[0]

    plants = []

    height, width = image.shape[:2]
    polygons = result.masks.xy if result.masks is not None else []

    for index, box in enumerate(result.boxes):
        x1, y1, x2, y2 = box.xyxy[0].tolist()

        area_pixels = None
        image_area_percent = None

        label_x = round((x1 + x2) / 2)
        label_y = round((y1 + y2) / 2)

        if index < len(polygons):
            poly = np.asarray(
                np.round(polygons[index]),
                dtype=np.int32
            )

            mask = make_mask(
                poly,
                height,
                width
            )

            area_pixels = int(mask.sum())

            moments = cv2.moments(mask)

            if moments["m00"] != 0:
                label_x = round(moments["m10"] / moments["m00"])
                label_y = round(moments["m01"] / moments["m00"])
            else:
                label_x = round((x1 + x2) / 2)
                label_y = round((y1 + y2) / 2)

            image_area_percent = round(
                area_pixels / (height * width) * 100.0,
                4
            )

        plants.append({
            "confidence": round(float(box.conf[0]), 4),
            "area_pixels": area_pixels,
            "image_area_percent": image_area_percent,
            "center": {
                "x": round((x1 + x2) / 2),
                "y": round((y1 + y2) / 2)
            },
            "label_center": {
                "x": label_x,
                "y": label_y
            },
            "width_pixels": round(x2 - x1),
            "height_pixels": round(y2 - y1),
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