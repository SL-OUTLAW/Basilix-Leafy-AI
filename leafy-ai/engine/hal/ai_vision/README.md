# Basilix AI Vision
AI Vision module for basil plant detection, segmentation, canopy analysis, size and spacing analysis.

## Models

The current active Vision pipeline uses one model:

- `models/basil_segmentation_yolo26s_final.pt`

The model performs basil instance segmentation.

The segmentation results are used with deterministic Python/OpenCV processing to calculate:

- visible plant count
- plant positions
- canopy coverage
- apparent plant size
- nearest plant spacing
- relative spacing / crowding
- analysed image overlays

Older health and canopy models may still exist in the repository as legacy files, but they are not part of the current active Vision pipeline.

## Current evaluation

The current segmentation model has been tested on labelled real farm camera images.

A 10-image farm regression audit produced:

- 543 ground-truth plant instances
- 546 predicted plant instances
- mean absolute count error: 0.5 plants per image
- exact plant count on 6 of 10 images
- plant count within ±1 on 9 of 10 images
- largest count error: 2 plants

This audit includes development and validation images, so it should not be treated as a new independent accuracy benchmark.

Segmentation performance is generally strong on the current fixed-camera farm images, but dense mature canopy and heavy leaf overlap remain more difficult.

## Setup

Create or activate a Python environment and install:

```bash
pip install -r requirements.txt
```

## Run

From the `leafy-ai` directory:

```bash
python -m engine.hal.ai_vision.detector "path/to/image.jpg"
```

Example output:

```json
{
  "source": "vision",
  "status": "success",
  "camera": "level1_camera1",
  "farm_level": 1,
  "stage": "growing",
  "image": {
    "width": 704,
    "height": 576
  },
  "health": {
    "status": "not_available",
    "reason": "The current single vision model does not classify plant health."
  },
  "plants": {
    "count": 57,
    "items": []
  },
  "canopy": 59.19,
  "crowding": {
    "average_nearest_distance_pixels": 58.36,
    "average_relative_spacing": 0.996
  },
  "size": {
    "average_image_area_percent": 1.0896,
    "median_image_area_percent": 0.3867
  }
}
```

## Hardware

The Vision code uses GPU acceleration when CUDA is available and can fall back to CPU execution.

Development and testing have been performed with the current Leafy AI development environment.

Actual inference performance on the final farm deployment computer has not yet been validated.

## AI Core Integration

Vision exposes one public analysis function:

`analyse_camera_images(image_paths)`

Input format:

`{image_id: image_path}`

The camera/HAL layer provides the image IDs and paths from `plant_images`.

Vision then:

- analyses each image
- stores successful results in `plant_image_analysis`
- returns the results as a JSON-compatible dictionary
- keeps the latest successful result in memory

The latest result can be retrieved with:

`get_latest_analysis()`

## Important limitations

The current active Vision model does not classify:

- disease
- dryness
- overwatering
- nutrient deficiency
- other plant health conditions

These should not be inferred without validated model or sensor evidence.

Current plant size, height, width and spacing measurements are image-space measurements.

The system does not currently provide:

- physical centimetre measurements
- persistent plant tracking across dates
- confirmed channel or row identification
- exact plant age
- harvest readiness
- expansion readiness

Physical measurements would require camera calibration or another known physical reference.

Plant IDs are spatial labels for a single analysed image. The same ID number across different images must not be assumed to represent the same physical plant.

Canopy coverage is measured across the full camera frame because a validated growing-area region has not yet been defined.

Dense mature plants and overlapping leaves can reduce individual segmentation accuracy.
