import asyncio
from typing import Any, Awaitable, Callable

from psycopg.types.json import Jsonb

from engine.logger.logger import audit_log
from engine.managers.db_manager import (
    get_connection,
    run_query,
)
from engine.managers.settings_manager import settings

loop = False

action_queue: asyncio.Queue = asyncio.Queue()

ACTION_HANDLERS: dict[
    str,
    Callable[
        [
            dict[str, Any],
        ],
        Awaitable[Any],
    ],
] = {}


def register_action_handler(
    action_type: str,
    handler: Callable[
        [
            dict[str, Any],
        ],
        Awaitable[Any],
    ],
) -> None:

    ACTION_HANDLERS[action_type] = handler


async def queue_scheduler_action(
    action_type: str,
    action_data: dict[str, Any],
    recommendation_id: int | None = None,
    approval_id: int | None = None,
) -> None:

    await action_queue.put(
        {
            "action_type": action_type,
            "action_data": action_data,
            "recommendation_id": recommendation_id,
            "approval_id": approval_id,
        }
    )


async def get_due_tasks():

    return await run_query("""
        SELECT
            schedule_id,
            task_name,
            task_action,
            level_no,
            start_time,
            interval_seconds,
            duration_seconds,
            target_value,
            unit,
            last_run_at,
            next_run_at,
            enabled,
            status
        FROM farm_schedule
        WHERE enabled = TRUE
          AND status = 'ACTIVE'
          AND next_run_at IS NOT NULL
          AND next_run_at <= NOW()
        ORDER BY next_run_at;
        """)


async def _create_schedule(
    action_data: dict[str, Any],
) -> int:

    interval_seconds = action_data.get("interval_seconds")

    existing = await run_query(
        """
        SELECT
            schedule_id
        FROM farm_schedule
        WHERE task_action = %s
          AND level_no = %s
          AND start_time = %s::time
          AND (
              interval_seconds = %s
              OR (
                  interval_seconds IS NULL
                  AND %s IS NULL
              )
          )
          AND enabled = TRUE
          AND status = 'ACTIVE'
        LIMIT 1;
        """,
        (
            action_data.get("task_action"),
            action_data.get("level_no"),
            action_data.get("start_time"),
            interval_seconds,
            interval_seconds,
        ),
    )

    if existing:
        raise ValueError("Equivalent active schedule already exists")

    rows = await run_query(
        """
        INSERT INTO farm_schedule (
            task_name,
            description,
            task_action,
            level_no,
            start_time,
            interval_seconds,
            duration_seconds,
            target_value,
            unit,
            next_run_at,
            enabled,
            status
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s::time,
            %s,
            %s,
            %s,
            %s,
            CASE
                WHEN CURRENT_DATE + %s::time > NOW()
                THEN CURRENT_DATE + %s::time
                ELSE CURRENT_DATE + %s::time + INTERVAL '1 day'
            END,
            TRUE,
            'ACTIVE'
        )
        RETURNING schedule_id;
        """,
        (
            action_data.get("task_name"),
            action_data.get("task_description"),
            action_data.get("task_action"),
            action_data.get("level_no"),
            action_data.get("start_time"),
            interval_seconds,
            action_data.get("duration_seconds"),
            action_data.get("target_value"),
            action_data.get("unit"),
            action_data.get("start_time"),
            action_data.get("start_time"),
            action_data.get("start_time"),
        ),
    )

    if not rows:
        raise RuntimeError("Failed to create schedule")

    return rows[0][0]


async def _update_schedule(
    action_data: dict[str, Any],
) -> int:

    schedule_id = action_data.get("schedule_id")

    rows = await run_query(
        """
        UPDATE farm_schedule
        SET
            task_name = COALESCE(%s, task_name),
            description = COALESCE(%s, description),
            task_action = COALESCE(%s, task_action),
            level_no = COALESCE(%s, level_no),
            start_time = COALESCE(%s::time, start_time),
            interval_seconds = COALESCE(%s, interval_seconds),
            duration_seconds = COALESCE(%s, duration_seconds),
            target_value = COALESCE(%s, target_value),
            unit = COALESCE(%s, unit),

            next_run_at =
                CASE
                    WHEN CURRENT_DATE + COALESCE(%s::time, start_time) > NOW()
                    THEN CURRENT_DATE + COALESCE(%s::time, start_time)
                    ELSE CURRENT_DATE + COALESCE(%s::time, start_time) + INTERVAL '1 day'
                END,

            updated_at = NOW()

        WHERE schedule_id = %s

        RETURNING schedule_id;
        """,
        (
            action_data.get("task_name"),
            action_data.get("task_description"),
            action_data.get("task_action"),
            action_data.get("level_no"),
            action_data.get("start_time"),
            action_data.get("interval_seconds"),
            action_data.get("duration_seconds"),
            action_data.get("target_value"),
            action_data.get("unit"),
            action_data.get("start_time"),
            action_data.get("start_time"),
            action_data.get("start_time"),
            schedule_id,
        ),
    )

    if not rows:
        raise ValueError(f"Schedule {schedule_id} not found")

    return rows[0][0]


