from typing import Any

from engine.managers.grow_cycle_manager import (
    get_harvest_data as load_harvest_data,
)


async def get_harvest_data(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    limit = arguments.get(
        "limit",
        10,
    )

    include_active = arguments.get(
        "include_active",
        True,
    )

    try:

        limit = int(limit)

    except (
        TypeError,
        ValueError,
    ) as error:

        raise ValueError("limit must be an integer.") from error

    if limit < 1 or limit > 50:

        raise ValueError("limit must be between 1 and 50.")

    if not isinstance(
        include_active,
        bool,
    ):

        raise ValueError("include_active must be a boolean.")

    return await load_harvest_data(
        limit=limit,
        include_active=include_active,
    )
