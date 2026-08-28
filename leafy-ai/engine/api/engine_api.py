from typing import Any
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import sys

from security.engine_auth import validate_token


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
async def execute_tools(
    request: ToolCallRequest,
    authorization: str | None = Header(default=None),
):
    if authorization is None:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization token",
        )

    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header",
        )

    if not validate_token(token):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    print(authorization)

    return {
        "success": True,
        "results": [],
    }
