from typing import Any


def create_farm_control_handlers(
    hal,
):

    async def set_lighting(
        task: dict[str, Any],
    ) -> dict[str, Any]:

        level_no = task.get("level_no")

        if level_no not in (
            1,
            2,
        ):
            raise ValueError("SET_LIGHTING requires level_no 1 or 2.")

        enabled = task.get(
            "enabled",
            True,
        )

        return await hal.controls.set_lighting(
            level_no=level_no,
            enabled=bool(enabled),
        )

    async def run_irrigation(
        task: dict[str, Any],
    ) -> dict[str, Any]:

        enabled = task.get(
            "enabled",
            True,
        )

        return await hal.controls.set_irrigation(
            enabled=bool(enabled),
        )

    async def set_fan(
        task: dict[str, Any],
    ) -> dict[str, Any]:

        enabled = task.get(
            "enabled",
            True,
        )

        return await hal.controls.set_fan(
            enabled=bool(enabled),
        )

    async def dose_ph(
        task: dict[str, Any],
    ) -> dict[str, Any]:

        target = task.get("target_value")

        if target is None:
            raise ValueError("DOSE_PH requires target_value.")

        try:
            target = float(target)

        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError("DOSE_PH target_value must be numeric.") from error

        return await hal.controls.dose_ph_to_target(
            target=target,
        )

    async def dose_ec(
        task: dict[str, Any],
    ) -> dict[str, Any]:

        target = task.get("target_value")

        if target is None:
            raise ValueError("DOSE_EC requires target_value.")

        try:
            target = float(target)

        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError("DOSE_EC target_value must be numeric.") from error

        return await hal.controls.dose_ec_to_target(
            target=target,
        )

    return {
        "SET_LIGHTING": set_lighting,
        "RUN_IRRIGATION": run_irrigation,
        "SET_FAN": set_fan,
        "DOSE_PH": dose_ph,
        "DOSE_EC": dose_ec,
    }
