from contextlib import asynccontextmanager

from fastapi import FastAPI

import asyncio

from engine.api.engine_api import router
from engine.hal.main import Hal
from engine.managers import scheduler
from engine.managers.db_manager import (
    open_pool,
    close_pool,
)
from engine.managers.settings_manager import (
    manage_settings,
)


@asynccontextmanager
async def lifespan(
    app: FastAPI,
):

    await open_pool()

    await manage_settings()

    hal = Hal()

    await hal.start_hal()

    scheduler_task = asyncio.create_task(
        scheduler.start(),
        name="scheduler-worker",
    )

    app.state.hal = hal
    app.state.scheduler_task = scheduler_task

    try:
        yield

    finally:

        await scheduler.stop()

        scheduler_task.cancel()

        await asyncio.gather(
            scheduler_task,
            return_exceptions=True,
        )

        await hal.stop_hal()

        await close_pool()


app = FastAPI(
    title="Leafy Engine",
    lifespan=lifespan,
)

app.include_router(router)
