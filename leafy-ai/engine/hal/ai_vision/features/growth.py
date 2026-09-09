from datetime import datetime
from pathlib import Path


def get_capture_time(image_path):
    parts = Path(image_path).stem.split("_")

    try:
        return datetime.strptime(
            f"{parts[-2]}_{parts[-1]}",
            "%Y%m%d_%H%M%S"
        )
    except (ValueError, IndexError):
        return None


def calculate_growth(
    previous,
    current,
    previous_image_path,
    current_image_path
):
    if previous["camera"] != current["camera"]:
        return {
            "status": "error",
            "error": "Growth comparison requires images from the same camera."
        }

    previous_time = get_capture_time(previous_image_path)
    current_time = get_capture_time(current_image_path)

    elapsed_days = None

    if previous_time is not None and current_time is not None:
        elapsed_seconds = (
            current_time - previous_time
        ).total_seconds()

        if elapsed_seconds <= 0:
            return {
                "status": "error",
                "error": "Current image must be newer than previous image."
            }

        elapsed_days = elapsed_seconds / 86400

    previous_count = previous["plants"]["count"]
    current_count = current["plants"]["count"]

    previous_canopy = previous["canopy"]
    current_canopy = current["canopy"]

    previous_avg_size = (
        previous["size"]["average_image_area_percent"]
    )
    current_avg_size = (
        current["size"]["average_image_area_percent"]
    )

    previous_median_size = (
        previous["size"]["median_image_area_percent"]
    )
    current_median_size = (
        current["size"]["median_image_area_percent"]
    )

    if (
        previous_avg_size is None
        or current_avg_size is None
        or previous_median_size is None
        or current_median_size is None
    ):
        return {
            "source": "vision",
            "status": "error",
            "error": "Plant size data is unavailable for growth comparison."
        }
    canopy_change = current_canopy - previous_canopy
    average_size_change = current_avg_size - previous_avg_size
    median_size_change = current_median_size - previous_median_size

    return {
        "source": "vision",
        "status": "success",
        "camera": current["camera"],
        "period": {
            "previous_capture": (
                previous_time.isoformat()
                if previous_time else None
            ),
            "current_capture": (
                current_time.isoformat()
                if current_time else None
            ),
            "days": (
                round(elapsed_days, 3)
                if elapsed_days is not None else None
            )
        },
        "growth": {
            "scope": "camera_view_image_space",
            "plant_count": {
                "previous": previous_count,
                "current": current_count,
                "change": current_count - previous_count
            },
            "canopy": {
                "previous_percent": previous_canopy,
                "current_percent": current_canopy,
                "change_percentage_points": round(
                    canopy_change,
                    2
                )
            },
            "average_plant_size": {
                "previous_image_area_percent": previous_avg_size,
                "current_image_area_percent": current_avg_size,
                "change": round(
                    average_size_change,
                    4
                )
            },
            "median_plant_size": {
                "previous_image_area_percent": previous_median_size,
                "current_image_area_percent": current_median_size,
                "change": round(
                    median_size_change,
                    4
                )
            },
            "image_space_rate_per_day": {
                "canopy_percentage_points": (
                    round(
                        canopy_change / elapsed_days,
                        4
                    )
                    if elapsed_days else None
                ),
                "average_image_area_percentage_points": (
                    round(
                        average_size_change / elapsed_days,
                        4
                    )
                    if elapsed_days else None
                ),
                "median_image_area_percentage_points": (
                    round(
                        median_size_change / elapsed_days,
                        4
                    )
                    if elapsed_days else None
                )
            }
        }
    }