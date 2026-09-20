from typing import Any

import httpx
import os

from engine.security.emergency_stop import ai_enabled
from engine.security.engine_auth import create_token

AI_CORE_URL = os.getenv(
    "AI_CORE_URL",
    "http://localhost:8001",
)

AI_CORE_TIMEOUT = 180.0


async def run_ai(
    task: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:

    if not ai_enabled():
        return {
            "success": False,
            "error": "AI access is disabled by system safety state.",
        }

    request_body = {
        "task": task,
        "context": context,
    }

    try:

        async with httpx.AsyncClient() as client:

            response = await client.post(
                f"{AI_CORE_URL}/analyse",
                json=request_body,
                timeout=AI_CORE_TIMEOUT,
                headers={
                    "Authorization": f"Bearer {create_token()}",
                },
            )

            response.raise_for_status()

            return response.json()

    except httpx.TimeoutException:

        return {
            "success": False,
            "error": "Leafy AI analysis timed out.",
        }

    except httpx.HTTPError:

        return {
            "success": False,
            "error": "Leafy AI analysis could not be completed.",
        }
