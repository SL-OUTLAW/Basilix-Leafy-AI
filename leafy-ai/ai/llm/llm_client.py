import ollama
import json
from pathlib import Path
from typing import Any

from llm_tools import TOOLS, AVAILABLE_TOOLS

MODEL = "qwen3.5:9b-q4_K_M"
MAX_TOOL_ROUNDS = 8
KEEP_ALIVE = -1

DIR = Path(__file__).parent
PROMPT_PATH = DIR / "system_prompt.md"
SCHEMA_PATH = DIR / "schema.json"


def _load_system_prompt(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as e:
        raise RuntimeError(f"System prompt file not found at {path}") from e


def _load_schema(path: Path) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError as e:
        raise RuntimeError(f"Schema file not found at {path}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Schema file at {path} is not valid JSON: {e}") from e


SYSTEM_PROMPT = _load_system_prompt(PROMPT_PATH)
SCHEMA = _load_schema(SCHEMA_PATH)


def _validate(result: dict) -> None:
    if not isinstance(result, dict):
        raise ValueError(f"Expected response to be a dict, got {type(result).__name__}")

    rtype = result.get("response_type")

    if rtype not in {
        "chat",
        "recommended_action",
        "farm_analysis",
    }:
        raise ValueError(f"Invalid response_type={rtype!r}")

    content = result.get("content")
    summary = result.get("summary")

    if not isinstance(content, str) or not content.strip():
        raise ValueError(f"response_type={rtype} requires non-empty content")

    if not isinstance(summary, str) or not summary.strip():
        raise ValueError(f"response_type={rtype} requires non-empty summary")

    sources_used = result.get("sources_used")

    if not isinstance(sources_used, list):
        raise ValueError("sources_used must be an array")

    recommended_actions = result.get("recommended_actions")

    if not isinstance(recommended_actions, list):
        raise ValueError("recommended_actions must be an array")

    if rtype != "recommended_action":
        if recommended_actions:
            raise ValueError(
                f"response_type={rtype} must have empty recommended_actions"
            )
        return

    if not recommended_actions:
        raise ValueError(
            "recommended_action response must have at least one recommendation"
        )

    for i, action in enumerate(recommended_actions):
        if not isinstance(action, dict):
            raise ValueError(f"recommended_actions[{i}] must be an object")

        missing = [
            field
            for field in (
                "recommendation",
                "reason",
                "risk",
                "risk_reason",
            )
            if not action.get(field)
        ]

        if missing:
            raise ValueError(
                f"recommended_actions[{i}] is missing required field(s) "
                f"{missing}: {action!r}"
            )

        if action["risk"] not in {
            "none",
            "low",
            "medium",
            "high",
        }:
            raise ValueError(
                f"Invalid risk in recommended_actions[{i}]: " f"{action['risk']!r}"
            )


def _execute_tool(
    tool_name: str,
    arguments: dict[str, Any],
) -> Any:
    function = AVAILABLE_TOOLS.get(tool_name)

    if function is None:
        return {
            "success": False,
            "error": "The requested capability is unavailable.",
        }

    try:
        return function(**arguments)
    except Exception:
        return {
            "success": False,
            "error": "The requested capability could not be completed.",
        }


def _run_tool_loop(
    messages: list[dict[str, Any]],
    think: bool = True,
) -> list[Any]:
    conversation: list[Any] = list(messages)

    if not TOOLS:
        return conversation

    for _ in range(MAX_TOOL_ROUNDS):
        response = ollama.chat(
            model=MODEL,
            messages=conversation,
            tools=TOOLS,
            think=think,
            keep_alive=KEEP_ALIVE,
        )

        conversation.append(response.message)

        tool_calls = response.message.tool_calls or []

        if not tool_calls:
            return conversation

        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            raw_arguments = tool_call.function.arguments

            if raw_arguments is None:
                arguments = {}
            elif isinstance(raw_arguments, dict):
                arguments = raw_arguments
            else:
                try:
                    arguments = dict(raw_arguments)
                except Exception:
                    arguments = {}

            result = _execute_tool(
                tool_name=tool_name,
                arguments=arguments,
            )

            if isinstance(result, str):
                tool_content = result
            else:
                tool_content = json.dumps(
                    result,
                    ensure_ascii=False,
                )

            conversation.append(
                {
                    "role": "tool",
                    "tool_name": tool_name,
                    "content": tool_content,
                }
            )

    raise RuntimeError(f"Maximum tool rounds exceeded: {MAX_TOOL_ROUNDS}")


def _finalize(
    messages: list[Any],
    think: bool = True,
) -> dict:
    final_messages = list(messages)

    final_messages.append(
        {
            "role": "user",
            "content": (
                "Return the final Leafy response now. "
                "Use the available information and capability results where relevant. "
                "Do not request another capability. "
                "Do not reveal internal capability names, function names, schemas, "
                "arguments, routing, or implementation details. "
                "Describe capabilities only by what they do. "
                "Return only valid JSON matching the response schema."
            ),
        }
    )

    response = ollama.chat(
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
            "Ollama returned empty message.content "
            f"(think={think}). "
            f"Thinking trace: {thinking!r}"
        )

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Ollama returned invalid JSON: {e}\n" f"Raw response:\n{content}"
        ) from e


def leafy_ai(
    messages: list[dict[str, str]],
) -> dict:
    """
    Run the Leafy AI agent, handle tool calls, and return
    a validated structured response.
    """

    if not messages:
        raise ValueError("messages cannot be empty")

    conversation = _run_tool_loop(
        messages=messages,
        think=True,
    )

    last_error = None

    for attempt, think in enumerate(
        [True, False],
        start=1,
    ):
        try:
            result = _finalize(
                messages=conversation,
                think=think,
            )

            _validate(result)

            return result

        except (RuntimeError, ValueError) as e:
            last_error = e
            print(
                f"[Leafy] Finalization attempt "
                f"{attempt} (think={think}) failed: {e}"
            )

    raise RuntimeError(f"leafy_ai failed after retries: {last_error}") from last_error


if __name__ == "__main__":
    response = leafy_ai(
        [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": ("can you tell me a story "),
            },
        ]
    )

    print(
        json.dumps(
            response,
            indent=2,
            ensure_ascii=False,
        )
    )
