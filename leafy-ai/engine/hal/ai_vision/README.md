# Leafy AI Vision

### Leafy AI Vision relies on Gemini AI API

The Engine camera loop captures a frame, stores its path in `plant_images` and
the independent HAL vision worker processes unanalysed captures in chronological
order. Each request sends exactly one sanitized JPEG to Gemini, validates the
structured result with Pydantic, then stores the JSON in `plant_image_analysis`.

## What the model assesses

The output is limited to visually observable information:

- plant size: `none`, `early`, `middle`, `mature`, or `unknown`
- canopy coverage, density, crowding and leaf overlap
- overall visual health
- visible signs compatible with dryness/water stress
- visible signs compatible with overwatering/root-zone stress
- visible signs compatible with nutrient deficiency
- image quality and concise visible evidence

## Install

From `leafy-ai/`:

```bash
pip install -r engine/hal/ai_vision/requirements.txt
```

The Gemini integration uses the Google GenAI SDK.

## Configuration

```env
GEMINI_VISION_ENABLED=true
GEMINI_VISION_MODEL=gemini-3.8-flash
GEMINI_VISION_THINKING_LEVEL=low
GEMINI_VISION_BATCH_SIZE=4
CAMERA_IMAGE_DIR=/data/camera_images
GEMINI_API_KEY_FILE=/run/secrets/gemini_api_key
```

For Docker, prefer a read-only secret
file via `GEMINI_API_KEY_FILE`. `GEMINI_API_KEY` is supported for local
development only.

`GEMINI_VISION_BATCH_SIZE` is clamped to 1-20. It limits how many pending images
are sent during one vision-loop iteration; it does not discard older images.
Pending images remain in `plant_images` and are processed on later iterations.

`CAMERA_IMAGE_DIR` must point to the same persistent directory used by the camera
capture loop and should be mounted as a Docker volume.

## Security boundary

Before an image leaves the Engine container, the integration:

- accepts only local `.jpg`, `.jpeg` or `.png` files under `CAMERA_IMAGE_DIR`
- rejects oversized or invalid images
- opens and verifies the image using Pillow
- strips EXIF/embedded metadata by re-encoding it to JPEG
- scales the image to a bounded size
- exposes no Gemini tools, browsing or farm-control functions
- uses a strict system prompt that treats image text/QR codes as untrusted data
- requires schema-conforming JSON and forbids unknown fields
- logs only sanitized failure categories, not raw provider errors/responses
- retries failed images at most three times with exponential backoff
- processes API calls sequentially to bound outbound concurrency

## Docker example

```yaml
services:
  engine:
    environment:
      GEMINI_VISION_ENABLED: "true"
      GEMINI_VISION_MODEL: gemini-3.8-flash
      GEMINI_VISION_THINKING_LEVEL: low
      GEMINI_VISION_BATCH_SIZE: "4"
      CAMERA_IMAGE_DIR: /data/camera_images
      GEMINI_API_KEY_FILE: /run/secrets/gemini_api_key
    secrets:
      - gemini_api_key
    volumes:
      - camera_images:/data/camera_images

secrets:
  gemini_api_key:
    file: ./secrets/gemini_api_key.txt

volumes:
  camera_images:
```

## Stored JSON

`plant_image_analysis.analysis` contains the validated assessment plus provider,
model, camera and image metadata. The main assessment sections are:

```json
{
  "image_quality": {},
  "plant_size": {},
  "canopy": {},
  "health": {
    "overall": "visually_healthy",
    "status": "visually_healthy",
    "dryness": {},
    "overwatering": {},
    "nutrient_deficiency": {},
    "visible_symptoms": [],
    "summary": "..."
  }
}
```

## Processing behavior

1. Camera capture saves the JPEG and inserts `plant_images`.
2. The vision loop queries the oldest unanalysed images for the configured model.
3. A processing job is claimed in `vision_analysis_jobs`.
4. The sanitized single image is sent to Gemini.
5. Gemini returns schema-constrained JSON.
6. Pydantic validates the response again inside the Engine.
7. A successful assessment is inserted into `plant_image_analysis` and audited.
8. Failures are marked for bounded retry while camera capture continues.
