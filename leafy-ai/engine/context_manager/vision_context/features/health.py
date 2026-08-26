from pathlib import Path

import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

DEVICE = 0 if torch.cuda.is_available() else "cpu"

health_model = YOLO(
    str(MODEL_DIR / "basil_health_yolo26s_final.pt")
)


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