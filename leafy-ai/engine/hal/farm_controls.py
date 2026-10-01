import asyncio
import json

from typing import Any

from engine.hal.drivers import (
    SixOutletPowerSystem,
)
from engine.managers.db_manager import run_query
from engine.managers.settings_manager import settings


class FarmControls:

    def __init__(
        self,
        sensors=None,
    ):
        self.sensors = sensors

        self.power = SixOutletPowerSystem(
            use_discovery=False,
        )

        self.started = False

        self.latest_state: dict[
            int,
            dict[str, Any],
        ] = {}

        self.dosing_lock = asyncio.Lock()

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

    def _validate_dosing_settings(
        self,
        setting_key: str,
    ) -> dict[str, Any]:

        configuration = self._get_dosing_settings(setting_key)

        if not configuration.get(
            "enabled",
            False,
        ):
            raise RuntimeError(f"{setting_key} is disabled.")

        try:
            target_tolerance = float(configuration["target_tolerance"])
            dose_seconds = float(configuration["dose_seconds"])
            settle_seconds = float(configuration["settle_seconds"])
            max_cycles = int(configuration["max_cycles"])
            max_total_dose_seconds = float(configuration["max_total_dose_seconds"])
            max_sensor_age_seconds = float(
                configuration.get(
                    "max_sensor_age_seconds",
                    30,
                )
            )

        except (
            KeyError,
            TypeError,
            ValueError,
        ) as error:
            raise RuntimeError(f"Invalid {setting_key} dosing settings.") from error

        direction = str(
            configuration.get(
                "direction",
                "",
            )
        ).upper()

        if direction not in (
            "UP",
            "DOWN",
        ):
            raise RuntimeError(f"{setting_key} direction must be UP or DOWN.")

        if target_tolerance < 0:
            raise RuntimeError("target_tolerance cannot be negative.")

        if dose_seconds <= 0:
            raise RuntimeError("dose_seconds must be greater than zero.")

        if settle_seconds <= 0:
            raise RuntimeError("settle_seconds must be greater than zero.")

        if max_cycles <= 0:
            raise RuntimeError("max_cycles must be greater than zero.")

        if max_total_dose_seconds <= 0:
            raise RuntimeError("max_total_dose_seconds must be greater than zero.")

        if max_sensor_age_seconds <= 0:
            raise RuntimeError("max_sensor_age_seconds must be greater than zero.")

        return {
            "target_tolerance": target_tolerance,
            "dose_seconds": dose_seconds,
            "settle_seconds": settle_seconds,
            "max_cycles": max_cycles,
            "max_total_dose_seconds": max_total_dose_seconds,
            "max_sensor_age_seconds": max_sensor_age_seconds,
            "direction": direction,
        }

    def _get_target_bounds(
        self,
        sensor_type: str,
    ) -> tuple[float, float]:

        thresholds = settings.get(
            "sensor_security_thresholds",
            {},
        )

        if not isinstance(
            thresholds,
            dict,
        ):
            raise RuntimeError("Invalid sensor_security_thresholds settings.")

        sensor_thresholds = thresholds.get(
            sensor_type,
            {},
        )

        if not isinstance(
            sensor_thresholds,
            dict,
        ):
            raise RuntimeError(f"Invalid safety thresholds for {sensor_type}.")

        try:
            lower_limit = float(sensor_thresholds["lower_limit"])
            upper_limit = float(sensor_thresholds["upper_limit"])

        except (
            KeyError,
            TypeError,
            ValueError,
        ) as error:
            raise RuntimeError(
                f"Missing or invalid safety target limits for {sensor_type}."
            ) from error

        if lower_limit >= upper_limit:
            raise RuntimeError(f"Invalid safety target limits for {sensor_type}.")

        return lower_limit, upper_limit

    def _validate_target(
        self,
        sensor_type: str,
        target: float,
    ) -> None:

        lower_limit, upper_limit = self._get_target_bounds(sensor_type)

        if target < lower_limit or target > upper_limit:
            raise ValueError(
                f"{sensor_type} target must be between {lower_limit} and {upper_limit}."
            )

    async def _get_latest_sensor_value(
        self,
        sensor_type: str,
        max_sensor_age_seconds: float,
    ) -> float:

        rows = await run_query(
            """
            SELECT
                sr.value,
                sr.quality_status,
                EXTRACT(
                    EPOCH FROM (
                        NOW() - sr.recorded_at
                    )
                )
            FROM sensor_readings sr
            JOIN sensors s
                ON s.sensor_id = sr.sensor_id
            WHERE s.sensor_type = %s
              AND s.level_no = 0
              AND s.status = 'ACTIVE'
            ORDER BY sr.recorded_at DESC
            LIMIT 1;
            """,
            (sensor_type,),
        )

        if not rows:
            raise RuntimeError(f"No {sensor_type} sensor reading is available.")

        row = rows[0]

        value = row[0]
        quality_status = row[1]
        age_seconds = row[2]

        if quality_status != "VALID":
            raise RuntimeError(f"Latest {sensor_type} sensor reading is not valid.")

        if value is None:
            raise RuntimeError(f"Latest {sensor_type} sensor reading has no value.")

        if age_seconds is None:
            raise RuntimeError(f"Could not determine {sensor_type} sensor reading age.")

        if float(age_seconds) > max_sensor_age_seconds:
            raise RuntimeError(
                f"Latest {sensor_type} sensor reading is too old for dosing."
            )

        return float(value)

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

    async def _create_critical_notification(
        self,
        title: str,
        message: str,
        metadata: dict[str, Any],
    ) -> None:

        await run_query(
            """
            INSERT INTO notifications (
                notification_type,
                severity,
                title,
                message,
                entity_type,
                metadata,
                status
            )
            VALUES (
                'FARM_CONTROL',
                'CRITICAL',
                %s,
                %s,
                'farm_control',
                %s::jsonb,
                'OPEN'
            );
            """,
            (
                title,
                message,
                json.dumps(metadata),
            ),
        )

    async def _dose_pulse(
        self,
        equipment: str,
        dose_seconds: float,
    ) -> None:

        await self.set_equipment(
            equipment=equipment,
            enabled=True,
        )

        try:
            await asyncio.sleep(dose_seconds)

        finally:
            try:
                await self.set_equipment(
                    equipment=equipment,
                    enabled=False,
                )

            except Exception as error:
                try:
                    await self._create_critical_notification(
                        title="Dosing pump state unconfirmed",
                        message=(
                            f"The {equipment} dosing pump could not be confirmed OFF "
                            "after a dosing pulse."
                        ),
                        metadata={
                            "equipment": equipment,
                            "dose_seconds": dose_seconds,
                            "error_type": type(error).__name__,
                            "error": str(error),
                        },
                    )
                except Exception as notification_error:
                    print(
                        f"Dosing pump OFF failure notification could not be created: "
                        f"{notification_error}. Original error: {error}."
                    )

                raise RuntimeError(
                    f"Failed to confirm {equipment} dosing pump OFF. "
                    "Physical pump state is uncertain."
                ) from error

    async def _dose_to_target(
        self,
        sensor_type: str,
        equipment: str,
        setting_key: str,
        target: float,
        action: str,
    ) -> dict[str, Any]:

        self._require_started()

        self._validate_target(
            sensor_type=sensor_type,
            target=target,
        )

        configuration = self._validate_dosing_settings(setting_key)

        tolerance = configuration["target_tolerance"]
        dose_seconds = configuration["dose_seconds"]
        settle_seconds = configuration["settle_seconds"]
        max_cycles = configuration["max_cycles"]
        max_total_dose_seconds = configuration["max_total_dose_seconds"]
        max_sensor_age_seconds = configuration["max_sensor_age_seconds"]
        direction = configuration["direction"]

        async with self.dosing_lock:

            current_value = await self._get_latest_sensor_value(
                sensor_type=sensor_type,
                max_sensor_age_seconds=max_sensor_age_seconds,
            )

            initial_value = current_value

            if self._is_target_reached(
                value=current_value,
                target=target,
                tolerance=tolerance,
                direction=direction,
            ):
                return {
                    "action": action,
                    "target_value": target,
                    "initial_value": initial_value,
                    "final_value": current_value,
                    "direction": direction,
                    "cycles": 0,
                    "total_dose_seconds": 0.0,
                    "target_reached": True,
                }

            if self._has_overshot(
                value=current_value,
                target=target,
                direction=direction,
            ):
                raise RuntimeError(
                    f"{sensor_type} is already beyond the target for configured "
                    f"dosing direction {direction}."
                )

            cycles = 0
            total_dose_seconds = 0.0

            while cycles < max_cycles:

                if total_dose_seconds + dose_seconds > max_total_dose_seconds:
                    break

                await self._dose_pulse(
                    equipment=equipment,
                    dose_seconds=dose_seconds,
                )

                cycles += 1
                total_dose_seconds += dose_seconds

                await asyncio.sleep(settle_seconds)

                current_value = await self._get_latest_sensor_value(
                    sensor_type=sensor_type,
                    max_sensor_age_seconds=max_sensor_age_seconds,
                )

                if self._is_target_reached(
                    value=current_value,
                    target=target,
                    tolerance=tolerance,
                    direction=direction,
                ):
                    return {
                        "action": action,
                        "target_value": target,
                        "initial_value": initial_value,
                        "final_value": current_value,
                        "direction": direction,
                        "cycles": cycles,
                        "total_dose_seconds": total_dose_seconds,
                        "target_reached": True,
                    }

                if self._has_overshot(
                    value=current_value,
                    target=target,
                    direction=direction,
                ):
                    raise RuntimeError(
                        f"{sensor_type} passed the target during dosing."
                    )

            raise RuntimeError(
                f"{sensor_type} target was not reached within dosing safety limits. "
                f"Final value: {current_value}. Cycles: {cycles}. "
                f"Total dose seconds: {total_dose_seconds}."
            )

    async def dose_ph_to_target(
        self,
        target: float,
    ) -> dict[str, Any]:

        return await self._dose_to_target(
            sensor_type="ph",
            equipment="dose_ph",
            setting_key="dosing_ph",
            target=target,
            action="DOSE_PH",
        )

    async def dose_ec_to_target(
        self,
        target: float,
    ) -> dict[str, Any]:

        return await self._dose_to_target(
            sensor_type="ec",
            equipment="dose_ec",
            setting_key="dosing_ec",
            target=target,
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
