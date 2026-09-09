from datetime import datetime, timedelta, timezone
from typing import Any
import statistics

from engine.managers.db_manager import run_query, open_pool, close_pool

import asyncio, selectors

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
        raise ValueError("Timestamp must include a timezone")

    return parsed


def resolve_time_range(
    arguments: dict[str, Any],
) -> tuple[datetime, datetime]:

    time_range = arguments.get("time_range")
    start_time = arguments.get("start_time")
    end_time = arguments.get("end_time")

    if time_range and (start_time is not None or end_time is not None):
        raise ValueError("Use time_range or start_time/end_time, not both")

    if start_time is not None or end_time is not None:

        if start_time is None or end_time is None:
            raise ValueError("start_time and end_time must be provided together")

        start = parse_iso_time(start_time)
        end = parse_iso_time(end_time)

    else:

        selected_range = time_range or "1h"

        duration = TIME_RANGES.get(selected_range)

        if duration is None:
            raise ValueError("Unsupported time range")

        end = datetime.now(timezone.utc)
        start = end - duration

    if start >= end:
        raise ValueError("start_time must be before end_time")

    if end - start > timedelta(days=7):
        raise ValueError("Sensor history cannot exceed 7 days")

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


def calculate_slope(
    values: list[float],
) -> float:

    if len(values) < 2:
        return 0.0

    x = list(range(len(values)))

    mean_x = statistics.mean(x)
    mean_y = statistics.mean(values)

    numerator = sum(
        (x_value - mean_x) * (y_value - mean_y)
        for x_value, y_value in zip(
            x,
            values,
        )
    )

    denominator = sum((x_value - mean_x) ** 2 for x_value in x)

    if denominator == 0:
        return 0.0

    return numerator / denominator


def calculate_trend_direction(
    slope: float,
    values: list[float],
) -> str:

    if len(values) < 2:
        return "INSUFFICIENT_DATA"

    mean_value = statistics.mean(values)

    if mean_value == 0:
        scale = 1.0
    else:
        scale = abs(mean_value)

    normalized_slope = abs(slope) / scale

    threshold = 0.001

    if normalized_slope <= threshold:
        return "STABLE"

    if slope > 0:
        return "RISING"

    return "FALLING"


def calculate_persistence(
    values: list[float],
    slope: float,
) -> bool:

    if len(values) < 3:
        return False

    if slope == 0:
        return False

    if slope > 0:
        increasing = sum(
            1
            for previous, current in zip(
                values,
                values[1:],
            )
            if current >= previous
        )
    else:
        increasing = sum(
            1
            for previous, current in zip(
                values,
                values[1:],
            )
            if current <= previous
        )

    comparisons = len(values) - 1

    return (increasing / comparisons) >= 0.7


def calculate_spikes(
    values: list[float],
) -> int:

    if len(values) < 5:
        return 0

    median = statistics.median(values)

    deviations = [abs(value - median) for value in values]

    mad = statistics.median(deviations)

    if mad == 0:
        return 0

    threshold = 3 * mad

    return sum(1 for value in values if abs(value - median) > threshold)


async def sensor_history(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    sensor_type = arguments.get("sensor_type")

    if sensor_type not in SENSOR_TYPES:
        raise ValueError("Unsupported sensor type")

    start_time, end_time = resolve_time_range(arguments)

    bucket = choose_bucket(
        start_time,
        end_time,
    )

    bucket_query = """
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

    summary_query = """
        SELECT
            AVG(sr.value) FILTER (
                WHERE sr.quality_status = 'VALID'
            ) AS average,

            MIN(sr.value) FILTER (
                WHERE sr.quality_status = 'VALID'
            ) AS minimum,

            MAX(sr.value) FILTER (
                WHERE sr.quality_status = 'VALID'
            ) AS maximum,

            PERCENTILE_CONT(0.5)
                WITHIN GROUP (
                    ORDER BY sr.value
                )
                FILTER (
                    WHERE sr.quality_status = 'VALID'
                ) AS median,

            STDDEV_POP(sr.value) FILTER (
                WHERE sr.quality_status = 'VALID'
            ) AS standard_deviation,

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
            AND sr.recorded_at <= %s;
    """

    rows = await run_query(
        bucket_query,
        (
            bucket,
            sensor_type,
            start_time,
            end_time,
        ),
    )

    summary_rows = await run_query(
        summary_query,
        (
            sensor_type,
            start_time,
            end_time,
        ),
    )

    buckets = [
        {
            "time": row[0].isoformat(),
            "mean": (float(row[1]) if row[1] is not None else None),
            "min": (float(row[2]) if row[2] is not None else None),
            "max": (float(row[3]) if row[3] is not None else None),
            "samples": row[4],
            "valid": row[5],
            "suspect": row[6],
            "invalid": row[7],
        }
        for row in rows
    ]

    summary_row = summary_rows[0] if summary_rows else None

    if summary_row is None:
        raise RuntimeError("Failed to calculate sensor summary")

    overall_average = float(summary_row[0]) if summary_row[0] is not None else None

    overall_minimum = float(summary_row[1]) if summary_row[1] is not None else None

    overall_maximum = float(summary_row[2]) if summary_row[2] is not None else None

    overall_median = float(summary_row[3]) if summary_row[3] is not None else None

    standard_deviation = float(summary_row[4]) if summary_row[4] is not None else None

    sample_count = summary_row[5]
    valid_count = summary_row[6]
    suspect_count = summary_row[7]
    invalid_count = summary_row[8]

    valid_values = [bucket["mean"] for bucket in buckets if bucket["mean"] is not None]

    if valid_values:

        start_value = valid_values[0]
        end_value = valid_values[-1]

        change = end_value - start_value

        slope = calculate_slope(valid_values)

        trend_direction = calculate_trend_direction(
            slope,
            valid_values,
        )

        persistent = calculate_persistence(
            valid_values,
            slope,
        )

        spike_count = calculate_spikes(valid_values)

    else:

        start_value = None
        end_value = None
        change = None
        slope = None
        trend_direction = "INSUFFICIENT_DATA"
        persistent = False
        spike_count = 0

    valid_percentage = (valid_count / sample_count * 100) if sample_count > 0 else 0

    if valid_percentage >= 95:
        quality_status = "GOOD"

    elif valid_percentage >= 80:
        quality_status = "DEGRADED"

    else:
        quality_status = "POOR"

    return {
        "sensor_type": sensor_type,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "bucket_size": bucket,
        "summary": {
            "start_value": start_value,
            "end_value": end_value,
            "average": overall_average,
            "median": overall_median,
            "minimum": overall_minimum,
            "maximum": overall_maximum,
            "standard_deviation": (standard_deviation),
            "sample_count": sample_count,
            "valid_count": valid_count,
            "suspect_count": suspect_count,
            "invalid_count": invalid_count,
            "valid_percentage": (
                round(
                    valid_percentage,
                    2,
                )
            ),
        },
        "trend": {
            "direction": trend_direction,
            "change": change,
            "slope_per_bucket": slope,
            "persistent": persistent,
        },
        "anomalies": {
            "isolated_spike_count": (spike_count),
        },
        "timeline": buckets,
    }


async def main():
    await open_pool()

    try:
        result = await sensor_history(
            {
                "sensor_type": "ph",
                "time_range": "1h",
            }
        )

        print(result)

    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(
        main(),
        loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
    )
