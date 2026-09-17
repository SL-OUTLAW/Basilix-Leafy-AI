import json
from pathlib import Path
from typing import Any

import ollama

from ai_core.llm_tools import TOOLS
from ai_core.llm_api import execute_tool

MODEL = "leafy-ai"
MAX_TOOL_ROUNDS = 10
KEEP_ALIVE = -1

ollama_client = ollama.AsyncClient()

DIR = Path(__file__).parent
PROMPT_PATH = DIR / "system_prompt.md"
SCHEMA_PATH = DIR / "schema.json"


class LeafyAIError(Exception):
    pass


class LeafyAIConfigurationError(LeafyAIError):
    pass


class LeafyAIToolError(LeafyAIError):
    pass


class LeafyAIResponseError(LeafyAIError):
    pass


class LeafyAIExecutionError(LeafyAIError):
    pass


def _load_system_prompt(
    path: Path,
) -> str:

    try:
        return path.read_text(encoding="utf-8")

    except FileNotFoundError as error:
        raise LeafyAIConfigurationError(
            f"System prompt file not found at {path}"
        ) from error

    except OSError as error:
        raise LeafyAIConfigurationError(
            f"Could not read system prompt at {path}"
        ) from error


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
        raise LeafyAIConfigurationError(f"Schema file not found at {path}") from error

    except json.JSONDecodeError as error:
        raise LeafyAIConfigurationError(
            f"Schema file at {path} is not valid JSON: {error}"
        ) from error

    except OSError as error:
        raise LeafyAIConfigurationError(f"Could not read schema at {path}") from error


SYSTEM_PROMPT = _load_system_prompt(PROMPT_PATH)

SCHEMA = _load_schema(SCHEMA_PATH)


def _validate(
    result: dict,
) -> None:

    if not isinstance(
        result,
        dict,
    ):
        raise LeafyAIResponseError(
            f"Expected response to be a dict, got {type(result).__name__}"
        )

    response_type = result.get("response_type")

    if response_type != "leafy_ai":
        raise LeafyAIResponseError(f"Invalid response_type={response_type!r}")

    content = result.get("content")

    if (
        not isinstance(
            content,
            str,
        )
        or not content.strip()
    ):
        raise LeafyAIResponseError("content must be a non-empty string")

    sources_used = result.get("sources_used")

    if not isinstance(
        sources_used,
        list,
    ):
        raise LeafyAIResponseError("sources_used must be an array")

    for source in sources_used:

        if (
            not isinstance(
                source,
                str,
            )
            or not source.strip()
        ):
            raise LeafyAIResponseError("sources_used must contain non-empty strings")


def _normalize_tool_arguments(
    tool_name: str,
    arguments: Any,
) -> dict[str, Any]:

    if arguments is None:
        return {}

    if isinstance(
        arguments,
        str,
    ):

        try:
            arguments = json.loads(arguments)

        except json.JSONDecodeError as error:
            raise LeafyAIToolError(
                f"Invalid tool arguments for {tool_name}: {error}"
            ) from error

    if not isinstance(
        arguments,
        dict,
    ):
        raise LeafyAIToolError(f"Tool arguments for {tool_name} must be an object")

    return arguments


