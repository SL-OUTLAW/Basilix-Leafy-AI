import httpx, asyncio, socket
from typing import Any
from engine.managers.db_manager import run_query

class Sensor:
    def __init__(self):
        self.fall_back_ip = "192.168.1.100"

        try:
            resolved_ip = socket.gethostbyname("WaterSensors.local")
            print(f"Resolved WaterSensors.local to {resolved_ip}")
            self.base_url = resolved_ip
        except socket.gaierror:
            print(
                f"Could not resolve WaterSensors.local. "
                f"Using fallback IP {self.fall_back_ip}."
            )
            self.base_url = self.fall_back_ip

        self.client = httpx.AsyncClient(
            timeout=5.0,
        )

    async def read_sensor(self) -> dict[str, Any]:

        self.response = await self.client.get(
            url=f"http://{self.base_url}/readings",
            headers={
                "Accept": "application/json",
                "Cache-Control": "no-cache",
            },
        )

        self.response.raise_for_status()

        self.data = self.response.json()

        return self.data

sensor_test = Sensor()

asyncio.run(sensor_test.read_sensor())
