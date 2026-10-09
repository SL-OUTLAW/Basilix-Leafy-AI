import copy
import json
from typing import Any

from engine.managers.db_manager import run_query

settings: dict[str, Any] = {}

DEFAULT_SETTINGS = {
    "scheduler": {"polling_rate": 5},
    "security": {
        "ai_enabled": True,
        "emergency_stop": False,
        "sensor_check_interval_seconds": 5,
    },
    "risk": {
        "DOSE_EC": "HIGH", "DOSE_PH": "HIGH", "SET_FAN": "LOW",
        "SET_LIGHTING": "LOW", "RUN_IRRIGATION": "HIGH",
        "CREATE_SCHEDULE": "LOW", "ENABLE_SCHEDULE": "LOW",
        "RUN_AI_ANALYSIS": "LOW", "UPDATE_SCHEDULE": "LOW",
        "DISABLE_SCHEDULE": "HIGH", "RUN_VISION_ANALYSIS": "LOW",
    },
    "sensor_security_thresholds": {
        "ec": {"enabled": True, "lower_limit": 1500, "upper_limit": 3000, "warning_distance": 250, "critical_distance": 100},
        "ph": {"enabled": True, "lower_limit": 5.5, "upper_limit": 6.5, "warning_distance": 0.3, "critical_distance": 0.1},
        "humidity": {"enabled": True, "lower_limit": 40, "upper_limit": 80, "warning_distance": 5, "critical_distance": 2},
        "dew_point": {"enabled": False, "lower_limit": 5, "upper_limit": 25, "warning_distance": 3, "critical_distance": 1},
        "water_level": {"enabled": True, "lower_limit": 20, "upper_limit": 100, "warning_distance": 10, "critical_distance": 5},
        "water_temperature": {"enabled": True, "lower_limit": 18, "upper_limit": 28, "warning_distance": 2, "critical_distance": 0.5},
        "ambient_temperature": {"enabled": True, "lower_limit": 15, "upper_limit": 32, "warning_distance": 3, "critical_distance": 1},
    },
    "notifications": {"global_delivery": True, "repeat_critical_notifications": False, "sensor_alert_cooldown_seconds": 300},
    "vision": {"polling_rate": 60},
    "cameras": {"polling_rate": 10},
    "sensors": {"polling_rate": 10},
    "farm_controls": {"outlet_mapping": {"fan": 5, "dose_ec": 6, "dose_ph": 3, "irrigation": 2, "lighting_level_1": 1, "lighting_level_2": 4}},
    "dosing_ph": {"enabled": True, "direction": "UP", "max_cycles": 12, "dose_seconds": 10, "settle_seconds": 300, "target_tolerance": 0.1, "max_total_dose_seconds": 120},
    "dosing_ec": {"enabled": True, "direction": "UP", "max_cycles": 12, "dose_seconds": 10, "settle_seconds": 300, "target_tolerance": 100, "max_total_dose_seconds": 120},
}

PROTECTED_SECURITY_KEYS = {"ai_enabled", "emergency_stop"}


def _merge_defaults(default: Any, value: Any) -> Any:
    if isinstance(default, dict):
        if not isinstance(value, dict):
            return copy.deepcopy(default)
        return {key: _merge_defaults(child, value.get(key)) if key in value else copy.deepcopy(child) for key, child in default.items()}
    if value is None:
        return copy.deepcopy(default)
    if isinstance(default, bool):
        return value if isinstance(value, bool) else copy.deepcopy(default)
    if isinstance(default, (int, float)) and not isinstance(default, bool):
        return value if isinstance(value, (int, float)) and not isinstance(value, bool) else copy.deepcopy(default)
    return value if isinstance(value, type(default)) else copy.deepcopy(default)


def _validate_update(new_settings: dict[str, Any]) -> None:
    unknown = set(new_settings) - set(DEFAULT_SETTINGS)
    if unknown:
        raise ValueError(f"Unknown setting group(s): {', '.join(sorted(unknown))}")
    security = new_settings.get("security")
    if isinstance(security, dict) and PROTECTED_SECURITY_KEYS.intersection(security):
        raise ValueError("AI and emergency state must be changed from the Safety screen.")


async def manage_settings(new_settings=None):
    if new_settings is None:
        rows = await run_query("SELECT setting_key, setting_value FROM system_settings;")
        stored = {key: value for key, value in rows}
        settings.clear()
        for key, default in DEFAULT_SETTINGS.items():
            repaired = _merge_defaults(default, stored.get(key))
            settings[key] = repaired
            if stored.get(key) != repaired:
                await run_query(
                    """
                    INSERT INTO system_settings (setting_key, setting_value, updated_at)
                    VALUES (%s, %s::jsonb, NOW())
                    ON CONFLICT (setting_key)
                    DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
                    """,
                    (key, json.dumps(repaired)),
                )
        return settings

    if not isinstance(new_settings, dict):
        raise ValueError("settings must be an object")

    _validate_update(new_settings)
    current = await manage_settings()

    for key, patch in new_settings.items():
        if not isinstance(patch, dict):
            raise ValueError(f"{key} must be an object")
        merged_input = {**current[key], **patch}
        validated = _merge_defaults(DEFAULT_SETTINGS[key], merged_input)
        await run_query(
            """
            INSERT INTO system_settings (setting_key, setting_value, updated_at)
            VALUES (%s, %s::jsonb, NOW())
            ON CONFLICT (setting_key)
            DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
            """,
            (key, json.dumps(validated)),
        )

    return await manage_settings()


async def reset_settings(setting_key: str | None = None):
    keys = [setting_key] if setting_key else list(DEFAULT_SETTINGS)
    for key in keys:
        if key not in DEFAULT_SETTINGS:
            raise ValueError(f"Unknown setting group: {key}")
        value = copy.deepcopy(DEFAULT_SETTINGS[key])
        if key == "security":
            current = settings.get("security", {})
            value["ai_enabled"] = bool(current.get("ai_enabled", True))
            value["emergency_stop"] = bool(current.get("emergency_stop", False))
        await run_query(
            """
            INSERT INTO system_settings (setting_key, setting_value, updated_at)
            VALUES (%s, %s::jsonb, NOW())
            ON CONFLICT (setting_key)
            DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();
            """,
            (key, json.dumps(value)),
        )
    return await manage_settings()
