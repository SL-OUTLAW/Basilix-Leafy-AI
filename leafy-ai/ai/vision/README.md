# Basilix AI Vision
AI Vision module for basil health classification.

## Main model
`models/health_classifier_v1.pt`

Current health classes:

- bacterial_spot
- downy_mildew
- healthy
- powdery_mildew

The classifier is the primary model used by AI Core.

## Optional debug model
`models/health_detector_v2.pt`
This model provides bounding boxes for debugging only.
It is not used for the official health classification result.

## Current evaluation
Clean holdout test:

- Overall accuracy: 81.25%
- bacterial_spot: 50% (2 test images only)
- downy_mildew: 80%
- healthy: 80%
- powdery_mildew: 90%

Known limitation:

Pink greenhouse lighting can cause incorrect classifications.
More real greenhouse camera data is required for further domain adaptation.

## Setup

Create or activate a Python environment and install:

```bash
pip install -r requirements.txt
```

## Run

From the project root:

```bash
python leafy-ai/ai/vision/detector.py "C:/LeafyAI_Vision_Work/03_test_images/health_tests/basil_test.jpg"
```

Example output:

```json
{
  "source": "vision",
  "status": "success",
  "health": {
    "primary_condition": "healthy",
    "confidence": 0.9975
  }
}
```

## Hardware

The same model works on:

- NVIDIA GPU systems
- CPU-only laptops
- university computers without CUDA

The code automatically uses GPU when available and falls back to CPU.

## AI Core Integration

```python
from detector import detect_health

result = detect_health("image.jpg")
```

The function returns a JSON-compatible Python dictionary.

## Important limitation

Model confidence is not guaranteed diagnostic certainty.

The current model is a prototype and should be combined with sensor data and AI Core reasoning before operational decisions are made.