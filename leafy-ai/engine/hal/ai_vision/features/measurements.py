import numpy as np


def add_plant_spacing(plants):
    for i, plant in enumerate(plants):
        nearest_distance = None

        x1 = plant["center"]["x"]
        y1 = plant["center"]["y"]

        for j, other in enumerate(plants):
            if i == j:
                continue

            x2 = other["center"]["x"]
            y2 = other["center"]["y"]

            distance = (
                (x2 - x1) ** 2
                + (y2 - y1) ** 2
            ) ** 0.5

            if nearest_distance is None or distance < nearest_distance:
                nearest_distance = distance

        plant["nearest_spacing_pixels"] = (
            round(nearest_distance, 2)
            if nearest_distance is not None
            else None
        )


def calculate_crowding(plants):
    if len(plants) < 2:
        return {
            "average_nearest_distance_pixels": None,
            "average_relative_spacing": None
        }

    nearest_distances = []
    relative_spacings = []

    for i, plant in enumerate(plants):
        nearest_distance = None
        nearest_plant = None

        x1 = plant["center"]["x"]
        y1 = plant["center"]["y"]

        for j, other in enumerate(plants):
            if i == j:
                continue

            x2 = other["center"]["x"]
            y2 = other["center"]["y"]

            distance = (
                (x2 - x1) ** 2
                + (y2 - y1) ** 2
            ) ** 0.5

            if nearest_distance is None or distance < nearest_distance:
                nearest_distance = distance
                nearest_plant = other

        if nearest_distance is None:
            continue

        nearest_distances.append(nearest_distance)

        area1 = plant["area_pixels"]
        area2 = nearest_plant["area_pixels"]

        if area1 and area2:
            diameter1 = 2 * np.sqrt(area1 / np.pi)
            diameter2 = 2 * np.sqrt(area2 / np.pi)

            average_diameter = (
                diameter1 + diameter2
            ) / 2

            relative_spacings.append(
                nearest_distance / average_diameter
            )

    return {
        "average_nearest_distance_pixels": round(
            sum(nearest_distances) / len(nearest_distances),
            2
        ),
        "average_relative_spacing": (
            round(float(
                sum(relative_spacings) / len(relative_spacings)
            ), 3)
            if relative_spacings
            else None
        )
    }


def calculate_size_summary(plants):
    sizes = [
        plant["image_area_percent"]
        for plant in plants
        if plant["image_area_percent"] is not None
    ]

    if not sizes:
        return {
            "average_image_area_percent": None,
            "median_image_area_percent": None,
            "smallest_image_area_percent": None,
            "largest_image_area_percent": None
        }

    return {
        "average_image_area_percent": round(
            sum(sizes) / len(sizes),
            4
        ),
        "median_image_area_percent": round(
            float(np.median(sizes)),
            4
        ),
        "smallest_image_area_percent": round(
            min(sizes),
            4
        ),
        "largest_image_area_percent": round(
            max(sizes),
            4
        )
    }
