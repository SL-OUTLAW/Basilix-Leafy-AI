import time, uuid, os, dotenv

from pathlib import Path

import jwt

dotenv.load_dotenv()

AI_CORE_PRIVATE_KEY_PATH = os.getenv(
    "AI_CORE_PRIVATE_KEY_PATH",
    "/run/secrets/ai_core_private_key",
)

SECURITY_PUBLIC_KEY_PATH = os.getenv(
    "SECURITY_PUBLIC_KEY_PATH",
    "/run/secrets/security_public_key",
)

# paths docker ready

ai_core_key = Path(AI_CORE_PRIVATE_KEY_PATH).read_bytes()
security_key = Path(SECURITY_PUBLIC_KEY_PATH).read_bytes()


def create_token() -> str:

    now = int(time.time())

    payload = {
        "sub": "ai_core",
        "iss": "ai_core",
        "aud": "security",
        "iat": now,
        "exp": now + 180,
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(payload=payload, key=ai_core_key, algorithm="EdDSA")
    print("[CREATED TOKEN]\n",token)
    return token


def validate_token(token) -> str:
    try:
        claims = jwt.decode(
            token,
            key=security_key,
            algorithms=["EdDSA"],
            issuer="security",
            audience="ai_core",
            subject="ai_core",
        )

        return claims

    except jwt.InvalidTokenError as e:
        print(e)
        return None
