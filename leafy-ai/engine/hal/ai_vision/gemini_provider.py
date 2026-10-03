import base64
import hashlib
import os
from pathlib import Path
from typing import Any

from google import genai

from engine.hal.ai_vision.gemini_schema import VisionAssessment


MODEL = "gemini-3.8-flash"
THINKING_LEVEL = "medium"
VISION_VERSION = "4.5"
SCHEMA_VERSION = "1.0"

BASE_DIR = Path(__file__).resolve().parent
PROMPT_PATH = BASE_DIR / "gemini_vision_prompt_v4_5.txt"
SCHEMA_PATH = BASE_DIR / "gemini_schema.py"
REFERENCE_ROOT = BASE_DIR / "references"

EXPECTED_PROMPT_HASH = "4a3057949f22fc44427942e6145499e96e76f61705e17dbd80e95023f9dd2c49"
EXPECTED_SCHEMA_HASH = "51f6a42fc27fd32d342904193198a4edd6c0f0fa93d6616347d5454cb6f80ba0"

REFERENCE_HASHES = {
    "camera1": {
        "early": "2bf5f97875b043c6f388551c6b439f1c9bfc44032cecbd6bce74b5d1ae1a98fc",
        "middle": "ba2e1a420309155f098be046bc36034ee281121996bbdb7c1c481fa371149657",
        "mature": "edecdef9cebdc5215d4e9913aa3b42e722d22ae60f75a02e7556b6889e127370",
    },
    "camera2": {
        "early": "7b8a88e066b950a4e3bbadf1fc74cab742d464ba036209a6536732d004ae89fe",
        "middle": "4174be1508697d801ace3a02c28fd698ada2ad27de143cb9065e39a44fb3f6c3",
        "mature": "1bb7d9138ea738dd7f391a3079ebb41dbda69cb247e48c94256dc0bf4fdbed61",
    },
}

MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}

MAX_IMAGE_BYTES = 20_000_000


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _text_hash(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return _sha256(text.encode("utf-8"))


def _file_hash(path: Path) -> str:
    return _sha256(path.read_bytes())


def _verify_assets() -> None:
    if _text_hash(PROMPT_PATH) != EXPECTED_PROMPT_HASH:
        raise RuntimeError("Gemini Vision prompt hash mismatch")

    if _text_hash(SCHEMA_PATH) != EXPECTED_SCHEMA_HASH:
        raise RuntimeError("Gemini Vision schema hash mismatch")

    for camera, stages in REFERENCE_HASHES.items():
        for stage, expected_hash in stages.items():
            path = REFERENCE_ROOT / camera / f"{stage}.jpg"

            if not path.is_file():
                raise RuntimeError(
                    f"Missing Gemini Vision reference: {camera}/{stage}"
                )

            if _file_hash(path) != expected_hash:
                raise RuntimeError(
                    f"Gemini Vision reference hash mismatch: {camera}/{stage}"
                )


def _image_part(path: Path) -> dict[str, str]:
    mime_type = MIME_TYPES.get(path.suffix.lower())

    if mime_type is None:
        raise ValueError("Unsupported Vision image type")

    if path.stat().st_size > MAX_IMAGE_BYTES:
        raise ValueError("Vision image exceeds size limit")

    return {
        "type": "image",
        "data": base64.b64encode(path.read_bytes()).decode("ascii"),
        "mime_type": mime_type,
    }


def _reference_paths(camera_id: str) -> list[Path]:
    folder = REFERENCE_ROOT / camera_id
    return [folder / f"{stage}.jpg" for stage in ("early", "middle", "mature")]


def _build_input(image_path: Path, camera_id: str) -> list[dict[str, str]]:
    prompt = PROMPT_PATH.read_text(encoding="utf-8")
    parts = [{"type": "text", "text": prompt}]

    for stage, path in zip(
        ("EARLY", "MIDDLE", "MATURE"),
        _reference_paths(camera_id),
    ):
        parts.append({"type": "text", "text": f"{stage} REFERENCE"})
        parts.append(_image_part(path))

    parts.append({"type": "text", "text": "TARGET IMAGE"})
    parts.append(_image_part(image_path))

    return parts


def analyse_with_gemini(
    image_path: str | Path,
    camera_id: str,
) -> dict[str, Any]:
    path = Path(image_path)

    if not path.is_file():
        raise FileNotFoundError("Vision image was not found")

    if path.suffix.lower() not in MIME_TYPES:
        raise ValueError("Unsupported Vision image type")

    if camera_id not in REFERENCE_HASHES:
        raise ValueError("Vision camera is not calibrated")

    if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
        raise RuntimeError("Gemini API key is not set")

    _verify_assets()
    parts = _build_input(path, camera_id)
    client = genai.Client()

    try:
        interaction = client.interactions.create(
            model=MODEL,
            input=parts,
            generation_config={
                "thinking_level": THINKING_LEVEL,
            },
            response_format=[
                {
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": VisionAssessment.model_json_schema(),
                }
            ],
        )
    except Exception as error:
        message = str(error).lower()

        if "429" in message or "resource_exhausted" in message:
            raise RuntimeError(
                "Gemini Vision rate limit reached"
            ) from None

        if "503" in message or "service_unavailable" in message:
            raise RuntimeError(
                "Gemini Vision service unavailable"
            ) from None

        raise RuntimeError(
            "Gemini Vision request failed"
        ) from None

    try:
        result = VisionAssessment.model_validate_json(
            interaction.output_text
        )
    except Exception:
        raise RuntimeError(
            "Gemini Vision returned invalid JSON"
        ) from None

    return {
        "vision_version": VISION_VERSION,
        "schema_version": SCHEMA_VERSION,
        "source_sha256": _file_hash(path),
        "model": MODEL,
        "thinking_level": THINKING_LEVEL,
        "prompt_sha256": EXPECTED_PROMPT_HASH,
        "schema_sha256": EXPECTED_SCHEMA_HASH,
        "assessment": result.model_dump(),
    }