async def _enable_schedule(
    action_data: dict[str, Any],
) -> int:

    schedule_id = action_data.get("schedule_id")

    rows = await run_query(
        """
        UPDATE farm_schedule
        SET
            enabled = TRUE,
            status = 'ACTIVE',

            next_run_at =
                CASE
                    WHEN CURRENT_DATE + start_time > NOW()
                    THEN CURRENT_DATE + start_time
                    ELSE CURRENT_DATE + start_time + INTERVAL '1 day'
                END,

            updated_at = NOW()

        WHERE schedule_id = %s

        RETURNING schedule_id;
        """,
        (schedule_id,),
    )

    if not rows:
        raise ValueError(f"Schedule {schedule_id} not found")

    return rows[0][0]


async def _disable_schedule(
    action_data: dict[str, Any],
) -> int:

    schedule_id = action_data.get("schedule_id")

    rows = await run_query(
        """
        UPDATE farm_schedule
        SET
            enabled = FALSE,
            updated_at = NOW()
        WHERE schedule_id = %s
        RETURNING schedule_id;
        """,
        (schedule_id,),
    )

    if not rows:
        raise ValueError(f"Schedule {schedule_id} not found")

    return rows[0][0]


async def _run_scheduler_action(
    task: dict[str, Any],
) -> Any:

    action_type = task.get("action_type")

    action_data = task.get(
        "action_data",
        {},
    )

    if action_type == "CREATE_SCHEDULE":

        return await _create_schedule(action_data)

    if action_type == "UPDATE_SCHEDULE":

        return await _update_schedule(action_data)

    if action_type == "ENABLE_SCHEDULE":

        return await _enable_schedule(action_data)

    if action_type == "DISABLE_SCHEDULE":

        return await _disable_schedule(action_data)

    raise ValueError(f"Unsupported scheduler action: {action_type}")


async def _create_task_execution(
    task: dict[str, Any],
) -> int:

    rows = await run_query(
        """
        INSERT INTO task_executions (
            schedule_id,
            scheduled_for,
            status
        )
        VALUES (
            %s,
            %s,
            'PENDING'
        )
        RETURNING execution_id;
        """,
        (
            task.get("schedule_id"),
            task.get("next_run_at"),
        ),
    )

    if not rows:
        raise RuntimeError("Failed to create task execution")

    return rows[0][0]


async def _update_task_execution(
    execution_id: int,
    status: str,
    result: Any = None,
    error_message: str | None = None,
) -> None:

    await run_query(
        """
        UPDATE task_executions
        SET
            status = %s,
            result = %s,
            error_message = %s,

            started_at =
                CASE
                    WHEN %s = 'RUNNING'
                    THEN COALESCE(
                        started_at,
                        NOW()
                    )
                    ELSE started_at
                END,

            completed_at =
                CASE
                    WHEN %s IN (
                        'COMPLETED',
                        'FAILED',
                        'SKIPPED',
                        'BLOCKED'
                    )
                    THEN NOW()
                    ELSE completed_at
                END

        WHERE execution_id = %s;
        """,
        (
            status,
            (Jsonb(result) if result is not None else None),
            error_message,
            status,
            status,
            execution_id,
        ),
    )


async def _audit_task_execution(
    task: dict[str, Any],
    execution_id: int,
    status: str,
    result: Any = None,
    error: Exception | None = None,
) -> None:

    action_type = (
        "SCHEDULED_TASK_COMPLETED" if status == "COMPLETED" else "SCHEDULED_TASK_FAILED"
    )

    description = (
        f"Scheduled task {task.get('task_name')} completed successfully."
        if status == "COMPLETED"
        else f"Scheduled task {task.get('task_name')} failed."
    )

    scheduled_for = task.get("next_run_at")

    if hasattr(
        scheduled_for,
        "isoformat",
    ):
        scheduled_for = scheduled_for.isoformat()

    metadata = {
        "execution_id": execution_id,
        "schedule_id": task.get("schedule_id"),
        "task_name": task.get("task_name"),
        "task_action": task.get("task_action"),
        "level_no": task.get("level_no"),
        "scheduled_for": scheduled_for,
        "interval_seconds": task.get("interval_seconds"),
        "duration_seconds": task.get("duration_seconds"),
        "status": status,
    }

    if result is not None:
        metadata["result"] = result

    if error is not None:
        metadata["error_type"] = type(error).__name__

        metadata["error"] = str(error)

    async with get_connection() as conn:

        await audit_log(
            conn=conn,
            action_type=action_type,
            entity_type="task_execution",
            entity_id=execution_id,
            description=description,
            metadata=metadata,
        )


async def _run_farm_action(
    task: dict[str, Any],
) -> Any:

    task_action = task.get("task_action")

    handler = ACTION_HANDLERS.get(task_action)

    if handler is None:
        raise ValueError(f"No handler registered for scheduled action: {task_action}")

    return await handler(task)


