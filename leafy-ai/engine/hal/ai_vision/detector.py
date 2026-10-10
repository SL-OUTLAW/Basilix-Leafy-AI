import asyncio
import io
import os
import re
from pathlib import Path

from engine.hal.ai_vision.vision_prompt import (
    VISION_SYSTEM_PROMPT,
    VISION_USER_PROMPT,
)
from engine.hal.ai_vision.vision_schema import VisionAssessment

MODEL_NAME = os.getenv("GEMINI_VISION_MODEL", "gemini-3.8-flash")
THINKING_LEVEL = os.getenv("GEMINI_VISION_THINKING_LEVEL", "low").strip().lower()
MAX_SOURCE_BYTES = 12 * 1024 * 1024
MAX_OUTPUT_BYTES = 4 * 1024 * 1024
MAX_DIMENSION = 1536
MAX_PIXELS = 20_000_000


class VisionError(RuntimeError):
    """Custom error class"""


def _api_key() -> str:
    path = os.getenv("GEMINI_API_KEY_FILE", "").strip()
    if path:
        try:
            key = Path(path).read_text(encoding="utf-8").strip()
        except OSError as exc:
            raise VisionError("Gemini API key secret is unavailable") from exc
    else:
        key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise VisionError("Gemini API key is not configured")
    return key


def _safe_image(image_path: str | Path) -> tuple[bytes, int, int]:
    root = Path(
        os.getenv(
            "CAMERA_IMAGE_DIR",
            str(Path(__file__).resolve().parents[2] / "camera_images"),
        )
    ).resolve()

    candidate = Path(image_path).resolve()

    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise VisionError("Camera image path is outside the approved directory")
    if candidate.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        raise VisionError("Unsupported camera image format")
    if candidate.stat().st_size > MAX_SOURCE_BYTES:
        raise VisionError("Camera image exceeds the maximum source size")
    try:
        from PIL import Image, ImageOps, UnidentifiedImageError
    except ImportError as exc:
        raise VisionError("Install Pillow to enable Gemini vision") from exc
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        with Image.open(candidate) as source:
            if source.width * source.height > MAX_PIXELS:
                raise VisionError("Camera image dimensions are too large")
            source.verify()
        with Image.open(candidate) as source:
            source = ImageOps.exif_transpose(source)
            width, height = source.size
            source.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

            # re encode to jpeg no metadata

            clean = source.convert("RGB")
            buffer = io.BytesIO()
            clean.save(buffer, format="JPEG", quality=82, optimize=True)
    except (
        OSError,
        ValueError,
        UnidentifiedImageError,
        Image.DecompressionBombError,
    ) as exc:
        raise VisionError("Camera image is corrupt or invalid") from exc
    result = buffer.getvalue()
    if len(result) > MAX_OUTPUT_BYTES:
        raise VisionError("Prepared camera image exceeds upload limit")
    return result, width, height


async def analyse_image(image_path: str | Path) -> dict:
    if not re.fullmatch(r"gemini-[a-zA-Z0-9.\-]+", MODEL_NAME):
        raise VisionError("Invalid configured Gemini model name")
    if THINKING_LEVEL not in {"low", "medium", "high"}:
        raise VisionError("Invalid Gemini vision thinking level")

    image_bytes, width, height = await asyncio.to_thread(_safe_image, image_path)
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise VisionError("Install google-genai to enable Gemini vision") from exc

    try:
        async with genai.Client(
            api_key=_api_key(),
            http_options=types.HttpOptions(api_version="v1", timeout=45000),
        ).aio as client:
            response = await asyncio.wait_for(
                client.models.generate_content(
                    model=MODEL_NAME,
                    contents=[
                        VISION_USER_PROMPT,
                        types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=VISION_SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        response_schema=VisionAssessment,
                        thinking_config=types.ThinkingConfig(
                            thinking_level=THINKING_LEVEL,
                        ),
                        max_output_tokens=2600,
                    ),
                ),
                timeout=55.0,
            )
    except (asyncio.TimeoutError, TimeoutError) as exc:
        raise VisionError("Gemini vision request timed out") from exc
    except Exception as exc:
        print(exc)
        raise VisionError("Gemini vision request failed") from exc

    try:
        if isinstance(response.parsed, VisionAssessment):
            assessment = response.parsed
        elif response.parsed is not None:
            assessment = VisionAssessment.model_validate(response.parsed)
        elif response.text:
            assessment = VisionAssessment.model_validate_json(response.text)
        else:
            raise ValueError("Missing structured response")
    except (ValueError, TypeError) as exc:
        raise VisionError("Gemini returned invalid vision JSON") from exc

    data = assessment.model_dump(mode="json")
    data["health"]["status"] = data["health"]["overall"]
    return {
        "source": "vision",
        "status": "success",
        "provider": "gemini",
        "model": MODEL_NAME,
        "image": {"width": width, "height": height},
        **data,
    }
