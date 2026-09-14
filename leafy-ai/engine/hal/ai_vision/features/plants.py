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

def analyse_canopy(image):
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

    height, width = image.shape[:2]

    canopy_percent = calculate_canopy_percent(
        result,
        height,
        width
    )

    return {
        "coverage_percent": round(
            canopy_percent,
            2
        )
    }
