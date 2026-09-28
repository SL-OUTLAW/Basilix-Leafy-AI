from engine.hal.sensors import Sensors
from engine.hal.cameras import Cameras
from engine.hal.ai_vision.vision_tool import VisionAnalysis
import asyncio, selectors
from engine.managers.db_manager import open_pool


class Hal:
    def __init__(self):
        self.sensors = Sensors()
        self.cameras = Cameras()
        self.ai_vision = VisionAnalysis()

    async def start_hal(self) -> None:
        self.sensors_task = asyncio.create_task(self.sensors.start())

        self.cameras_task = asyncio.create_task(self.cameras.start())

        self.ai_vision_task = asyncio.create_task(self.ai_vision.start())


    async def stop_hal(self) -> None:
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


async def main():
    await open_pool()

    hal = Hal()

    await hal.start_hal()

    try:
        await asyncio.gather(
            hal.sensors_task,
            hal.cameras_task,
            hal.ai_vision_task,
        )

    finally:
        await hal.stop_hal()


if __name__ == "__main__":
    asyncio.run(
        main(),
        loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
    )
