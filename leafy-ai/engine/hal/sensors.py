import asyncio
import socket

from typing import Any

import httpx

from engine.logger.logger import audit_log
from engine.managers.db_manager import (
    get_connection,
    run_query,
)


class Sensors:
    def __init__(self):
        self.ws_fallback_ip = "192.168.1.100"
        self.as_base_url = "Leafy-AI.local:8080"

        self.loop = False

        try:
            resolved_ip = socket.gethostbyname("WaterSensors.local")

            self.ws_base_url = resolved_ip

        except socket.gaierror:
            self.ws_base_url = self.ws_fallback_ip

        self.client = httpx.AsyncClient(
            timeout=5.0,
        )

    async def read_sensors(
        self,
    ) -> None:

        ws_result, as_result = await asyncio.gather(
            self.client.get(
                url=(f"http://" f"{self.ws_base_url}" f"/readings"),
                headers={
                    "Accept": "application/json",
                    "Cache-Control": "no-cache",
                },
            ),
            self.client.get(
                url=(f"http://" f"{self.as_base_url}" f"/readings"),
                headers={
                    "Accept": "application/json",
                    "Cache-Control": "no-cache",
                },
            ),
            return_exceptions=True,
        )

        await asyncio.gather(
            self.handle_water_sensors(ws_result),
            self.handle_ambient_sensors(as_result),
        )

    async def handle_water_sensors(
        self,
        result: httpx.Response | BaseException,
    ) -> None:

        if isinstance(
            result,
            httpx.RequestError,
        ):
            await self.log_request_error(
                device="WaterSensors",
                error=result,
            )

            return

        if isinstance(
            result,
            BaseException,
        ):
            raise result

        try:
            result.raise_for_status()

        except httpx.HTTPStatusError as error:
            await self.log_status_error(
                device="WaterSensors",
                error=error,
            )

            return

        try:
            data = result.json()

            data["ph"]
            data["ec"]
            data["water_temperature_c"]

            data["ph_valid"]
            data["ec_valid"]
            data["water_temperature_valid"]

        except (
            ValueError,
            KeyError,
            TypeError,
        ) as error:

            await self.log_data_error(
                device="WaterSensors",
                error=error,
            )

            return

        await self.save_water_readings(data)

    async def handle_ambient_sensors(
        self,
        result: httpx.Response | BaseException,
    ) -> None:

        if isinstance(
            result,
            httpx.RequestError,
        ):
            await self.log_request_error(
                device="AmbientLevelSensors",
                error=result,
            )

            return

        if isinstance(
            result,
            BaseException,
        ):
            raise result

        try:
            result.raise_for_status()

        except httpx.HTTPStatusError as error:
            await self.log_status_error(
                device="AmbientLevelSensors",
                error=error,
            )

            return

        try:
            data = result.json()

            data["ambient_temperature_c"]
            data["humidity_percent"]
            data["dew_point_c"]
            data["water_level"]

            data["ambient_valid"]
            data["water_level_valid"]

        except (
            ValueError,
            KeyError,
            TypeError,
        ) as error:

            await self.log_data_error(
                device="AmbientLevelSensors",
                error=error,
            )

            return

        await self.save_ambient_readings(data)

    async def save_water_readings(
        self,
        data: dict[str, Any],
    ) -> list[Any]:

        query = """
            INSERT INTO sensor_readings (
                sensor_id,
                recorded_at,
                value,
                quality_status
            )
            SELECT
                s.sensor_id,
                NOW(),
                v.value,
                v.quality_status
            FROM (
                VALUES
                    (
                        'ph',
                        0,
                        1,
                        %s::double precision,
                        %s
                    ),
                    (
                        'ec',
                        0,
                        1,
                        %s::double precision,
                        %s
                    ),
                    (
                        'water_temperature',
                        0,
                        1,
                        %s::double precision,
                        %s
                    )
            ) AS v (
                sensor_type,
                level_no,
                sensor_no,
                value,
                quality_status
            )
            JOIN sensors s
                ON s.sensor_type = v.sensor_type
                AND s.level_no = v.level_no
                AND s.sensor_no = v.sensor_no
            WHERE s.status = 'ACTIVE'
            RETURNING
                reading_id,
                sensor_id,
                recorded_at,
                value,
                quality_status;
        """

        return await run_query(
            query,
            (
                data["ph"],
                (
                    "VALID"
                    if data.get(
                        "ph_valid",
                        False,
                    )
                    else "INVALID"
                ),
                data["ec"],
                (
                    "VALID"
                    if data.get(
                        "ec_valid",
                        False,
                    )
                    else "INVALID"
                ),
                data["water_temperature_c"],
                (
                    "VALID"
                    if data.get(
                        "water_temperature_valid",
                        False,
                    )
                    else "INVALID"
                ),
            ),
        )

    async def save_ambient_readings(
        self,
        data: dict[str, Any],
    ) -> list[Any]:

        query = """
            INSERT INTO sensor_readings (
                sensor_id,
                recorded_at,
                value,
                quality_status
            )
            SELECT
                s.sensor_id,
                NOW(),
                v.value,
                v.quality_status
            FROM (
                VALUES
                    (
                        'ambient_temperature',
                        0,
                        1,
                        %s::double precision,
                        %s
                    ),
                    (
                        'humidity',
                        0,
                        1,
                        %s::double precision,
                        %s
                    ),
                    (
                        'dew_point',
                        0,
                        1,
                        %s::double precision,
                        %s
                    ),
                    (
                        'water_level',
                        0,
                        1,
                        %s::double precision,
                        %s
                    )
            ) AS v (
                sensor_type,
                level_no,
                sensor_no,
                value,
                quality_status
            )
            JOIN sensors s
                ON s.sensor_type = v.sensor_type
                AND s.level_no = v.level_no
                AND s.sensor_no = v.sensor_no
            WHERE s.status = 'ACTIVE'
            RETURNING
                reading_id,
                sensor_id,
                recorded_at,
                value,
                quality_status;
        """

        return await run_query(
            query,
            (
                data["ambient_temperature_c"],
                (
                    "VALID"
                    if data.get(
                        "ambient_valid",
                        False,
                    )
                    else "INVALID"
                ),
                data["humidity_percent"],
                (
                    "VALID"
                    if data.get(
                        "ambient_valid",
                        False,
                    )
                    else "INVALID"
                ),
                data["dew_point_c"],
                (
                    "VALID"
                    if data.get(
                        "ambient_valid",
                        False,
                    )
                    else "INVALID"
                ),
                data["water_level"],
                (
                    "VALID"
                    if data.get(
                        "water_level_valid",
                        False,
                    )
                    else "INVALID"
                ),
            ),
        )

    async def log_status_error(
        self,
        device: str,
        error: httpx.HTTPStatusError,
    ) -> None:

        async with get_connection() as conn:
            await audit_log(
                conn=conn,
                action_type="SENSOR_HTTP_ERROR",
                entity_type="farm_sensors",
                description=(f"{device} returned an HTTP error response."),
                metadata={
                    "device": device,
                    "method": error.request.method,
                    "status_code": (error.response.status_code),
                    "error_type": (type(error).__name__),
                },
            )

    async def log_request_error(
        self,
        device: str,
        error: httpx.RequestError,
    ) -> None:

        async with get_connection() as conn:
            await audit_log(
                conn=conn,
                action_type="SENSOR_CONNECTION_ERROR",
                entity_type="farm_sensors",
                description=(f"System could not communicate with {device}."),
                metadata={
                    "device": device,
                    "method": error.request.method,
                    "error_type": type(error).__name__,
                    "error": (str(error) or type(error).__name__),
                },
            )

    async def log_data_error(
        self,
        device: str,
        error: Exception,
    ) -> None:

        async with get_connection() as conn:
            await audit_log(
                conn=conn,
                action_type="SENSOR_DATA_ERROR",
                entity_type="farm_sensors",
                description=(f"{device} returned invalid or incomplete sensor data."),
                metadata={
                    "device": device,
                    "error_type": (type(error).__name__),
                    "error": str(error),
                },
            )

    async def start(
        self,
    ) -> None:

        self.loop = True

        while self.loop:
            await self.read_sensors()

            await asyncio.sleep(10.0)

    async def stop(
        self,
    ) -> None:

        self.loop = False

        await self.client.aclose()
