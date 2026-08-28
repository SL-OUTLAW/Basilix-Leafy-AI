from typing import Any
import httpx
import os

from llm_auth import create_token

ENGINE_URL = os.getenv(
    "ENGINE_URL",
    "http://localhost:8000",
)

ENGINE_TOOL_TIMEOUT = 30.0


async def execute_tool(
    tool_calls: list[dict[str, Any]],
    user_context: dict[str, Any] | None = None,
) -> Any:

    request_body: dict[str, Any] = {"tool_calls": tool_calls}

    if user_context is not None:
        request_body["user_context"] = user_context

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                (f"{ENGINE_URL}" "/tools/execute"),
                json=request_body,
                timeout=ENGINE_TOOL_TIMEOUT,
                headers={"Authorization": f"Bearer {create_token()}"},
            )

            response.raise_for_status()

            result = response.json()

            return result

    except httpx.TimeoutException as error:

        return {
            "success": False,
            "error": ("The requested capability timed out."),
        }

    except httpx.HTTPError as error:

        return {
            "success": False,
            "error": ("The requested capability could not be completed."),
        }
