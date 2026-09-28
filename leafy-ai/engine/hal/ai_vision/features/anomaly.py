from pathlib import Path

import numpy as np

from engine.hal.ai_vision.features.health import (
    DEVICE,
    health_model,
)


BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

BASELINE_PATH = (
    MODEL_DIR / "basil_camera_baseline_v1.npz"
)

baseline = np.load(BASELINE_PATH)


def analyse_visual_anomaly(image, camera):
    if camera not in {"camera1", "camera2"}:
        return {
            "status": "unavailable",
            "reason": "unknown_camera",
        }

    embeddings = health_model.embed(
        source=image,
        imgsz=224,
        device=DEVICE,
        verbose=False,
    )

    vector = (
        embeddings[0]
        .detach()
        .cpu()
        .numpy()
        .astype(np.float32)
    )

    vector /= np.linalg.norm(vector) + 1e-12

    references = baseline[
        f"{camera}_embeddings"
    ]

    threshold = float(
        baseline[f"{camera}_threshold"]
    )

    similarities = references @ vector

    distance = float(
        1.0 - similarities.max()
    )

    abnormal = distance > threshold

    return {
        "status": "available",
        "scope": "same_camera_visual_baseline",
        "assessment": (
            "abnormal_visual"
            if abnormal
            else "normal_visual"
        ),
        "distance": round(distance, 5),
        "threshold": round(threshold, 5),
        "flagged": abnormal,
    }
