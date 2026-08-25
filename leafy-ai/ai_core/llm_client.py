import json, os, dotenv
from pathlib import Path
from typing import Any

import httpx
import ollama

from llm_tools import TOOLS

MODEL = "leafy-ai"
MAX_TOOL_ROUNDS = 8
KEEP_ALIVE = -1

ENGINE_URL = os.getenv(
    "ENGINE_URL",
    "http://engine:8000",
)

ENGINE_TOOL_TIMEOUT = 30.0

VERBOSE = True

ollama_client = ollama.AsyncClient()

DIR = Path(__file__).parent
PROMPT_PATH = DIR / "system_prompt.md"
SCHEMA_PATH = DIR / "schema.json"


def _debug(message: str) -> None:
    if VERBOSE:
        print(
            f"\n[Leafy] {message}",
            flush=True,
        )


def _debug_json(
    label: str,
    data: Any,
) -> None:
    if not VERBOSE:
        return

    print(
        f"\n[Leafy] {label}",
        flush=True,
    )

    try:
        print(
            json.dumps(
                data,
                indent=2,
                ensure_ascii=False,
                default=str,
            ),
            flush=True,
        )
    except Exception:
        print(
            repr(data),
            flush=True,
        )


def _load_system_prompt(
    path: Path,
) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise RuntimeError(f"System prompt file not found at {path}") from error


def _load_schema(
    path: Path,
) -> dict:
    try:
        with open(
            path,
            "r",
            encoding="utf-8",
        ) as file:
            return json.load(file)

    except FileNotFoundError as error:
        raise RuntimeError(f"Schema file not found at {path}") from error

    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"Schema file at {path} " f"is not valid JSON: {error}"
        ) from error


SYSTEM_PROMPT = _load_system_prompt(PROMPT_PATH)

SCHEMA = _load_schema(SCHEMA_PATH)

print(
    "SYSTEM PROMPT PATH:",
    PROMPT_PATH.resolve(),
)

print(
    "SYSTEM PROMPT EXISTS:",
    PROMPT_PATH.exists(),
)

print(
    "SYSTEM PROMPT LENGTH:",
    len(SYSTEM_PROMPT),
)

print(
    "HAS OUTPUT CONTRACT:",
    "OUTPUT CONTRACT:" in SYSTEM_PROMPT,
)

print(
    "HAS STYLE:",
    "STYLE:" in SYSTEM_PROMPT,
)

print(
    "HAS CONVERSATION CONTEXT:",
    "CONVERSATION CONTEXT:" in SYSTEM_PROMPT,
)


def _validate(
    result: dict,
) -> None:
    if not isinstance(result, dict):
        raise ValueError(
            "Expected response to be a dict, " f"got {type(result).__name__}"
        )

    response_type = result.get("response_type")

    if response_type not in {
        "chat",
        "farm_analysis",
    }:
        raise ValueError(f"Invalid response_type=" f"{response_type!r}")

    content = result.get("content")

    if not isinstance(content, str) or not content.strip():
        raise ValueError("content must be a non-empty string")

    summary = result.get("summary")

    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("summary must be a non-empty string")

    sources_used = result.get("sources_used")

    if not isinstance(
        sources_used,
        list,
    ):
        raise ValueError("sources_used must be an array")


async def _execute_tool(
    tool_calls: list[dict[str, Any]],
    user_context: dict[str, Any] | None = None,
) -> Any:

    request_body: dict[str, Any] = {"tool_calls": tool_calls}

    if user_context is not None:
        request_body["user_context"] = user_context

    _debug_json(
        "ENGINE REQUEST",
        request_body,
    )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                (f"{ENGINE_URL}" "/tools/execute"),
                json=request_body,
                timeout=ENGINE_TOOL_TIMEOUT,
            )

            _debug(f"Engine HTTP status: " f"{response.status_code}")

            response.raise_for_status()

            result = response.json()

            _debug_json(
                "ENGINE RESPONSE",
                result,
            )

            return result

    except httpx.TimeoutException as error:
        _debug(f"ENGINE TIMEOUT: {error}")

        return {
            "success": False,
            "error": ("The requested capability timed out."),
        }

    except httpx.HTTPError as error:
        _debug(f"ENGINE HTTP ERROR: " f"{type(error).__name__}: " f"{error}")

        return {
            "success": False,
            "error": ("The requested capability could not be completed."),
        }


