from pathlib import Path
import json
import sys

import torch
from ultralytics import YOLO


# --------------------------------------------------
# Paths
# --------------------------------------------------

VISION_DIR = Path(__file__).resolve().parent
MODELS_DIR = VISION_DIR / "models"

HEALTH_CLASSIFIER_PATH = (
    MODELS_DIR / "health_classifier_v1.pt"
)

HEALTH_DETECTOR_PATH = (
    MODELS_DIR / "health_detector_v2.pt"
)


# --------------------------------------------------
# Device
# --------------------------------------------------

DEVICE = (
    0
    if torch.cuda.is_available()
    and torch.cuda.device_count() > 0
    else "cpu"
)


# --------------------------------------------------
# Models
# --------------------------------------------------

health_classifier = YOLO(
    str(HEALTH_CLASSIFIER_PATH)
)

health_detector = None


# --------------------------------------------------
# Supported Images
# --------------------------------------------------

SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp"
}


def validate_image(image_path):
    """
    Validate an image before Vision inference.
    """

    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    if not image_path.is_file():
        raise ValueError(
            f"Image path is not a file: {image_path}"
        )

    if image_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported image format: {image_path.suffix}"
        )

    return image_path


# --------------------------------------------------
# Main Health Classification
# --------------------------------------------------

def classify_health(image_path):
    """
    Predict the primary basil health condition.

    Current classes:
        - bacterial_spot
        - downy_mildew
        - healthy
        - powdery_mildew

    This classifier is the primary health model
    used by AI Core.
    """

    image_path = validate_image(image_path)

    results = health_classifier.predict(
        source=str(image_path),
        imgsz=224,
        device=DEVICE,
        verbose=False
    )

    result = results[0]

    if result.probs is None:
        raise RuntimeError(
            "Health classifier returned no probabilities."
        )

    class_id = int(result.probs.top1)

    condition = result.names[class_id]

    confidence = float(
        result.probs.top1conf.item()
    )

    return {
        "primary_condition": condition,
        "confidence": round(confidence, 4)
    }


# --------------------------------------------------
# Optional Debug Detector
# --------------------------------------------------

def detect_health_regions(
    image_path,
    confidence=0.25
):
    """
    Optional visual debugging function.

    This detector is not used for the official
    AI Core health result.
    """
    global health_detector

    if health_detector is None:
        health_detector = YOLO(
            str(HEALTH_DETECTOR_PATH)
        )
        
    image_path = validate_image(image_path)

    results = health_detector.predict(
        source=str(image_path),
        conf=confidence,
        imgsz=640,
        device=DEVICE,
        verbose=False
    )

    detections = []

    for result in results:

        if result.boxes is None:
            continue

        for box in result.boxes:

            class_id = int(box.cls.item())
            condition = result.names[class_id]
            score = float(box.conf.item())

            x1, y1, x2, y2 = (
                box.xyxy[0].tolist()
            )

            detections.append({
                "condition": condition,
                "confidence": round(score, 4),
                "bbox": {
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2)
                }
            })

    return detections


# --------------------------------------------------
# AI Core Vision Output
# --------------------------------------------------

def detect_health(image_path):
    """
    Return the official Vision health result
    for AI Core.

    Unavailable fields are omitted rather than
    returned as null.
    """

    try:

        classification = classify_health(
            image_path
        )

        return {
            "source": "vision",
            "status": "success",
            "health": {
                "primary_condition":
                    classification[
                        "primary_condition"
                    ],

                "confidence":
                    classification[
                        "confidence"
                    ]
            }
        }

    except Exception as error:

        return {
            "source": "vision",
            "status": "error",
            "error": str(error)
        }


# --------------------------------------------------
# Command Line
# --------------------------------------------------

if __name__ == "__main__":

    if len(sys.argv) < 2:

        print(
            "Usage: "
            "python detector.py <image_path>"
        )

        sys.exit(1)

    result = detect_health(
        sys.argv[1]
    )

    print(
        json.dumps(
            result,
            indent=2
        )
    )