async def _schedule_has_active_execution(
    schedule_id: int,
) -> bool:

    rows = await run_query(
        """
        SELECT EXISTS (
            SELECT 1
            FROM task_executions
            WHERE schedule_id = %s
              AND status IN (
                  'PENDING',
                  'RUNNING'
              )
        );
        """,
        (schedule_id,),
    )

    if not rows:
        return False

    return bool(rows[0][0])


async def _skip_missed_interval_occurrences(
    schedule_id: int,
) -> None:

    await run_query(
        """
        UPDATE farm_schedule
        SET
            next_run_at =
                NOW()
                + (
                    interval_seconds
                    * INTERVAL '1 second'
                ),

            updated_at = NOW()

        WHERE schedule_id = %s
          AND interval_seconds IS NOT NULL;
        """,
        (schedule_id,),
    )


async def run_scheduled_task(
    task: dict[str, Any],
) -> Any:

    if task.get("action_type"):

        return await _run_scheduler_action(task)

    if not task.get("task_action"):
        raise ValueError("Scheduled task contains no supported action")

    execution_id = await _create_task_execution(task)

    await _update_task_execution(
        execution_id=execution_id,
        status="RUNNING",
    )

    try:

        result = await _run_farm_action(task)

        execution_result = (
            result
            if result is not None
            else {
                "success": True,
            }
        )

        await _update_task_execution(
            execution_id=execution_id,
            status="COMPLETED",
            result=execution_result,
        )

        try:

            await _audit_task_execution(
                task=task,
                execution_id=execution_id,
                status="COMPLETED",
                result=execution_result,
            )

        except Exception:
            pass

        return result

    except Exception as error:

        await _update_task_execution(
            execution_id=execution_id,
            status="FAILED",
            error_message=str(error),
        )

        try:

            await _audit_task_execution(
                task=task,
                execution_id=execution_id,
                status="FAILED",
                error=error,
            )

        except Exception:
            pass

        raise


async def _run_background_task(
    task: dict[str, Any],
) -> None:

    try:

        await run_scheduled_task(task)

    except Exception:
        pass


async def _prepare_due_task(
    row,
) -> dict[str, Any]:

    schedule_id = row[0]
    interval_seconds = row[5]
    scheduled_for = row[10]

    await run_query(
        """
        UPDATE farm_schedule
        SET
            last_run_at = NOW(),

            next_run_at =
                CASE
                    WHEN interval_seconds IS NOT NULL
                    THEN
                        CASE
                            WHEN
                                next_run_at
                                + (
                                    interval_seconds
                                    * INTERVAL '1 second'
                                )
                                > NOW()
                            THEN
                                next_run_at
                                + (
                                    interval_seconds
                                    * INTERVAL '1 second'
                                )
                            ELSE
                                NOW()
                                + (
                                    interval_seconds
                                    * INTERVAL '1 second'
                                )
                        END

                    ELSE
                        CASE
                            WHEN CURRENT_DATE + start_time > NOW()
                            THEN CURRENT_DATE + start_time
                            ELSE CURRENT_DATE + start_time + INTERVAL '1 day'
                        END
                END,

            updated_at = NOW()

        WHERE schedule_id = %s;
        """,
        (schedule_id,),
    )

    return {
        "schedule_id": row[0],
        "task_name": row[1],
        "task_action": row[2],
        "level_no": row[3],
        "start_time": row[4],
        "interval_seconds": interval_seconds,
        "duration_seconds": row[6],
        "target_value": row[7],
        "unit": row[8],
        "last_run_at": row[9],
        "next_run_at": scheduled_for,
        "enabled": row[11],
        "status": row[12],
    }


async def _action_worker() -> None:

    while loop:

        task = await action_queue.get()

        try:

            await run_scheduled_task(task)

        except Exception:
            pass

        finally:

            action_queue.task_done()


async def start():

    global loop

    loop = True

    action_worker = asyncio.create_task(
        _action_worker(),
        name="scheduler-action-worker",
    )

    try:

        while loop:

            try:

                tasks = await get_due_tasks()

            except Exception:

                await asyncio.sleep(
                    settings.get(
                        "scheduler",
                        {},
                    ).get(
                        "polling_rate",
                        5,
                    )
                )

                continue

            for row in tasks:

                schedule_id = row[0]
                interval_seconds = row[5]

                if await _schedule_has_active_execution(schedule_id):

                    if interval_seconds is not None:

                        await _skip_missed_interval_occurrences(schedule_id)

                    continue

                task = await _prepare_due_task(row)

                asyncio.create_task(
                    _run_background_task(task),
                    name=f"scheduled-task-{schedule_id}",
                )

            await asyncio.sleep(
                settings.get(
                    "scheduler",
                    {},
                ).get(
                    "polling_rate",
                    5,
                )
            )

    finally:

        action_worker.cancel()

        await asyncio.gather(
            action_worker,
            return_exceptions=True,
        )


async def stop():

    global loop

    loop = False
