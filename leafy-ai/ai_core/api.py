from typing import Any

from fastapi import (
    FastAPI,
    Header,
    HTTPException,
)

from pydantic import BaseModel

from ai_core.main import leafy_ai
from ai_core.llm_auth import validate_token

app = FastAPI(
    title="Leafy AI Core",
)


class AnalyseRequest(BaseModel):

    task: str

    context: dict[str, Any] | None = None


@app.post("/leafy-ai")
async def analyse(
    request: AnalyseRequest,
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

    result = await leafy_ai(
        task=request.task,
        context=request.context,
    )

    return {
        "success": True,
        "result": result,
    }
