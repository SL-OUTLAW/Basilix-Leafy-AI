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
async def lifespan(app: FastAPI):

    # engine startup

    await open_pool()

    await manage_settings()

    hal = Hal()

    scheduler_task = asyncio.create_task(scheduler.scheduler_loop())

    await hal.start_hal()

    app.state.hal = hal
    app.state.scheduler_task = scheduler_task

    try:
        yield

    finally:

        # engine shutdown

        await hal.stop_hal()

        await close_pool()


app = FastAPI(
    title="Leafy Engine",
    lifespan=lifespan,
)

app.include_router(router)
