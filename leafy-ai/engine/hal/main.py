from engine.hal.sensors import Sensors
from engine.hal.cameras import Cameras
from engine.hal.ai_vision.vision_tool import VisionAnalysis
from engine.hal.farm_controls import FarmControls

import asyncio


class Hal:

    def __init__(self):

        self.sensors = Sensors()

        self.cameras = Cameras()

        self.ai_vision = VisionAnalysis()

        self.controls = FarmControls(sensors=self.sensors)

    async def start_hal(
        self,
    ) -> None:

        self.sensors_task = asyncio.create_task(
            self.sensors.start(),
            name="hal-sensors",
        )

        self.cameras_task = asyncio.create_task(
            self.cameras.start(),
            name="hal-cameras",
        )

        self.ai_vision_task = asyncio.create_task(
            self.ai_vision.start(),
            name="hal-ai-vision",
        )

        await self.controls.start()

    async def stop_hal(
        self,
    ) -> None:

        await self.controls.stop()

        await self.sensors.stop()

        await self.cameras.stop()

        await self.ai_vision.stop()

        self.sensors_task.cancel()
        self.cameras_task.cancel()
        self.ai_vision_task.cancel()

        await asyncio.gather(
            self.sensors_task,
            self.cameras_task,
            self.ai_vision_task,
            return_exceptions=True,
        )
