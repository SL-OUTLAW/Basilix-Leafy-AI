from pathlib import Path

import torch
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

DEVICE = 0 if torch.cuda.is_available() else "cpu"
MIN_CONFIDENCE = 0.80

health_model = YOLO(
    str(MODEL_DIR / "basil_health_yolo26s_final.pt")
)

def classify_health(image):
    result = health_model.predict(
        image,
        imgsz=224,
        device=DEVICE,
        verbose=False,
    )[0]

    class_id = int(result.probs.top1)
    predicted = result.names[class_id]
    confidence = float(result.probs.top1conf)

    if confidence < MIN_CONFIDENCE:
        condition = "review_unknown"
        review_needed = True
    else:
        condition = predicted
        review_needed = False

    return {
        "status": "available",
        "scope": "overall_image",
        "model_scope": "healthy_vs_downy_mildew",
        "supported_conditions": [
            "healthy",
            "downy_mildew",
        ],
        "other_diseases": "not_evaluated",
        "condition": condition,
        "raw_condition": predicted,
        "confidence": round(confidence, 4),
        "flagged": condition != "healthy",
        "review_needed": review_needed,
    }