import asyncio
import os
import selectors
import time

from datetime import datetime
from pathlib import Path

import cv2

from engine.logger.logger import audit_log
from engine.managers.db_manager import (
    get_connection,
    run_query,
    open_pool,
    close_pool,
)

OPEN_TIMEOUT_SECONDS = 5.0
READ_TIMEOUT_SECONDS = 5.0
WARMUP_FRAMES = 3
JPEG_QUALITY = 90
RTSP_PORT = 554


class Camera:
    def __init__(
        self,
        camera_id: int,
        level: int,
        name: str,
        ip: str,
    ):
        self.camera_id = camera_id
        self.level = level
        self.name = name
        self.ip = ip


class Cameras:
    def __init__(
        self,
        output_directory: Path = Path("camera_images"),
    ):
        self.cameras: list[Camera] = []
        self.output_directory = output_directory

        self.loop = False

        self.latest_images: list[Path] = []

    async def load_cameras(
        self,
    ) -> None:

        query = """
            SELECT
                camera_id,
                level_no,
                camera_name,
                ip_address
            FROM cameras
            WHERE status = 'ACTIVE'
            ORDER BY
                level_no ASC,
                camera_id ASC;
        """

        rows = await run_query(query)

        self.cameras = [
            Camera(
                camera_id=row[0],
                level=row[1],
                name=row[2],
                ip=row[3],
            )
            for row in rows
        ]

    def open_camera(
        self,
        camera: Camera,
    ) -> cv2.VideoCapture:

        url = f"rtsp://" f"{camera.ip}:" f"{RTSP_PORT}/"

        capture = cv2.VideoCapture(
            url,
            cv2.CAP_FFMPEG,
            [
                cv2.CAP_PROP_OPEN_TIMEOUT_MSEC,
                int(OPEN_TIMEOUT_SECONDS * 1000),
                cv2.CAP_PROP_READ_TIMEOUT_MSEC,
                int(READ_TIMEOUT_SECONDS * 1000),
            ],
        )

        capture.set(
            cv2.CAP_PROP_BUFFERSIZE,
            1,
        )

        if not capture.isOpened():
            capture.release()

            raise ConnectionError(
                f"Could not open {camera.name} " f"at {camera.ip}:{RTSP_PORT}."
            )

        return capture

    def read_fresh_frame(
        self,
        capture: cv2.VideoCapture,
    ):

        deadline = time.monotonic() + READ_TIMEOUT_SECONDS

        latest_frame = None
        successful_frames = 0

        while time.monotonic() < deadline:

            ok, frame = capture.read()

            if ok and frame is not None:

                latest_frame = frame
                successful_frames += 1

                if successful_frames >= WARMUP_FRAMES:
                    return latest_frame

            else:
                time.sleep(0.05)

        if latest_frame is not None:
            return latest_frame

        raise TimeoutError("Connection opened but no frame was decoded.")

    def capture_one(
        self,
        camera: Camera,
    ) -> Path:

        capture = None

        try:
            capture = self.open_camera(camera)

            frame = self.read_fresh_frame(capture)

            self.output_directory.mkdir(
                parents=True,
                exist_ok=True,
            )

            timestamp = datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")

            output_path = self.output_directory / (f"{camera.name}_" f"{timestamp}.jpg")

            parameters = [
                cv2.IMWRITE_JPEG_QUALITY,
                JPEG_QUALITY,
            ]

            saved = cv2.imwrite(
                str(output_path),
                frame,
                parameters,
            )

            if not saved:
                raise OSError(f"Could not write to {output_path}")

            return output_path

        finally:
            if capture is not None:
                capture.release()

    async def capture_camera(
        self,
        camera: Camera,
    ) -> Path:

        return await asyncio.to_thread(
            self.capture_one,
            camera,
        )

    async def log_camera_error(
        self,
        camera: Camera,
        error: Exception,
    ) -> None:

        if isinstance(error, ConnectionError):
            action_type = "CAMERA_CONNECTION_ERROR"

            description = f"System could not connect to {camera.name}."

        elif isinstance(error, TimeoutError):
            action_type = "CAMERA_READ_TIMEOUT"

            description = (
                f"{camera.name} connected but a camera frame could not be read."
            )

        elif isinstance(error, OSError):
            action_type = "CAMERA_IMAGE_SAVE_ERROR"

            description = f"System could not save an image captured from {camera.name}."

        else:
            action_type = "CAMERA_ERROR"

            description = f"An unexpected camera error occurred for {camera.name}."

        async with get_connection() as conn:
            await audit_log(
                conn=conn,
                action_type=action_type,
                entity_type="camera",
                entity_id=camera.camera_id,
                description=description,
                metadata={
                    "camera_name": camera.name,
                    "level_no": camera.level,
                    "ip": camera.ip,
                    "error_type": (type(error).__name__),
                    "error": str(error),
                },
            )

    async def capture_all(
        self,
    ) -> list[
        tuple[
            Camera,
            Path | Exception,
        ]
    ]:

        if not self.cameras:
            await self.load_cameras()

        results = await asyncio.gather(
            *[self.capture_camera(camera) for camera in self.cameras],
            return_exceptions=True,
        )

        camera_results = list(
            zip(
                self.cameras,
                results,
            )
        )

        for camera, result in camera_results:

            if isinstance(
                result,
                Exception,
            ):
                await self.log_camera_error(
                    camera=camera,
                    error=result,
                )

        return camera_results

    async def start(
        self,
    ) -> None:

        self.loop = True

        await self.load_cameras()

        while self.loop:
            await self.capture_all()

            await asyncio.sleep(10.0)

    async def stop(
        self,
    ) -> None:

        self.loop = False


async def test():
    await open_pool()

    cameras = Cameras(output_directory=Path("camera_images"))

    try:
        await cameras.load_cameras()

        print(f"Loaded {len(cameras.cameras)} camera(s)")

        for camera in cameras.cameras:
            print(f"Camera {camera.name} (Level {camera.level}) {camera.ip}")

        results = await cameras.capture_all()

        for camera, result in results:

            if isinstance(
                result,
                Exception,
            ):
                print(f"FAILED: " f"{camera.name}: " f"{result}")

            else:
                print(f"SUCCESS: " f"{camera.name}: " f"{result}")

    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(
        test(),
        loop_factory=lambda: (asyncio.SelectorEventLoop(selectors.SelectSelector())),
    )
