import time
import uuid
import os
import dotenv

from pathlib import Path
from typing import Any

import jwt

dotenv.load_dotenv()


AI_CORE_PUBLIC_KEY_PATH = os.getenv(
    "AI_CORE_PUBLIC_KEY_PATH",
    "/run/secrets/ai_core_public_key",
)

SECURITY_PRIVATE_KEY_PATH = os.getenv(
    "SECURITY_PRIVATE_KEY_PATH",
    "/run/secrets/security_private_key",
)


ai_core_public_key = Path(AI_CORE_PUBLIC_KEY_PATH).read_bytes()

security_private_key = Path(SECURITY_PRIVATE_KEY_PATH).read_bytes()


def create_token() -> str:

    now = int(time.time())

    payload = {
        "sub": "security",
        "iss": "security",
        "aud": "ai_core",
        "iat": now,
        "exp": now + 180,
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(
        payload=payload,
        key=security_private_key,
        algorithm="EdDSA",
    )


def validate_token(
    token: str,
) -> dict[str, Any] | None:

    try:
        claims = jwt.decode(
            token,
            key=ai_core_public_key,
            algorithms=["EdDSA"],
            issuer="ai_core",
            audience="security",
            subject="ai_core",
        )

        return claims

    except jwt.InvalidTokenError as error:
        print(error)
        return None
