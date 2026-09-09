from typing import Any
import asyncio

TOOL_LIST = {}


async def execute_tool(
    tool_name: str,
    arguments: dict[str, Any],
    user_context: dict[str, Any] | None = None,
) -> dict[str, Any]:

    tool = TOOL_LIST.get(tool_name)

    if tool is None:
        return {
            "tool_name": tool_name,
            "success": False,
            "error": "Unsupported tool",
        }

    try:
        result = await tool(
            arguments=arguments,
            user_context=user_context,
        )

        return {
            "tool_name": tool_name,
            "success": True,
            "result": result,
        }

    except Exception as error:
        return {
            "tool_name": tool_name,
            "success": False,
            "error": str(error),
        }


async def execute_tools(
    tool_calls: list[dict[str, Any]],
    user_context: dict[str, Any] | None = None,
) -> dict[str, Any]:

    tasks = [
        asyncio.create_task(
            execute_tool(
                tool_name=tool_call["tool_name"],
                arguments=tool_call.get(
                    "arguments",
                    {},
                ),
                user_context=user_context,
            )
        )
        for tool_call in tool_calls
    ]

    results = await asyncio.gather(*tasks)

    return {
        "success": True,
        "results": results,
    }
