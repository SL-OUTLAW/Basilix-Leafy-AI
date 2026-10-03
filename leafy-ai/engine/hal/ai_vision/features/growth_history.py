import numpy as np


MIN_GROWTH_INTERVAL_HOURS = 6.0


def _base_result(status, current_coverage):
    return {
        "status": status,
        "assessment": "not_classified",
        "metric": "canopy_coverage_percent",
        "current_coverage_percent": round(
            float(current_coverage),
            4,
        ),
        "history_samples": 0,
    }


async def get_growth_history(
    image_id,
    current_analysis,
    model_name,
    run_query,
):
    current_coverage = float(
        current_analysis["canopy"]["coverage_percent"]
    )

    rows = await run_query(
        """
        WITH current_image AS (
            SELECT
                image_id,
                camera_id,
                captured_at
            FROM plant_images
            WHERE image_id = %s
        )
        SELECT
            previous_image.image_id,
            previous_image.captured_at,
            previous_analysis.analysis
        FROM current_image
        JOIN plant_images AS previous_image
            ON previous_image.camera_id = current_image.camera_id
            AND previous_image.captured_at < current_image.captured_at
        JOIN plant_image_analysis AS previous_analysis
            ON previous_analysis.image_id = previous_image.image_id
        WHERE previous_analysis.model_name = %s
        ORDER BY previous_image.captured_at DESC
        LIMIT 500;
        """,
        (image_id, model_name),
    )

    if not rows:
        return _base_result(
            "insufficient_history",
            current_coverage,
        )

    metadata = await run_query(
        """
        SELECT
            camera_id,
            captured_at
        FROM plant_images
        WHERE image_id = %s;
        """,
        (image_id,),
    )

    if not metadata:
        return {
            "status": "unavailable",
            "assessment": "not_classified",
            "reason": "current_image_metadata_not_found",
            "metric": "canopy_coverage_percent",
            "current_coverage_percent": round(
                current_coverage,
                4,
            ),
            "history_samples": 0,
        }

    camera_id, current_time = metadata[0]
    history = []

    for previous_image_id, captured_at, previous_analysis in rows:
        if not isinstance(previous_analysis, dict):
            continue

        coverage = previous_analysis.get(
            "canopy",
            {},
        ).get("coverage_percent")

        if coverage is None:
            continue

        try:
            coverage = float(coverage)
        except (TypeError, ValueError):
            continue

        history.append(
            {
                "image_id": int(previous_image_id),
                "captured_at": captured_at,
                "coverage_percent": coverage,
            }
        )

    if not history:
        result = _base_result(
            "insufficient_history",
            current_coverage,
        )
        result["camera_id"] = int(camera_id)
        return result

    eligible = [
        item
        for item in history
        if (
            current_time - item["captured_at"]
        ).total_seconds() / 3600.0
        >= MIN_GROWTH_INTERVAL_HOURS
    ]

    if not eligible:
        result = _base_result(
            "insufficient_timespan",
            current_coverage,
        )
        result.update(
            {
                "camera_id": int(camera_id),
                "history_samples": len(history),
                "minimum_interval_hours": (
                    MIN_GROWTH_INTERVAL_HOURS
                ),
            }
        )
        return result

    previous = eligible[0]
    previous_coverage = previous["coverage_percent"]
    elapsed_hours = (
        current_time - previous["captured_at"]
    ).total_seconds() / 3600.0
    delta = current_coverage - previous_coverage

    relative_change = (
        delta / previous_coverage * 100.0
        if previous_coverage != 0
        else None
    )

    rate_per_day = (
        delta / elapsed_hours * 24.0
        if elapsed_hours > 0
        else None
    )

    result = {
        "status": "available",
        "assessment": "measured_change",
        "scope": "same_camera_image_space",
        "camera_id": int(camera_id),
        "metric": "canopy_coverage_percent",
        "current_coverage_percent": round(
            current_coverage,
            4,
        ),
        "previous_coverage_percent": round(
            previous_coverage,
            4,
        ),
        "coverage_change_percentage_points": round(
            delta,
            4,
        ),
        "relative_coverage_change_percent": (
            round(relative_change, 4)
            if relative_change is not None
            else None
        ),
        "elapsed_hours": round(
            elapsed_hours,
            4,
        ),
        "coverage_rate_percentage_points_per_day": (
            round(rate_per_day, 4)
            if rate_per_day is not None
            else None
        ),
        "history_samples": len(history),
    }

    points = list(reversed(eligible))
    points.append(
        {
            "captured_at": current_time,
            "coverage_percent": current_coverage,
        }
    )

    if len(points) < 4:
        return result

    first_time = points[0]["captured_at"]

    x_days = np.asarray(
        [
            (
                item["captured_at"] - first_time
            ).total_seconds() / 86400.0
            for item in points
        ],
        dtype=np.float64,
    )

    y_coverage = np.asarray(
        [
            item["coverage_percent"]
            for item in points
        ],
        dtype=np.float64,
    )

    if x_days.max() - x_days.min() <= 0:
        return result

    slope, intercept = np.polyfit(
        x_days,
        y_coverage,
        1,
    )

    predicted = slope * x_days + intercept
    residual = y_coverage - predicted
    ss_res = float(np.sum(residual ** 2))
    ss_total = float(
        np.sum(
            (
                y_coverage
                - float(np.mean(y_coverage))
            ) ** 2
        )
    )

    r_squared = (
        1.0 - ss_res / ss_total
        if ss_total > 0
        else None
    )

    result[
        "history_coverage_slope_percentage_points_per_day"
    ] = round(float(slope), 4)

    result["history_regression_r_squared"] = (
        round(float(r_squared), 4)
        if r_squared is not None
        else None
    )

    result["history_span_days"] = round(
        float(x_days.max() - x_days.min()),
        4,
    )

    return result
