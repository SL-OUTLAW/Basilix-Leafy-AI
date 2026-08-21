from pathlib import Path
import json
import sys

import cv2
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

def classify_health(image):
    results = health_classifier.predict(
        source=image,
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

def analyse_plants(image_path):
    try:
        image_path = validate_image(image_path)
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError("Could not read image.")
        height, width = image.shape[:2]
        health = classify_health(image)

        return {
            "source": "vision",
            "status": "success",
            "image": {"width": width, "height": height},
            "health": health,
        }
    except Exception as error:
        return {
            "source": "vision",
            "status": "error",
            "error": str(error)
        }

def detect_health(image_path):
    result = analyse_plants(image_path)

    if result["status"] == "error":
        return result
    return {
        "source": result["source"],
        "status": result["status"],
        "health": result["health"]
    }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python detector.py <image_path>")
        sys.exit(1)

    result = analyse_plants(sys.argv[1])
    print(json.dumps(result, indent=2))
