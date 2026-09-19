# Basilix AI Vision
AI Vision module for whole-camera basil canopy analysis.

## Models

The current active Vision pipeline uses one model:

- `models/basil_segmentation_yolo26s_final.pt`

The model performs basil instance segmentation internally.

For the active Vision pipeline, the detected basil masks are combined into one overall canopy mask for the camera image.

Individual detections are not treated as physical plant counts.

## Current Vision Output

Vision currently provides:

- camera identifier
- image width and height
- whole-frame basil canopy coverage percentage
- health availability status

Example detector output:

```json
{
  "source": "vision",
  "status": "success",
  "camera": "camera1",
  "image": {
    "width": 704,
    "height": 576
  },
  "canopy": {
    "coverage_percent": 74.3
  },
  "health": {
    "status": "not_available",
    "reason": "The current single vision model does not classify plant health."
  }
}
```

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

## Hardware

The Vision code uses GPU acceleration when CUDA is available and can fall back to CPU execution.

Development and testing have been performed with the current Leafy AI development environment.

Actual inference performance on the final farm deployment computer has not yet been validated.

## AI Core Integration

Vision exposes one public batch analysis function:

`analyse_camera_images(image_paths)`

Input format:

```python
{
    image_id: image_path,
    ...
}
```

The camera/HAL layer is responsible for creating the corresponding plant_images records and supplying Vision with the image IDs and image paths.

Vision then:

- analyses each supplied image
- creates a compact whole-camera analysis
- stores successful results in plant_image_analysis
- associates each analysis with its supplied image_id
- returns the results as a JSON-compatible dictionary
- keeps the latest fully successful batch in memory

The latest fully successful batch can be retrieved with:

`get_latest_analysis()`

Example stored analysis:

```json
{
  "source": "vision",
  "status": "success",
  "image_id": 101,
  "camera": "camera1",
  "image": {
    "width": 704,
    "height": 576
  },
  "health": {
    "status": "not_available",
    "reason": "The current single vision model does not classify plant health."
  },
  "canopy": {
    "coverage_percent": 74.3
  }
}
```

## Current Testing

The current Vision pipeline has been tested successfully with real basil camera images.

Verified tests include:

- single-image integration test: passed
- two-image real PostgreSQL batch test: passed
- PostgreSQL analysis read-back: passed
- database cleanup verification: passed
- failure-case test suite: passed
- 20-image repeated batch stress test: passed
- 58 newer farm-camera images processed successfully
- Camera 1: 29/29 images passed
- Camera 2: 29/29 images passed

For the 58-image farm-camera robustness test:

- Camera 1 canopy range: 39.46% to 45.14%
- Camera 1 average canopy coverage: 41.71%
- Camera 2 canopy range: 32.73% to 34.60%
- Camera 2 average canopy coverage: 33.90%

These canopy percentages measure predicted basil coverage across the full image frame. They are not model-confidence or accuracy percentages.

These tests demonstrate pipeline robustness on the tested images but should not be treated as independent segmentation-accuracy benchmarks.

## Database Integration

Vision is implemented to store successful analysis results in:

plant_image_analysis

using the supplied plant_images.image_id.

The database connection has been verified.

Real Vision-to-plant_image_analysis inserts have been verified successfully using temporary test camera and plant_images records.

In normal operation, the camera/HAL pipeline is responsible for creating the real plant_images records before Vision analyses them.

Vision does not create camera or plant_images records itself.

## Important limitations

The current active Vision model does not classify:

- disease
- dryness
- overwatering
- nutrient deficiency
- other plant health conditions

Health therefore returns `not_available`.

These should not be inferred without validated model or sensor evidence.

The system does not currently provide:

- physical plant count
- physical centimetre measurements
- individual plant size
- individual plant spacing
- crowding measurements
- persistent plant tracking across dates
- confirmed channel or row identification
- exact plant age
- harvest readiness
- expansion readiness
- yield prediction

Physical measurements would require camera calibration or another known physical reference.

Canopy coverage is measured across the full camera frame because a validated growing-area region has not yet been defined.

Dense mature canopy and overlapping leaves may affect segmentation performance.

The camera identifier is currently inferred from the image filename. If the filename does not identify a recognised camera, the detector returns `"camera": "unknown"`.
