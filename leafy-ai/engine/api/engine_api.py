from typing import Any

from fastapi import (
    APIRouter,
    Header,
    HTTPException,
)

from pydantic import BaseModel

from engine.security.engine_auth import (
    validate_ai_token,
    validate_webapp_token,
)

from engine.managers.settings_manager import (
    manage_settings,
)

from engine.managers.tool_manager import execute_tools as run_tools

router = APIRouter()


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


# tool APIs


@router.post("/tools/execute")
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

    print("hereeeeeeeeeeeeee 11111111", request)

    results = await run_tools(request.tool_calls)

    print("hereeeeeeeeeeeeee 22222222", results)

    return {
        "success": True,
        "results": results,
    }


# settings APIs


@router.get("/settings")
async def get_settings(
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

    if not validate_webapp_token(token):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    current_settings = await manage_settings()

    return {
        "success": True,
        "settings": current_settings,
    }


@router.post("/settings/reload")
async def reload_system_settings(
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

    if not validate_webapp_token(token):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    current_settings = await manage_settings()

    return {
        "success": True,
        "settings": current_settings,
    }


@router.patch("/settings/update")
async def update_system_settings(
    body: SettingsUpdate,
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

    if not validate_webapp_token(token):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    updated_settings = await manage_settings(body.settings)

    return {
        "success": True,
        "settings": updated_settings,
    }
