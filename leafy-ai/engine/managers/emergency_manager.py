from engine.managers.db_manager import run_query
from engine.managers.notifications_manager import (
    create_notification,
)
from engine.managers.settings_manager import (
    manage_settings,
)


async def activate_emergency_stop() -> None:

    await run_query("""
        UPDATE system_settings
        SET
            setting_value =
                jsonb_set(
                    jsonb_set(
                        setting_value,
                        '{emergency_stop}',
                        'true'::jsonb
                    ),
                    '{ai_enabled}',
                    'false'::jsonb
                ),
            updated_at = NOW()
        WHERE setting_key = 'security';
        """)

    await manage_settings()

    await create_notification(
        notification_type="EMERGENCY_STOP",
        severity="CRITICAL",
        title="Emergency AI isolation activated",
        message=("Leafy AI has been isolated from the farm system."),
        entity_type="system",
    )


async def clear_emergency_stop() -> None:

    await run_query("""
        UPDATE system_settings
        SET
            setting_value =
                jsonb_set(
                    setting_value,
                    '{emergency_stop}',
                    'false'::jsonb
                ),
            updated_at = NOW()
        WHERE setting_key = 'security';
        """)

    await manage_settings()

    await create_notification(
        notification_type="EMERGENCY_STOP_CLEARED",
        severity="INFO",
        title="Emergency AI isolation cleared",
        message=(
            "Emergency AI isolation has been cleared. "
            "AI remains disabled until explicitly re-enabled."
        ),
        entity_type="system",
    )


async def enable_ai() -> None:

    await run_query("""
        UPDATE system_settings
        SET
            setting_value =
                jsonb_set(
                    setting_value,
                    '{ai_enabled}',
                    'true'::jsonb
                ),
            updated_at = NOW()
        WHERE setting_key = 'security'
          AND (
              setting_value->>'emergency_stop'
          )::boolean = FALSE;
        """)

    await manage_settings()


async def disable_ai() -> None:

    await run_query("""
        UPDATE system_settings
        SET
            setting_value =
                jsonb_set(
                    setting_value,
                    '{ai_enabled}',
                    'false'::jsonb
                ),
            updated_at = NOW()
        WHERE setting_key = 'security';
        """)

    await manage_settings()
