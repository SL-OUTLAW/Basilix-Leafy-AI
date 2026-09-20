import asyncio
from typing import Any


from engine.managers.db_manager import run_query
from engine.managers.notifications_manager import (
    create_notification,
    resolve_sensor_notification,
)
from engine.managers.settings_manager import settings

loop = False


def _get_thresholds() -> dict[str, Any]:

    return settings.get(
        "sensor_security_thresholds",
        {},
    )


def _get_security_settings() -> dict[str, Any]:

    return settings.get(
        "security",
        {},
    )


def _calculate_alert_level(
    value: float,
    threshold: dict[str, Any],
) -> str:

    lower_limit = threshold.get("lower_limit")

    upper_limit = threshold.get("upper_limit")

    warning_distance = threshold.get("warning_distance")

    critical_distance = threshold.get("critical_distance")

    if any(
        value is None
        for value in (
            lower_limit,
            upper_limit,
            warning_distance,
            critical_distance,
        )
    ):
        return "NORMAL"

    if value <= lower_limit or value >= upper_limit:
        return "CRITICAL"

    distance_to_lower = value - lower_limit

    distance_to_upper = upper_limit - value

    nearest_distance = min(
        distance_to_lower,
        distance_to_upper,
    )

    if nearest_distance <= critical_distance:
        return "CRITICAL"

    if nearest_distance <= warning_distance:
        return "WARN"

    return "NORMAL"


async def _get_alert_state(
    sensor_id: int,
) -> str:

    rows = await run_query(
        """
        SELECT
            alert_level
        FROM sensor_alert_state
        WHERE sensor_id = %s;
        """,
        (sensor_id,),
    )

    if not rows:
        return "NORMAL"

    return rows[0][0]


async def _save_alert_state(
    sensor_id: int,
    alert_level: str,
    value: float,
    quality_status: str,
    notification_created: bool,
) -> None:

    await run_query(
        """
        INSERT INTO sensor_alert_state (
            sensor_id,
            alert_level,
            last_value,
            last_quality_status,
            last_checked_at,
            last_notification_at,
            updated_at
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            NOW(),
            CASE
                WHEN %s
                THEN NOW()
                ELSE NULL
            END,
            NOW()
        )
        ON CONFLICT (
            sensor_id
        )
        DO UPDATE SET
            alert_level = EXCLUDED.alert_level,
            last_value = EXCLUDED.last_value,
            last_quality_status = EXCLUDED.last_quality_status,
            last_checked_at = NOW(),

            last_notification_at =
                CASE
                    WHEN %s
                    THEN NOW()
                    ELSE sensor_alert_state.last_notification_at
                END,

            updated_at = NOW();
        """,
        (
            sensor_id,
            alert_level,
            value,
            quality_status,
            notification_created,
            notification_created,
        ),
    )


async def _get_sensor_id(
    sensor_type: str,
) -> int | None:

    rows = await run_query(
        """
        SELECT
            sensor_id
        FROM sensors
        WHERE sensor_type = %s
          AND status = 'ACTIVE'
        ORDER BY sensor_id
        LIMIT 1;
        """,
        (sensor_type,),
    )

    if not rows:
        return None

    return rows[0][0]


async def _check_sensor(
    sensor_type: str,
    reading: dict[str, Any],
) -> None:

    threshold = _get_thresholds().get(sensor_type)

    if not isinstance(
        threshold,
        dict,
    ):
        return

    if not threshold.get(
        "enabled",
        False,
    ):
        return

    value = reading.get("value")

    valid = reading.get("valid")

    if not isinstance(
        value,
        (
            int,
            float,
        ),
    ):
        return

    if valid is not True:
        return

    sensor_id = reading.get("sensor_id")

    if sensor_id is None:

        sensor_id = await _get_sensor_id(sensor_type)

    if sensor_id is None:
        return

    previous_level = await _get_alert_state(sensor_id)

    alert_level = _calculate_alert_level(
        float(value),
        threshold,
    )

    notification_created = False

    if alert_level == previous_level:

        await _save_alert_state(
            sensor_id=sensor_id,
            alert_level=alert_level,
            value=float(value),
            quality_status="VALID",
            notification_created=False,
        )

        return

    if alert_level == "NORMAL":

        if previous_level != "NORMAL":

            await resolve_sensor_notification(sensor_id)

            await create_notification(
                notification_type="SENSOR_RECOVERED",
                severity="INFO",
                title=f"{sensor_type} returned to normal",
                message=(
                    f"{sensor_type} returned to the configured "
                    f"normal operating range."
                ),
                entity_type="sensor",
                entity_id=sensor_id,
                metadata={
                    "sensor_type": sensor_type,
                    "value": value,
                    "unit": reading.get("unit"),
                    "previous_alert_level": previous_level,
                },
            )

            notification_created = True

    else:

        await resolve_sensor_notification(sensor_id)

        title = (
            f"{sensor_type} critical threshold"
            if alert_level == "CRITICAL"
            else f"{sensor_type} warning threshold"
        )

        message = (
            f"{sensor_type} is approaching or has reached "
            f"a configured safety threshold."
        )

        await create_notification(
            notification_type="SENSOR_THRESHOLD",
            severity=alert_level,
            title=title,
            message=message,
            entity_type="sensor",
            entity_id=sensor_id,
            metadata={
                "sensor_type": sensor_type,
                "value": value,
                "unit": reading.get("unit"),
                "lower_limit": threshold.get("lower_limit"),
                "upper_limit": threshold.get("upper_limit"),
                "warning_distance": threshold.get("warning_distance"),
                "critical_distance": threshold.get("critical_distance"),
                "previous_alert_level": previous_level,
                "alert_level": alert_level,
            },
        )

        notification_created = True

    await _save_alert_state(
        sensor_id=sensor_id,
        alert_level=alert_level,
        value=float(value),
        quality_status="VALID",
        notification_created=notification_created,
    )


async def check_sensors(
    hal,
) -> None:

    latest = hal.sensors.latest()

    if not isinstance(
        latest,
        dict,
    ):
        return

    await asyncio.gather(
        *[
            _check_sensor(
                sensor_type,
                reading,
            )
            for sensor_type, reading in latest.items()
            if isinstance(
                reading,
                dict,
            )
        ]
    )


async def start(
    hal,
) -> None:

    global loop

    loop = True

    while loop:

        try:

            await check_sensors(hal)

        except Exception:
            pass

        polling_rate = _get_security_settings().get(
            "sensor_check_interval_seconds",
            5,
        )

        await asyncio.sleep(polling_rate)


async def stop() -> None:

    global loop

    loop = False
