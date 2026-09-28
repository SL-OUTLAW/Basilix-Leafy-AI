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
        dtype=np.uint8,
    )

    if len(poly) >= 3:
        cv2.fillPoly(
            mask,
            [poly],
            1,
        )

    return mask


def build_canopy_mask(result, height, width):
    canopy_mask = np.zeros(
        (height, width),
        dtype=np.uint8,
    )

    if result.masks is None:
        return canopy_mask

    for polygon in result.masks.xy:
        poly = np.asarray(
            np.round(polygon),
            dtype=np.int32,
        )

        if len(poly) < 3:
            continue

        canopy_mask = np.maximum(
            canopy_mask,
            make_mask(
                poly,
                height,
                width,
            ),
        )

    return canopy_mask


def analyse_appearance(image, canopy_mask):
    pixels = image[canopy_mask > 0]

    if len(pixels) == 0:
        return {
            "status": "unavailable",
            "reason": "no_canopy_detected",
        }

    pixels = pixels.astype(np.float32)

    blue = pixels[:, 0] / 255.0
    green = pixels[:, 1] / 255.0
    red = pixels[:, 2] / 255.0

    brightness = (
        red + green + blue
    ) / 3.0

    excess_green = (
        2.0 * green
        - red
        - blue
    )

    return {
        "status": "available",
        "scope": "segmented_canopy",
        "assessment": "not_classified",
        "mean_red": round(float(red.mean()), 4),
        "mean_green": round(float(green.mean()), 4),
        "mean_blue": round(float(blue.mean()), 4),
        "mean_brightness": round(
            float(brightness.mean()),
            4,
        ),
        "mean_excess_green": round(
            float(excess_green.mean()),
            4,
        ),
    }


def analyse_canopy(image):
    result = plant_model.predict(
        image,
        conf=0.20,
        iou=0.30,
        imgsz=1280,
        max_det=300,
        device=DEVICE,
        end2end=False,
        verbose=False,
    )[0]

    height, width = image.shape[:2]

    canopy_mask = build_canopy_mask(
        result,
        height,
        width,
    )

    canopy_percent = (
        canopy_mask.sum()
        / (height * width)
        * 100.0
    )

    return {
        "coverage_percent": round(
            float(canopy_percent),
            2,
        ),
        "appearance": analyse_appearance(
            image,
            canopy_mask,
        ),
    }
