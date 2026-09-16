from typing import Any
import asyncio

from engine.tools.rag_tool.rag_tool import search_chunks
from engine.tools.camera_analysis_history import camera_analysis_history
from engine.tools.create_recommendations import create_recommendations
from engine.tools.daily_farm_schedule import daily_farm_schedule
from engine.tools.sensor_history import sensor_history
from engine.tools.pending_approvals import pending_approvals
from engine.tools.pending_recommendations import pending_recommendations

TOOL_LIST = {
    "sensor_history": sensor_history,
    "rag_tool": search_chunks,
    "camera_analysis_history": camera_analysis_history,
    "create_recommendations": create_recommendations,
    "daily_farm_schedule": daily_farm_schedule,
    "pending_approvals": pending_approvals,
    "pending_recommendations": pending_recommendations,
}

# TODO : RAG TOOL NOT SETTING SOURCE RIGHT
# TODO : CREATE RECOMMENDATION NOT POPULATING THE DB CORRECTLY

async def execute_tool(
    tool_name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:

    print("hererererer 22222")
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

    print("herereereree 111")

    tasks = [
        asyncio.create_task(
            execute_tool(tool_name=tool_call.tool_name, arguments=tool_call.arguments),
        )
        for tool_call in tool_calls
    ]

    results = await asyncio.gather(*tasks)

    return results
