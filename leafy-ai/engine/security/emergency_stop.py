from engine.managers.settings_manager import settings


def emergency_stop_active() -> bool:

    security = settings.get(
        "security",
        {},
    )

    return bool(
        security.get(
            "emergency_stop",
            False,
        )
    )


def ai_enabled() -> bool:

    security = settings.get(
        "security",
        {},
    )

    if security.get(
        "emergency_stop",
        False,
    ):
        return False

    return bool(
        security.get(
            "ai_enabled",
            True,
        )
    )
