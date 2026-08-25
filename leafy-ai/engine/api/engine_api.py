from typing import Any
from fastapi import FastAPI
from pydantic import BaseModel


class ToolCall(BaseModel):
    tool_name: str
    arguments: dict[str, Any]


class UserContext(BaseModel):
    user_id: int
    role: str


class ToolCallRequest(BaseModel):
    tool_calls: list[ToolCall]
    user_context: UserContext


app = FastAPI()


@app.post("/tools/execute")
async def _execute_tools(request: ToolCallRequest):
    print(request.tool_calls)
