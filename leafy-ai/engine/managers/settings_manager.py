import json

from managers.db_manager import run_query

settings = {}

async def manage_settings(new_settings=None):
    if new_settings is None:
        rows = await run_query(
            """
            SELECT setting_key, setting_value
            FROM system_settings;
            """
        )

        settings.clear()

        for key, value in rows:
            settings[key] = value

        return settings

    for key, value in new_settings.items():
        await run_query(
            """
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES (%s, %s::jsonb)
            ON CONFLICT (setting_key)
            DO UPDATE SET setting_value = EXCLUDED.setting_value;
            """,
            (key, json.dumps(value)),
        )

    settings.update(new_settings)

    return settings
