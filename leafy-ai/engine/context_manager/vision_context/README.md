# Basilix AI Vision
AI Vision module for basil health classification, plant detection and canopy analysis.

## Models

Required model files:

- `models/basil_health_yolo26s_final.pt`
- `models/basil_segmentation_yolo26s.pt`
- `models/basil_canopy_deeplabv3.pt`

The health model uses YOLO26s classification.

The segmentation model detects individual basil plants and is used for plant counting and position information.

The canopy model uses DeepLabV3 to measure basil canopy coverage in the camera frame.

Vision model files are stored in the `models` folder.

## Current evaluation

Health model classes:

- healthy
- downy_mildew

Training-time validation:

- Top-1 accuracy: 97.22%
- Top-5 accuracy: 100%

Current validation re-check:

- Overall accuracy: 98.31% (116/118)
- healthy: 98.78% (81/82)
- downy_mildew: 97.22% (35/36)

Current test set:

- Overall accuracy: 98.21% (110/112)
- healthy: 98.78% (81/82)
- downy_mildew: 96.67% (29/30)

Dataset checks:

- No exact duplicate images found across train, validation and test splits
- No matching Roboflow source filenames found across splits

Real greenhouse testing:

- The health model runs successfully on real farm camera images
- Current tested farm images were classified as healthy
- Diseased plants have not yet been locally validated under the farm camera conditions

The accuracy results above apply only to the current two-class health dataset.
## Setup

Create or activate a Python environment and install:

```bash
pip install -r requirements.txt
```

## Run

From the project root:

```bash
python leafy-ai/engine/context_manager/vision_context/detector.py "path/to/image.jpg"
```

Example output:

```json
{
  "source": "vision",
  "status": "success",
  "image": {
    "width": 1707,
    "height": 985
  },
  "health": {
    "condition": "healthy",
    "confidence": 0.9991,
    "flagged": false,
  }
}
```
Possible downy mildew result:

```json
{
  "source": "vision",
  "status": "success",
  "image": {
    "width": 1707,
    "height": 985
  },
  "health": {
    "condition": "downy_mildew",
    "confidence": 0.95,
    "flagged": true,
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
from detector import analyse_plants

result = analyse_plants("image.jpg")
```

The function returns a JSON-compatible Python dictionary.

`analyse_plants()` is the main Vision entry point.

It analyses the image once and returns the available plant information in a JSON-compatible Python dictionary.

Current output includes:

- image dimensions
- camera name when available
- health classification
- health confidence
- health flag
- detected plant count
- plant confidence
- plant centre coordinates
- plant bounding boxes
- frame canopy coverage percentage
- analysed image path

Additional plant analysis such as size, crowding and other visual health indicators can be added later when suitable farm data and validated methods are available.

## Important limitation

The current model only classifies:

- healthy
- downy_mildew

Other basil health conditions such as bacterial leaf spot, nutrient deficiency, overwatering, dryness and other plant stress are not currently classified by this model.

These conditions can be added later when suitable training data is available.

Model confidence is not guaranteed diagnostic certainty.

Vision results should be combined with sensor data and AI Core reasoning before operational decisions are made.

The plant segmentation model has been validated on labelled real farm images. Plant counting performs well on the current local dataset, but accuracy decreases when mature plants overlap heavily. Counts on new images should therefore be treated as estimates rather than exact measurements.

Canopy coverage is currently measured across the full camera frame. It does not yet represent calibrated growing-area coverage because a validated growing-area region has not been defined.