async def _run_llm_loop(
    messages: list[dict[str, Any]],
    user_context: dict[str, Any] | None = None,
    think: bool = True,
) -> list[Any]:

    conversation: list[Any] = list(messages)

    if not TOOLS:
        _debug("No tools available")
        return conversation

    for round_number in range(
        1,
        MAX_TOOL_ROUNDS + 1,
    ):
        _debug(f"MODEL LOOP " f"{round_number}/" f"{MAX_TOOL_ROUNDS}")

        # initial LLM inference if round_number = 1
        response = await ollama_client.chat(
            model=MODEL,
            messages=conversation,
            tools=TOOLS,
            think=think,
            keep_alive=KEEP_ALIVE,
        )

        conversation.append(response.message)

        if response.message.content:
            _debug("MODEL CONTENT")

            print(
                response.message.content,
                flush=True,
            )

        thinking = getattr(
            response.message,
            "thinking",
            None,
        )

        if thinking:
            _debug("MODEL THINKING")

            print(
                thinking,
                flush=True,
            )

        raw_tool_calls = response.message.tool_calls or []

        if not raw_tool_calls:
            _debug("No Tool requested")
            return conversation

        tool_calls: list[dict[str, Any]] = [
            {
                "tool_name": (tool_call.function.name),
                "arguments": (tool_call.function.arguments or {}),
            }
            for tool_call in raw_tool_calls
        ]

        _debug_json(
            f"Model requested " f"{len(tool_calls)} tool(s)",
            tool_calls,
        )

        engine_tool_response = await _execute_tool(
            tool_calls=tool_calls,
            user_context=user_context,
        )

        _debug_json(
            "TOOL RESULT",
            engine_tool_response,
        )

        if not isinstance(
            engine_tool_response,
            dict,
        ):
            _debug("Invalid Engine response")
            return conversation

        if engine_tool_response.get("success") is False:
            _debug("Tool execution failed. " "Stopping tool loop.")
            for tool_call in tool_calls:
                conversation.append(
                    {
                        "role": "tool",
                        "tool_name": tool_call["tool_name"],
                        "content": json.dumps(
                            engine_tool_response,
                            ensure_ascii=False,
                            default=str,
                        ),
                    }
                )
            return conversation

        tool_results = engine_tool_response.get(
            "results",
            [],
        )

        if not isinstance(
            tool_results,
            list,
        ):
            _debug("Invalid Engine tool results")
            return conversation

        if len(tool_results) != len(tool_calls):
            _debug("Tool result count does not " "match tool call count")
            return conversation

        for tool_call, tool_result in zip(
            tool_calls,
            tool_results,
        ):
            conversation.append(
                {
                    "role": "tool",
                    "tool_name": (tool_call["tool_name"]),
                    "content": json.dumps(
                        tool_result,
                        ensure_ascii=False,
                        default=str,
                    ),
                }
            )

    raise RuntimeError("Maximum tool rounds exceeded: " f"{MAX_TOOL_ROUNDS}")


async def _finalize(
    messages: list[Any],
    think: bool = True,
) -> dict:
    _debug(f"FINALIZING RESPONSE " f"(think={think})")

    final_messages = list(messages)

    final_messages.append(
        {
            "role": "user",
            "content": (
                "Return the final response now. "
                "Be concise and answer only what is relevant to the request. "
                "For chat, normally use no more than 120 words. "
                "Do not narrate your reasoning or internal steps. "
                "Do not explain internal workflows, capabilities, services, APIs, "
                "routing, databases, execution mechanisms, or implementation details. "
                "If farm information could not be retrieved, state what information "
                "was unavailable and how that prevented the requested task in no more "
                "than two sentences. "
                "Do not repeat any fact, limitation, reason, or conclusion. "
                "For a straightforward failure, use one short paragraph. "
                "State unavailable information and its effect on the request once, then stop. "
                "Do not speculate about the cause of unavailable information. "
                "Do not list internal requirements or processing steps. "
                "Return only valid JSON matching the response schema."
            ),
        },
    )

    response = await ollama_client.chat(
        model=MODEL,
        messages=final_messages,
        think=think,
        format=SCHEMA,
        keep_alive=KEEP_ALIVE,
    )

    content = response.message.content

    if not content:
        thinking = getattr(
            response.message,
            "thinking",
            None,
        )

        raise RuntimeError(
            "Ollama returned empty "
            "message.content "
            f"(think={think}). "
            f"Thinking trace: "
            f"{thinking!r}"
        )

    _debug("FINAL RAW RESPONSE")

    if VERBOSE:
        print(
            content,
            flush=True,
        )

    try:
        result = json.loads(content)

        _debug_json(
            "FINAL PARSED RESPONSE",
            result,
        )

        return result

    except json.JSONDecodeError as error:
        raise RuntimeError(
            "Ollama returned invalid JSON: " f"{error}\n" f"Raw response:\n{content}"
        ) from error


async def leafy_ai(
    messages: list[dict[str, Any]],
    user_context: dict[str, Any] | None = None,
) -> dict:
    """
    Run the Leafy AI agent.

    The AI may request capabilities through the
    Engine API.
    """

    if not messages:
        raise ValueError("messages cannot be empty")

    _debug("Starting Leafy AI request")

    _debug_json(
        "INPUT MESSAGES",
        messages,
    )

    if user_context is not None:
        _debug_json(
            "USER CONTEXT",
            user_context,
        )

    conversation = await _run_llm_loop(
        messages=messages,
        user_context=user_context,
        think=True,
    )

    _debug("Tool phase complete")

    last_error = None

    for attempt, think in enumerate(
        [True, False],
        start=1,
    ):
        try:
            result = await _finalize(
                messages=conversation,
                think=think,
            )

            _validate(result)

            _debug("Final response validated")

            return result

        except (
            RuntimeError,
            ValueError,
        ) as error:
            last_error = error

            _debug(
                "Finalization attempt "
                f"{attempt} "
                f"(think={think}) failed: "
                f"{error}"
            )

    raise RuntimeError(
        "leafy_ai failed after retries: " f"{last_error}"
    ) from last_error


async def test_conversation():
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": (
                "add 20 mins more for light schedule both levels and then do a farm check up"
            ),
        },
    ]

    user_context = {
        "user_id": 1,
        "role": "user",
    }

    response = await leafy_ai(
        messages=messages,
        user_context=user_context,
    )

    print("\nFINAL RESULT")

    print(
        json.dumps(
            response,
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    import asyncio

    asyncio.run(test_conversation())
