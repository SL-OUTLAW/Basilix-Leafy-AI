from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

import asyncio

from engine.api.engine_api import router
from engine.api.rate_limit import limiter
from engine.hal.main import Hal
from engine.managers import scheduler
from engine.managers.db_manager import (
    open_pool,
    close_pool,
)
from engine.managers.settings_manager import (
    manage_settings,
)
from engine.actions.register_actions import (
    register_scheduler_actions,
)

from engine.security import security_monitor


@asynccontextmanager
async def lifespan(
    app: FastAPI,
):

    await open_pool()

    await manage_settings()

    hal = Hal()

    await hal.start_hal()

    register_scheduler_actions(hal)

    scheduler_task = asyncio.create_task(
        scheduler.start(),
        name="scheduler-worker",
    )

    security_task = asyncio.create_task(
        security_monitor.start(hal),
        name="security-monitor",
    )

    app.state.hal = hal
    app.state.scheduler_task = scheduler_task

    try:
        yield

    finally:

        await security_monitor.stop()

        await scheduler.stop()

        security_task.cancel()
        scheduler_task.cancel()

        await asyncio.gather(
            security_task,
            scheduler_task,
            return_exceptions=True,
        )

        await hal.stop_hal()

        await close_pool()


app = FastAPI(
    title="Leafy Engine",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)

app.include_router(router)
