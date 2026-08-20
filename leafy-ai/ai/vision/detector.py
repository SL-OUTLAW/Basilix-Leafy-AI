from pathlib import Path
import json
import sys

import torch
from ultralytics import YOLO


VISION_DIR = Path(__file__).resolve().parent
MODELS_DIR = VISION_DIR / "models"

HEALTH_CLASSIFIER_PATH = MODELS_DIR / "basil_health_yolo26s_final.pt"

DEVICE = 0 if torch.cuda.is_available() and torch.cuda.device_count() > 0 else "cpu"

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

health_classifier = YOLO(str(HEALTH_CLASSIFIER_PATH))

def validate_image(image_path):
    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    if not image_path.is_file():
        raise ValueError(f"Image path is not a file: {image_path}")

    if image_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported image format: {image_path.suffix}")

    return image_path

def classify_health(image_path):
    image_path = validate_image(image_path)

    results = health_classifier.predict(
        source=str(image_path),
        imgsz=224,
        device=DEVICE,
        verbose=False
    )
    result = results[0]

    if result.probs is None:
        raise RuntimeError("Health classifier returned no probabilities.")

    class_id = int(result.probs.top1)
    condition = result.names[class_id]
    confidence = float(result.probs.top1conf.item())

    return {
        "condition": condition,
        "confidence": round(confidence, 4),
        "flagged": condition != "healthy",
        "action": "review_required" if condition != "healthy" else "none"
    }

def detect_health(image_path):
    try:
        health_result = classify_health(image_path)
        return {
            "source": "vision",
            "status": "success",
            "health": health_result
        }
    except Exception as error:
        return {
            "source": "vision",
            "status": "error",
            "error": str(error)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python detector.py <image_path>")
        sys.exit(1)

    result = detect_health(sys.argv[1])
    print(json.dumps(result, indent=2))