async def _run_llm_loop(
    task: str,
    context: dict[str, Any] | None = None,
    think: bool = True,
) -> tuple[
    list[Any],
    list[str],
]:

    conversation: list[Any] = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "system",
            "content": (
                "The main Leafy system has assigned "
                "the following task:\n\n"
                f"{task}"
            ),
        },
    ]

    if context is not None:
        conversation.append(
            {
                "role": "system",
                "content": (
                    "Additional task context:\n\n"
                    f"{json.dumps(context, ensure_ascii=False, default=str)}"
                ),
            }
        )

    rag_sources: list[str] = []

    if not TOOLS:
        return (
            conversation,
            rag_sources,
        )

    for round_number in range(
        1,
        MAX_TOOL_ROUNDS + 1,
    ):

        try:
            response = await ollama_client.chat(
                model=MODEL,
                messages=conversation,
                tools=TOOLS,
                think=think,
                keep_alive=KEEP_ALIVE,
            )

        except Exception as error:
            raise LeafyAIExecutionError(f"LLM inference failed: {error}") from error

        conversation.append(response.message)

        raw_tool_calls = response.message.tool_calls or []

        if not raw_tool_calls:
            return (
                conversation,
                rag_sources,
            )

        tool_calls = []

        for tool_call in raw_tool_calls:

            tool_name = tool_call.function.name

            arguments = _normalize_tool_arguments(
                tool_name=tool_name,
                arguments=tool_call.function.arguments,
            )

            tool_calls.append(
                {
                    "tool_name": tool_name,
                    "arguments": arguments,
                }
            )

        try:
            engine_tool_response = await execute_tool(
                tool_calls=tool_calls,
            )

        except Exception as error:
            raise LeafyAIToolError(f"Engine tool request failed: {error}") from error

        if not isinstance(
            engine_tool_response,
            dict,
        ):
            raise LeafyAIToolError("Engine returned an invalid tool response.")

        if engine_tool_response.get("success") is False:
            raise LeafyAIToolError(
                engine_tool_response.get(
                    "error",
                    "Engine tool execution failed",
                )
            )

        tool_results = engine_tool_response.get(
            "results",
            [],
        )

        if not isinstance(
            tool_results,
            list,
        ):
            raise LeafyAIToolError("Invalid Engine tool results")

        if len(tool_results) != len(tool_calls):
            raise LeafyAIToolError("Tool result count does not match tool call count")

        for tool_result in tool_results:

            if tool_result.get("tool_name") != "rag_tool":
                continue

            if not tool_result.get("success"):
                continue

            result = tool_result.get("result")

            if not isinstance(
                result,
                dict,
            ):
                continue

            rag_results = result.get(
                "results",
                [],
            )

            if not isinstance(
                rag_results,
                list,
            ):
                continue

            for source in rag_results:

                if not isinstance(
                    source,
                    dict,
                ):
                    continue

                source_value = source.get("source") or source.get("title")

                if not isinstance(
                    source_value,
                    str,
                ):
                    continue

                source_value = source_value.strip()

                if source_value and source_value not in rag_sources:
                    rag_sources.append(source_value)

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

    raise LeafyAIExecutionError(f"Maximum tool rounds exceeded: {MAX_TOOL_ROUNDS}")


async def _finalize(
    messages: list[Any],
    rag_sources: list[str],
    think: bool = True,
) -> dict:

    final_messages = list(messages)

    final_messages.append(
        {
            "role": "system",
            "content": (
                "Return the final Leafy AI system-brain result now. "
                "This is an internal result for the main Leafy system. "
                "Return relevant farm findings, conclusions, limitations, "
                "and confirmed recommendation outcomes. "
                "Do not narrate internal reasoning or tool execution. "
                "Do not mention APIs, databases, services, routing, or "
                "implementation details. "
                "Return only valid JSON matching the response schema. "
                'response_type must be exactly "leafy_ai". '
                "Do not include summary or any additional fields. "
                f"RAG sources retrieved during this run: "
                f"{json.dumps(rag_sources, ensure_ascii=False)}. "
                "Only use those values for sources_used. "
                "Do not invent sources. "
                "If the list is empty, return sources_used as []."
            ),
        }
    )

    try:
        response = await ollama_client.chat(
            model=MODEL,
            messages=final_messages,
            think=think,
            format=SCHEMA,
            keep_alive=KEEP_ALIVE,
        )

    except Exception as error:
        raise LeafyAIResponseError(f"Final LLM inference failed: {error}") from error

    content = response.message.content

    if not content:
        raise LeafyAIResponseError("Ollama returned empty message.content")

    try:
        result = json.loads(content)

        result["sources_used"] = list(dict.fromkeys(rag_sources))

        return result

    except json.JSONDecodeError as error:
        raise LeafyAIResponseError(f"Ollama returned invalid JSON: {error}") from error


async def leafy_ai(
    task: str,
    context: dict[str, Any] | None = None,
) -> dict:

    if (
        not isinstance(
            task,
            str,
        )
        or not task.strip()
    ):
        raise LeafyAIExecutionError("task cannot be empty")

    conversation, rag_sources = await _run_llm_loop(
        task=task,
        context=context,
        think=True,
    )

    last_error: LeafyAIResponseError | None = None

    for attempt, think in enumerate(
        [
            True,
            False,
        ],
        start=1,
    ):

        try:
            result = await _finalize(
                messages=conversation,
                rag_sources=rag_sources,
                think=think,
            )

            _validate(result)

            return result

        except LeafyAIResponseError as error:
            last_error = error

    raise LeafyAIExecutionError(
        f"Leafy AI failed to produce a valid final response after retries: {last_error}"
    ) from last_error


async def test_conversation():

    response = await leafy_ai(
        task=(
            "this is a tool test. the plants at level 1 show that they are ready to be harvested but cameras are offline let the user know that plants are ready to be harvested by using a harvest recommendation"
        )
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
