from datetime import (
    datetime,
    timedelta,
    timezone,
)
from typing import Any

from engine.managers.db_manager import run_query

TIME_RANGES = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "12h": timedelta(hours=12),
    "24h": timedelta(hours=24),
    "3d": timedelta(days=3),
    "7d": timedelta(days=7),
}


def resolve_time_range(
    arguments: dict[str, Any],
) -> tuple[datetime, datetime]:

    time_range = arguments.get(
        "time_range",
        "24h",
    )

    duration = TIME_RANGES.get(time_range)

    if duration is None:
        raise ValueError("Unsupported time range")

    end_time = datetime.now(timezone.utc)

    start_time = end_time - duration

    return start_time, end_time


async def camera_analysis_history(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    level_no = arguments.get("level_no")

    if level_no not in (1, 2):
        raise ValueError("level_no must be 1 or 2")

    start_time, end_time = resolve_time_range(arguments)

    camera_rows = await run_query(
        """
        SELECT
            camera_id,
            camera_name
        FROM cameras
        WHERE
            level_no = %s
            AND status = 'ACTIVE'
        ORDER BY camera_id ASC;
        """,
        (level_no,),
    )

    cameras = {row[0]: row[1] for row in camera_rows}

    query = """
        SELECT
            hourly.bucket_start,

            hourly.image_id,
            hourly.captured_at,

            hourly.camera_id,
            hourly.camera_name,

            hourly.analysis_id,
            hourly.analysis_created_at,

            hourly.model_name,
            hourly.analysis

        FROM (
            SELECT DISTINCT ON (
                time_bucket(
                    '1 hour',
                    pi.captured_at
                ),
                c.camera_id
            )

                time_bucket(
                    '1 hour',
                    pi.captured_at
                ) AS bucket_start,

                pi.image_id,
                pi.captured_at,

                c.camera_id,
                c.camera_name,

                pia.analysis_id,

                pia.created_at
                    AS analysis_created_at,

                pia.model_name,
                pia.analysis

            FROM plant_image_analysis pia

            JOIN plant_images pi
                ON pi.image_id = pia.image_id

            JOIN cameras c
                ON c.camera_id = pi.camera_id

            WHERE
                c.level_no = %s

                AND c.status = 'ACTIVE'

                AND pi.captured_at >= %s

                AND pi.captured_at <= %s

            ORDER BY
                time_bucket(
                    '1 hour',
                    pi.captured_at
                ) ASC,

                c.camera_id ASC,

                pi.captured_at DESC,

                pia.created_at DESC
        ) AS hourly

        ORDER BY
            hourly.bucket_start ASC,
            hourly.camera_id ASC;
    """

    rows = await run_query(
        query,
        (
            level_no,
            start_time,
            end_time,
        ),
    )

    hourly_buckets: dict[
        datetime,
        dict[str, Any],
    ] = {}

    for row in rows:

        bucket_start = row[0]

        if bucket_start not in hourly_buckets:
            hourly_buckets[bucket_start] = {
                "start": (bucket_start.isoformat()),
                "cameras": [],
            }

        hourly_buckets[bucket_start]["cameras"].append(
            {
                "camera_id": row[3],
                "camera_name": row[4],
                "image_id": row[1],
                "captured_at": (row[2].isoformat()),
                "analysis_id": row[5],
                "analysis_created_at": (row[6].isoformat()),
                "model_name": row[7],
                "analysis": row[8],
            }
        )

    timeline = []

    expected_camera_ids = set(cameras.keys())

    for bucket in hourly_buckets.values():

        observed_camera_ids = {camera["camera_id"] for camera in bucket["cameras"]}

        missing_camera_ids = expected_camera_ids - observed_camera_ids

        missing_cameras = [
            {
                "camera_id": camera_id,
                "camera_name": (cameras[camera_id]),
            }
            for camera_id in sorted(missing_camera_ids)
        ]

        bucket["summary"] = {
            "camera_count": len(observed_camera_ids),
            "expected_camera_count": len(expected_camera_ids),
            "complete": (observed_camera_ids == expected_camera_ids),
            "missing_cameras": (missing_cameras),
        }

        timeline.append(bucket)

    analysis_count = sum(len(bucket["cameras"]) for bucket in timeline)

    complete_hour_count = sum(1 for bucket in timeline if bucket["summary"]["complete"])

    incomplete_hour_count = len(timeline) - complete_hour_count

    cameras_with_analysis = {
        camera["camera_id"] for bucket in timeline for camera in bucket["cameras"]
    }

    cameras_without_analysis = [
        {
            "camera_id": camera_id,
            "camera_name": (cameras[camera_id]),
        }
        for camera_id in sorted(expected_camera_ids - cameras_with_analysis)
    ]

    return {
        "level_no": level_no,
        "start_time": (start_time.isoformat()),
        "end_time": (end_time.isoformat()),
        "time_range": arguments.get(
            "time_range",
            "24h",
        ),
        "bucket_size": "1 hour",
        "summary": {
            "camera_count": len(cameras),
            "hour_count": len(timeline),
            "analysis_count": (analysis_count),
            "complete_hour_count": (complete_hour_count),
            "incomplete_hour_count": (incomplete_hour_count),
            "cameras_without_analysis": (cameras_without_analysis),
        },
        "timeline": timeline,
    }
