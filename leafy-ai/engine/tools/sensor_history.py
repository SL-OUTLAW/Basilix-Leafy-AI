from datetime import datetime, timedelta, timezone
from typing import Any

from engine.managers.db_manager import run_query


TIME_RANGES = {
    "15m": timedelta(minutes=15),
    "30m": timedelta(minutes=30),
    "1h": timedelta(hours=1),
    "3h": timedelta(hours=3),
    "6h": timedelta(hours=6),
    "12h": timedelta(hours=12),
    "24h": timedelta(hours=24),
    "3d": timedelta(days=3),
    "7d": timedelta(days=7),
}


SENSOR_TYPES = {
    "ph",
    "ec",
    "water_temperature",
}


def parse_iso_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)

    if parsed.tzinfo is None:
        raise ValueError(
            "Timestamp must include a timezone"
        )

    return parsed


def resolve_time_range(
    arguments: dict[str, Any],
) -> tuple[datetime, datetime]:

    time_range = arguments.get("time_range")
    start_time = arguments.get("start_time")
    end_time = arguments.get("end_time")

    if time_range and (
        start_time is not None
        or end_time is not None
    ):
        raise ValueError(
            "Use time_range or start_time/end_time, not both"
        )

    if (
        start_time is not None
        or end_time is not None
    ):
        if (
            start_time is None
            or end_time is None
        ):
            raise ValueError(
                "start_time and end_time must be provided together"
            )

        start = parse_iso_time(start_time)
        end = parse_iso_time(end_time)

    else:
        selected_range = time_range or "1h"

        duration = TIME_RANGES.get(
            selected_range
        )

        if duration is None:
            raise ValueError(
                "Unsupported time range"
            )

        end = datetime.now(timezone.utc)
        start = end - duration

    if start >= end:
        raise ValueError(
            "start_time must be before end_time"
        )

    if end - start > timedelta(days=7):
        raise ValueError(
            "Sensor history cannot exceed 7 days"
        )

    return start, end


def choose_bucket(
    start: datetime,
    end: datetime,
) -> str:

    duration = end - start

    if duration <= timedelta(minutes=30):
        return "1 minute"

    if duration <= timedelta(hours=3):
        return "5 minutes"

    if duration <= timedelta(hours=12):
        return "15 minutes"

    if duration <= timedelta(days=1):
        return "30 minutes"

    if duration <= timedelta(days=3):
        return "1 hour"

    return "3 hours"


async def sensor_history(
    arguments: dict[str, Any],
    user_context: dict[str, Any] | None = None,
) -> dict[str, Any]:

    sensor_type = arguments.get(
        "sensor_type"
    )

    if sensor_type not in SENSOR_TYPES:
        raise ValueError(
            "Unsupported sensor type"
        )

    start_time, end_time = resolve_time_range(
        arguments
    )

    bucket = choose_bucket(
        start_time,
        end_time,
    )

    query = """
        SELECT
            time_bucket(
                %s::interval,
                sr.recorded_at
            ) AS bucket_start,

            AVG(sr.value) FILTER (
                WHERE sr.quality_status = 'VALID'
            ) AS average,

            MIN(sr.value) FILTER (
                WHERE sr.quality_status = 'VALID'
            ) AS minimum,

            MAX(sr.value) FILTER (
                WHERE sr.quality_status = 'VALID'
            ) AS maximum,

            COUNT(*) AS sample_count,

            COUNT(*) FILTER (
                WHERE sr.quality_status = 'VALID'
            ) AS valid_count,

            COUNT(*) FILTER (
                WHERE sr.quality_status = 'SUSPECT'
            ) AS suspect_count,

            COUNT(*) FILTER (
                WHERE sr.quality_status = 'INVALID'
            ) AS invalid_count

        FROM sensor_readings sr

        JOIN sensors s
            ON s.sensor_id = sr.sensor_id

        WHERE
            s.sensor_type = %s
            AND sr.recorded_at >= %s
            AND sr.recorded_at <= %s

        GROUP BY bucket_start

        ORDER BY bucket_start ASC;
    """

    rows = await run_query(
        query,
        (
            bucket,
            sensor_type,
            start_time,
            end_time,
        ),
    )

    buckets = [
        {
            "start": row[0].isoformat(),
            "average": (
                float(row[1])
                if row[1] is not None
                else None
            ),
            "minimum": (
                float(row[2])
                if row[2] is not None
                else None
            ),
            "maximum": (
                float(row[3])
                if row[3] is not None
                else None
            ),
            "sample_count": row[4],
            "valid_count": row[5],
            "suspect_count": row[6],
            "invalid_count": row[7],
        }
        for row in rows
    ]

    valid_averages = [
        item["average"]
        for item in buckets
        if item["average"] is not None
    ]

    if valid_averages:
        start_value = valid_averages[0]
        end_value = valid_averages[-1]

        overall_average = (
            sum(valid_averages)
            / len(valid_averages)
        )

        minimum = min(valid_averages)
        maximum = max(valid_averages)

    else:
        start_value = None
        end_value = None
        overall_average = None
        minimum = None
        maximum = None

    return {
        "sensor_type": sensor_type,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "bucket_size": bucket,
        "summary": {
            "start_value": start_value,
            "end_value": end_value,
            "average": overall_average,
            "minimum": minimum,
            "maximum": maximum,
            "bucket_count": len(buckets),
            "sample_count": sum(
                item["sample_count"]
                for item in buckets
            ),
            "valid_count": sum(
                item["valid_count"]
                for item in buckets
            ),
            "suspect_count": sum(
                item["suspect_count"]
                for item in buckets
            ),
            "invalid_count": sum(
                item["invalid_count"]
                for item in buckets
            ),
        },
        "timeline": buckets,
    }