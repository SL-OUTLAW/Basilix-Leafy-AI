from engine.managers.settings_manager import settings

VALID_RISK_LEVELS = {
    "LOW",
    "HIGH",
}


def get_action_risk(
    action_type: str,
) -> str:

    risk_settings = settings.get(
        "risk",
        {},
    )

    risk_level = risk_settings.get(action_type)

    if risk_level not in VALID_RISK_LEVELS:
        return "HIGH"

    return risk_level


def requires_approval(
    action_type: str,
) -> bool:

    return get_action_risk(action_type) == "HIGH"
