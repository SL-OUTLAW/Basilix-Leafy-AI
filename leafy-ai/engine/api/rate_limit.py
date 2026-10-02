from fastapi import Request
from slowapi import Limiter


def rate_limit_key(
    request: Request,
) -> str:

    user_id = request.headers.get(
        "X-User-ID"
    )

    if user_id:
        return f"user:{user_id}"

    if request.client is not None:
        return f"ip:{request.client.host}"

    return "unknown"


limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=["300/minute"],
    headers_enabled=False,
)
