# Basilix AI Vision

Vision module for whole-camera sweet basil monitoring.

## Active Pipeline

The active Vision path uses one deployed AI model:
- Gemini 3.8 Flash for whole-camera visual assessment

The model receives the current farm image together with fixed same-camera early, middle, and mature reference images.

Database pipeline identifier: `basil_vision_gemini_v4_5`

Existing local YOLO/OpenCV Vision files are kept in the repository but are not used by the active Gemini path.

## Outputs

Vision provides:
- relative plant size
- canopy coverage
- crowding state
- overall visual health
- dryness / wilt signs
- overwatering-like signs
- nutrient-deficiency-like signs
- disease-like visual signs when supported
- growth / maturity stage
- same-camera historical canopy-change evidence
- image quality
- human-review flags

Vision does not make irrigation, dosing, spacing, move, or harvest-control decisions.

## Health

Health is reported from visible RGB evidence.

Dryness / wilt, overwatering-like signs, and nutrient-deficiency-like signs are treated as visual observations rather than confirmed root causes.

Named disease output is best-effort. The system should prefer a broad stress result or review flag when the visible evidence does not support a specific disease-like type.

## Growth

Visual growth stage comes from the Gemini assessment using same-camera stage references.

Historical growth evidence is calculated separately from previous analyses from the same camera using canopy coverage. Captures less than six hours apart are not treated as biological growth evidence.

The historical calculation reports measured canopy change and, when enough history exists, a regression slope, fit value, and history span. It does not replace the Gemini visual stage with the older hard-coded Camera 1 / Camera 2 stage thresholds.

## Validation

Frozen Vision version: 4.5

Farm evaluation on 12 reviewed farm images:
- growth stage: 12/12
- relative plant size: 12/12
- crowding state: 12/12
- healthy false alerts: 0/12
- canopy coverage MAE: 9.44 percentage points

Representative health spot-checks were also run for healthy, wilt/dryness, downy-mildew-like, and powdery-mildew-like examples. Broad health state matched all four representative cases. The downy-mildew-like example was detected as stressed but the exact subtype was not matched.

The four health examples are a functional spot-check, not an accuracy benchmark.

## Limitations

- canopy percentage is an approximate RGB estimate
- exact disease subtype is not guaranteed
- positive overwatering-like cases have not yet been independently validated
- positive nutrient-deficiency-like cases have not yet been independently validated
- physical centimetre measurements require camera calibration or another physical reference
- exact plant count is not produced
- RGB appearance alone does not prove the root cause of water or nutrient stress

## Integration

Official Vision interface:

`analyse_camera_images(image_paths)`

`detector.py` is the internal image-analysis layer used by the Vision tool and can also be run directly for debugging.

Successful results are stored in `plant_image_analysis`.

The camera/HAL layer remains responsible for creating `plant_images`.

`get_latest_analysis()` returns the latest fully successful batch.

Vision does not create camera or plant-image records itself.
