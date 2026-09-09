from typing import Any
import asyncio

from tools.sensor_history import sensor_history
from tools.rag_tool.rag_tool import search_chunks

TOOL_LIST = {"sensor_history_tool": sensor_history, "rag_tool": search_chunks}


async def execute_tool(
    tool_name: str,
    arguments: dict[str, Any],
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
) -> dict[str, Any]:

    tasks = [
        asyncio.create_task(
            execute_tool(
                tool_name=tool_call["tool_name"],
                arguments=tool_call.get(
                    "arguments",
                    {},
                ),
            )
        )
        for tool_call in tool_calls
    ]

    results = await asyncio.gather(*tasks)

    return {
        "success": True,
        "results": results,
    }
