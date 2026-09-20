from typing import Any

import os

import httpx

from fastapi.encoders import jsonable_encoder

from engine.security.engine_auth import create_token
from engine.security.emergency_stop import ai_enabled

AI_CORE_URL = os.getenv(
    "AI_CORE_URL",
    "http://127.0.0.1:8001",
)

AI_CORE_TIMEOUT = 900.0


async def run_ai(
    task: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:

    if not ai_enabled():
        return {
            "success": False,
            "error": "AI access is disabled by system safety state.",
        }

    request_body = jsonable_encoder(
        {
            "task": task,
            "context": context,
        }
    )

    try:

        async with httpx.AsyncClient() as client:

            response = await client.post(
                f"{AI_CORE_URL}/leafy-ai",
                json=request_body,
                timeout=AI_CORE_TIMEOUT,
                headers={
                    "Authorization": f"Bearer {create_token()}",
                },
            )

            response.raise_for_status()

            return response.json()

    except httpx.TimeoutException as error:

        return {
            "success": False,
            "error": f"Leafy AI analysis timed out: {error}",
        }

    except httpx.HTTPStatusError as error:

        return {
            "success": False,
            "error": (
                f"Leafy AI returned HTTP "
                f"{error.response.status_code}: "
                f"{error.response.text}"
            ),
        }

    except httpx.RequestError as error:

        return {
            "success": False,
            "error": (f"Could not connect to Leafy AI at " f"{AI_CORE_URL}: {error}"),
        }

    except ValueError as error:

        return {
            "success": False,
            "error": (f"Leafy AI returned an invalid response: {error}"),
        }
