# Basilix AI Vision

Vision module for whole-camera basil monitoring.

## Active Pipeline

The pipeline uses:
- basil_segmentation_yolo26s_final.pt for canopy segmentation
- basil_health_yolo26s_final.pt for healthy/downy-mildew classification and embeddings
- basil_camera_baseline_v1.npz for camera-specific visual anomaly detection

Database pipeline identifier: basil_vision_pipeline_v1

## Outputs

Vision currently provides:
- camera and image dimensions
- canopy coverage
- image-space size evidence
- crowding evidence
- canopy appearance measurements
- health classification
- visual anomaly detection
- water-stress evidence
- nutrient-stress evidence
- growth evidence
- harvest-readiness evidence

## Health

Supported classifier conditions:
- healthy
- downy_mildew
- review_unknown for low-confidence predictions

Other diseases are marked not_evaluated.

External healthy/downy validation:
- downy mildew: 5/6 correct
- healthy: 3/3 correct

A separate four-class disease model was rejected after only 46.2 percent external accuracy.

## Visual Anomaly

Camera 1 and Camera 2 use separate normal-image baselines.

Possible results:
- normal_visual
- abnormal_visual

This detects unusual farm-camera appearance. It does not identify the biological cause.

Held-out anomaly validation:
- Camera 1: 18 held-out, 0 false alarms
- Camera 2: 18 held-out, 0 false alarms

## Water and Nutrient Stress

Vision does not make exact RGB-only water or nutrient diagnoses.

Water and nutrient outputs require sensor context such as:
- EC
- pH
- temperature
- irrigation history
- dosing history
- previous readings

The AI Core can combine those signals with Vision evidence.

## Growth and Harvest Readiness

Canopy coverage alone was not reliable enough to classify growth stage.

Growth and harvest readiness therefore require historical context.

## Validation

Final pipeline validation:
- schema check passed
- integration test passed
- 179 unique Level 1 farm images processed successfully
- 179/179 returned required fields
- 36 held-out farm images
- 0 pipeline failures
- 0 anomaly false alarms
- average GPU runtime: 96.23 ms/image
- peak allocated VRAM: 591.67 MB

Development GPU: NVIDIA GeForce RTX 5080.

Deployment-computer performance is still unknown.

## Limitations

Vision does not currently claim:
- complete disease identification
- physical plant count
- centimetre measurements
- individual plant spacing
- exact crowding classification
- exact plant age
- RGB-only drought diagnosis
- RGB-only overwatering diagnosis
- RGB-only nutrient deficiency diagnosis
- RGB-only nutrient excess diagnosis
- image-only harvest readiness

Camera identity is currently inferred from the filename.

The visual anomaly system is specific to the known farm-camera domain.

## Integration

Public function:

analyse_camera_images(image_paths)

Successful results are stored in plant_image_analysis.

The camera/HAL layer remains responsible for creating plant_images.

## Additional Notes

- `get_latest_analysis()` returns the latest fully successful batch.
- Each stored analysis is associated with the supplied `image_id`.
- Vision does not create `cameras` or `plant_images` records itself.
- Canopy coverage is full-image basil coverage, not model confidence or segmentation accuracy.
- Physical measurements require camera calibration or another known physical reference.
- Dense and overlapping canopy may affect segmentation performance.

## Run

From leafy-ai:

python -m engine.hal.ai_vision.detector path/to/image.jpg

Integration test:

python -m engine.hal.ai_vision.test_integration path/to/image.jpg
