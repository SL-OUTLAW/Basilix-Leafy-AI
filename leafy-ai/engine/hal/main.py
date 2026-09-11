from engine.hal.sensors import Sensors
from engine.hal.cameras import Cameras
import asyncio, selectors
from engine.managers.db_manager import open_pool


class Hal:
    def __init__(self):
        self.sensors = Sensors()
        self.cameras = Cameras()

    async def start_hal(self) -> None:
        self.sensors_task = asyncio.create_task(self.sensors.start())

        self.cameras_task = asyncio.create_task(self.cameras.start())

    async def stop_hal(self) -> None:
        await self.sensors.stop()
        await self.cameras.stop()

        self.sensors_task.cancel()
        self.cameras_task.cancel()

        await asyncio.gather(
            self.sensors_task,
            self.cameras_task,
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
        )

    finally:
        await hal.stop_hal()


if __name__ == "__main__":
    asyncio.run(
        main(),
        loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
    )
