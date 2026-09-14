from typing import Any
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from engine.security.engine_auth import validate_ai_token, validate_webapp_token

from engine.managers.settings_manager import manage_settings
from engine.managers.db_manager import open_pool


class ToolCall(BaseModel):
    tool_name: str
    arguments: dict[str, Any]


class UserContext(BaseModel):
    user_id: int
    role: str


class ToolCallRequest(BaseModel):
    tool_calls: list[ToolCall]
    user_context: UserContext


class SettingsUpdate(BaseModel):
    settings: dict[str, Any]


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

    if not validate_ai_token(token):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    print(authorization)

    return {
        "success": True,
        "results": [],
    }


# settings apis


@app.get("/settings")
async def get_settings(authorization: str | None = Header(default=None)):

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

    if not validate_webapp_token(token):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    current_settings = await manage_settings()

    return {"success": "True", "settings": current_settings}


@app.post("/settings/reload")
async def manage_system_settings(authorization: str | None = Header(default=None)):

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

    if not validate_webapp_token(token):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    await manage_settings()

    return {"success": True}


@app.patch("/settings/update")
async def manage_system_settings(
    body: SettingsUpdate, authorization: str | None = Header(default=None)
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

    if not validate_webapp_token(token):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    new_settings = body.settings

    updated_settings = await manage_settings(new_settings)

    return {"success": "True", "settings": updated_settings}


