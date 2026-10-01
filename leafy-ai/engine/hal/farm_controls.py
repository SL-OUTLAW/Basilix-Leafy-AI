import asyncio

from typing import Any, Awaitable, Callable

from engine.hal.drivers import (
    SixOutletPowerSystem,
)
from engine.managers.settings_manager import settings


class FarmControls:

    def __init__(
        self,
        sensors,
    ):
        self.power = SixOutletPowerSystem(
            use_discovery=False,
        )

        self.sensors = sensors

        self.started = False

        self.latest_state: dict[
            int,
            dict[str, Any],
        ] = {}

    async def start(
        self,
    ) -> None:

        if self.started:
            return

        await self.power.connect()

        self.started = True

        await self.refresh_state()

    async def stop(
        self,
    ) -> None:

        if not self.started:
            return

        try:

            await self.power.disconnect()

        finally:

            self.started = False

            self.latest_state = {}

    def _require_started(
        self,
    ) -> None:

        if not self.started:
            raise RuntimeError("Farm controls are not started.")

    def _get_outlet_mapping(
        self,
    ) -> dict[str, int]:

        configuration = settings.get(
            "farm_controls",
            {},
        )

        if not isinstance(
            configuration,
            dict,
        ):
            raise RuntimeError("Invalid farm_controls settings.")

        mapping = configuration.get(
            "outlet_mapping",
            {},
        )

        if not isinstance(
            mapping,
            dict,
        ):
            raise RuntimeError("Invalid farm controls outlet mapping.")

        result: dict[str, int] = {}

        for name, outlet in mapping.items():

            try:

                outlet_number = int(outlet)

            except (
                TypeError,
                ValueError,
            ) as error:

                raise RuntimeError(f"Invalid outlet mapping for {name}.") from error

            self._validate_outlet(outlet_number)

            result[name] = outlet_number

        return result

    def _get_outlet(
        self,
        equipment: str,
    ) -> int:

        mapping = self._get_outlet_mapping()

        outlet = mapping.get(equipment)

        if outlet is None:

            raise RuntimeError(f"No outlet mapping configured for '{equipment}'.")

        return outlet

    @staticmethod
    def _validate_outlet(
        outlet: int,
    ) -> None:

        if outlet < 1 or outlet > 6:

            raise ValueError("Farm control outlet must be between 1 and 6.")

    async def refresh_state(
        self,
    ) -> dict[
        int,
        dict[str, Any],
    ]:

        self._require_started()

        states = await self.power.get_outlet_states()

        latest: dict[
            int,
            dict[str, Any],
        ] = {}

        for state in states:

            latest[state.outlet] = {
                "outlet": state.outlet,
                "alias": state.alias,
                "is_on": state.is_on,
            }

        self.latest_state = latest

        return {outlet: state.copy() for outlet, state in latest.items()}

    async def get_state(
        self,
    ) -> dict[
        int,
        dict[str, Any],
    ]:

        return await self.refresh_state()

    async def get_outlet_state(
        self,
        outlet: int,
    ) -> dict[str, Any]:

        self._require_started()

        self._validate_outlet(outlet)

        state = await self.power.get_outlet_state(outlet)

        result = {
            "outlet": state.outlet,
            "alias": state.alias,
            "is_on": state.is_on,
        }

        self.latest_state[outlet] = result.copy()

        return result

    async def turn_on(
        self,
        outlet: int,
    ) -> dict[str, Any]:

        self._require_started()

        self._validate_outlet(outlet)

        await self.power.turn_on(outlet)

        return await self.get_outlet_state(outlet)

    async def turn_off(
        self,
        outlet: int,
    ) -> dict[str, Any]:

        self._require_started()

        self._validate_outlet(outlet)

        await self.power.turn_off(outlet)

        return await self.get_outlet_state(outlet)

    async def cycle_power(
        self,
        outlet: int,
        off_seconds: float,
    ) -> dict[str, Any]:

        self._require_started()

        self._validate_outlet(outlet)

        if off_seconds <= 0:

            raise ValueError("off_seconds must be greater than zero.")

        await self.power.cycle_power(
            outlet,
            off_seconds=off_seconds,
        )

        return await self.get_outlet_state(outlet)

    async def set_equipment(
        self,
        equipment: str,
        enabled: bool,
    ) -> dict[str, Any]:

        outlet = self._get_outlet(equipment)

        if enabled:

            state = await self.turn_on(outlet)

        else:

            state = await self.turn_off(outlet)

        return {
            "equipment": equipment,
            "outlet": outlet,
            "enabled": enabled,
            "confirmed_state": state,
        }

    async def set_lighting(
        self,
        level_no: int,
        enabled: bool,
    ) -> dict[str, Any]:

        if level_no not in (
            1,
            2,
        ):

            raise ValueError("Lighting level must be 1 or 2.")

        equipment = "lighting_level_1" if level_no == 1 else "lighting_level_2"

        result = await self.set_equipment(
            equipment=equipment,
            enabled=enabled,
        )

        return {
            "action": "SET_LIGHTING",
            "level_no": level_no,
            **result,
        }

    async def set_irrigation(
        self,
        enabled: bool,
    ) -> dict[str, Any]:

        result = await self.set_equipment(
            equipment="irrigation",
            enabled=enabled,
        )

        return {
            "action": "RUN_IRRIGATION",
            **result,
        }

    async def set_fan(
        self,
        enabled: bool,
    ) -> dict[str, Any]:

        result = await self.set_equipment(
            equipment="fan",
            enabled=enabled,
        )

        return {
            "action": "SET_FAN",
            **result,
        }

    async def dose_ph(
        self,
        enabled: bool,
    ) -> dict[str, Any]:

        result = await self.set_equipment(
            equipment="dose_ph",
            enabled=enabled,
        )

        return {
            "action": "DOSE_PH",
            **result,
        }

    async def dose_ec(
        self,
        enabled: bool,
    ) -> dict[str, Any]:

        result = await self.set_equipment(
            equipment="dose_ec",
            enabled=enabled,
        )

        return {
            "action": "DOSE_EC",
            **result,
        }

    def _get_dosing_settings(
        self,
        setting_key: str,
    ) -> dict[str, Any]:

        configuration = settings.get(
            setting_key,
            {},
        )

        if not isinstance(
            configuration,
            dict,
        ):
            raise RuntimeError(f"Invalid {setting_key} settings.")

        return configuration

    @staticmethod
    def _validate_dosing_settings(
        configuration: dict[str, Any],
        setting_key: str,
    ) -> tuple[
        float,
        int,
        int,
        int,
        int,
        str,
    ]:

        enabled = configuration.get(
            "enabled",
            False,
        )

        if not enabled:

            raise RuntimeError(f"{setting_key} dosing is disabled.")

        try:

            tolerance = float(configuration.get("target_tolerance"))

            dose_seconds = int(configuration.get("dose_seconds"))

            settle_seconds = int(configuration.get("settle_seconds"))

            max_cycles = int(configuration.get("max_cycles"))

            max_total_dose_seconds = int(configuration.get("max_total_dose_seconds"))

        except (
            TypeError,
            ValueError,
        ) as error:

            raise RuntimeError(f"Invalid {setting_key} dosing settings.") from error

        direction = str(
            configuration.get(
                "direction",
                "UP",
            )
        ).upper()

        if tolerance <= 0:

            raise RuntimeError(
                f"{setting_key} target_tolerance must be greater than zero."
            )

        if dose_seconds <= 0:

            raise RuntimeError(f"{setting_key} dose_seconds must be greater than zero.")

        if settle_seconds <= 0:

            raise RuntimeError(
                f"{setting_key} settle_seconds must be greater than zero."
            )

        if max_cycles <= 0:

            raise RuntimeError(f"{setting_key} max_cycles must be greater than zero.")

        if max_total_dose_seconds <= 0:

            raise RuntimeError(
                f"{setting_key} max_total_dose_seconds must be greater than zero."
            )

        if direction not in (
            "UP",
            "DOWN",
        ):

            raise RuntimeError(f"{setting_key} direction must be UP or DOWN.")

        return (
            tolerance,
            dose_seconds,
            settle_seconds,
            max_cycles,
            max_total_dose_seconds,
            direction,
        )

    @staticmethod
    def _is_target_reached(
        value: float,
        target: float,
        tolerance: float,
        direction: str,
    ) -> bool:

        if direction == "UP":

            return target - tolerance <= value <= target

        return target <= value <= target + tolerance

    @staticmethod
    def _has_overshot(
        value: float,
        target: float,
        direction: str,
    ) -> bool:

        if direction == "UP":

            return value > target

        return value < target

    async def _get_sensor_value(
        self,
        sensor_type: str,
    ) -> float:

        reading = self.sensors.latest.get(sensor_type)

        if not isinstance(
            reading,
            dict,
        ):

            raise RuntimeError(f"Current {sensor_type} reading is unavailable.")

        if not reading.get(
            "valid",
            False,
        ):

            raise RuntimeError(f"Current {sensor_type} reading is invalid.")

        value = reading.get("value")

        if value is None:

            raise RuntimeError(f"Current {sensor_type} reading is unavailable.")

        try:

            return float(value)

        except (
            TypeError,
            ValueError,
        ) as error:

            raise RuntimeError(f"Current {sensor_type} reading is invalid.") from error

    async def _dose_pulse(
        self,
        enabled_handler: Callable[
            [bool],
            Awaitable[dict[str, Any]],
        ],
        dose_seconds: int,
    ) -> dict[str, Any]:

        await enabled_handler(True)

        try:

            await asyncio.sleep(dose_seconds)

        finally:

            await enabled_handler(False)

        return {
            "dose_seconds": dose_seconds,
        }

    async def _dose_to_target(
        self,
        target: float,
        sensor_type: str,
        setting_key: str,
        enabled_handler: Callable[
            [bool],
            Awaitable[dict[str, Any]],
        ],
        action: str,
    ) -> dict[str, Any]:

        self._require_started()

        configuration = self._get_dosing_settings(setting_key)

        (
            tolerance,
            dose_seconds,
            settle_seconds,
            max_cycles,
            max_total_dose_seconds,
            direction,
        ) = self._validate_dosing_settings(
            configuration,
            setting_key,
        )

        if target <= 0:

            raise ValueError(f"{sensor_type} target must be greater than zero.")

        total_dose_seconds = 0

        cycles = 0

        while cycles < max_cycles:

            current_value = await self._get_sensor_value(sensor_type)

            if self._is_target_reached(
                value=current_value,
                target=target,
                tolerance=tolerance,
                direction=direction,
            ):

                return {
                    "action": action,
                    "status": "target_reached",
                    "sensor_type": sensor_type,
                    "target": target,
                    "tolerance": tolerance,
                    "current_value": current_value,
                    "cycles": cycles,
                    "total_dose_seconds": total_dose_seconds,
                }

            if self._has_overshot(
                value=current_value,
                target=target,
                direction=direction,
            ):

                raise RuntimeError(
                    f"{sensor_type} is already beyond the requested target."
                )

            if total_dose_seconds + dose_seconds > max_total_dose_seconds:

                raise RuntimeError(f"Maximum total {sensor_type} dosing limit reached.")

            cycles += 1

            await self._dose_pulse(
                enabled_handler=enabled_handler,
                dose_seconds=dose_seconds,
            )

            total_dose_seconds += dose_seconds

            await asyncio.sleep(settle_seconds)

        current_value = await self._get_sensor_value(sensor_type)

        if self._is_target_reached(
            value=current_value,
            target=target,
            tolerance=tolerance,
            direction=direction,
        ):

            return {
                "action": action,
                "status": "target_reached",
                "sensor_type": sensor_type,
                "target": target,
                "tolerance": tolerance,
                "current_value": current_value,
                "cycles": cycles,
                "total_dose_seconds": total_dose_seconds,
            }

        raise RuntimeError(
            f"{sensor_type} target was not reached within the configured dosing limits."
        )

    async def dose_ph_to_target(
        self,
        target: float,
    ) -> dict[str, Any]:

        return await self._dose_to_target(
            target=target,
            sensor_type="ph",
            setting_key="dosing_ph",
            enabled_handler=self.dose_ph,
            action="DOSE_PH",
        )

    async def dose_ec_to_target(
        self,
        target: float,
    ) -> dict[str, Any]:

        return await self._dose_to_target(
            target=target,
            sensor_type="ec",
            setting_key="dosing_ec",
            enabled_handler=self.dose_ec,
            action="DOSE_EC",
        )

    async def is_equipment_on(
        self,
        equipment: str,
    ) -> bool:

        outlet = self._get_outlet(equipment)

        state = await self.get_outlet_state(outlet)

        return bool(state["is_on"])

    async def get_equipment_state(
        self,
        equipment: str,
    ) -> dict[str, Any]:

        outlet = self._get_outlet(equipment)

        state = await self.get_outlet_state(outlet)

        return {
            "equipment": equipment,
            "outlet": outlet,
            "enabled": bool(state["is_on"]),
            "state": state,
        }
