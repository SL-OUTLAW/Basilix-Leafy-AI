# Basilix AI Vision
AI Vision module for basil health classification.

## Main model
`models/basil_health_yolo26s_final.pt`

Model architecture:

`YOLO26s-cls`

Current health classes:

- downy_mildew
- healthy

The classifier is the primary model used by AI Core.

## Current evaluation
Clean validation:

- Top-1 accuracy: 97.2%
- Top-5 accuracy: 100%

Untouched test set:

- Overall accuracy: 98.1%
- 108 test images
- Test images were not used during training

Real greenhouse testing:

- Tested on real farm images
- Tested under strong pink grow-light conditions
- Real farm screenshot tests were classified correctly as healthy

Per-class test accuracy:

- healthy: 98.78% (81/82)
- downy_mildew: 96.15% (25/26)

## Setup

Create or activate a Python environment and install:

```bash
pip install -r requirements.txt
```

## Run

From the project root:

```bash
python leafy-ai/ai/vision/detector.py "path/to/image.jpg"
```

Example output:

```json
{
  "source": "vision",
  "status": "success",
  "health": {
    "condition": "healthy",
    "confidence": 0.9991,
    "flagged": false,
    "action": "none"
  }
}
```
Possible downy mildew result:

```json
{
  "source": "vision",
  "status": "success",
  "health": {
    "condition": "downy_mildew",
    "confidence": 0.95,
    "flagged": true,
    "action": "review_required"
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

The current model only classifies:

- healthy
- downy_mildew

Other basil health conditions such as bacterial leaf spot, nutrient deficiency, overwatering, dryness and other plant stress are not currently classified by this model.

These conditions can be added later when suitable training data is available.

Model confidence is not guaranteed diagnostic certainty.

Vision results should be combined with sensor data and AI Core reasoning before operational decisions are made.