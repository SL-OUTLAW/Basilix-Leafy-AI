# TODO: add tools :)

from typing import Any, Callable


def test_tool(message: str) -> dict[str, Any]:
    """
    Test tool used to test Leafy AI's native tool-calling flow.

    """
    return {
        "success": True,
        "message_received": message,
        "result": "Test tool executed successfully.",
    }


# Example
# def get_weather(city: str) -> dict:
#     """
#     Get the weather for a city.
#
#     Args:
#         city: Name of the city.
#
#     Returns:
#         Weather information.
#     """
#
#     return {
#         "city": city,
#         "temperature": 25,
#     }
#
#
# TOOLS = [
#     get_weather,
# ]
#
#
# AVAILABLE_TOOLS = {
#     tool.__name__: tool
#     for tool in TOOLS
# }
#


TOOLS: list[Callable[..., Any]] = [test_tool]

AVAILABLE_TOOLS: dict[str, Callable[..., Any]] = {tool.__name__: tool for tool in TOOLS}
