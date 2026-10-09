import asyncio

from datetime import datetime

from typing import Any, Awaitable, Callable


from psycopg import AsyncConnection
from psycopg.types.json import Jsonb


from engine.logger.logger import audit_log

from engine.managers.db_manager import (
    get_connection,
    run_query,
)

from engine.managers.grow_cycle_manager import (
    record_schedule_change,
)

from engine.managers.settings_manager import settings

loop = False


action_queue: asyncio.Queue = asyncio.Queue()


ACTION_HANDLERS: dict[
    str,
    Callable[
        [dict[str, Any]],
        Awaitable[Any],
    ],
] = {}


TIMED_TASK_ACTIONS = {
    "SET_LIGHTING",
    "RUN_IRRIGATION",
    "SET_FAN",
}


def register_action_handler(
    action_type: str,
    handler: Callable[
        [dict[str, Any]],
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
            active_until_at,
            enabled,
            status
        FROM farm_schedule
        WHERE enabled = TRUE
          AND status = 'ACTIVE'
          AND next_run_at IS NOT NULL
          AND next_run_at <= NOW()
          AND active_until_at IS NULL
        ORDER BY next_run_at;
    """)


async def get_due_timed_ends():

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
            active_until_at,
            enabled,
            status
        FROM farm_schedule
        WHERE active_until_at IS NOT NULL
          AND active_until_at <= NOW()
          AND task_action IN (
              'SET_LIGHTING',
              'RUN_IRRIGATION',
              'SET_FAN'
          )
        ORDER BY active_until_at;
    """)


def _validate_timing(
    action_data: dict[str, Any],
) -> None:

    interval_seconds = action_data.get("interval_seconds")

    duration_seconds = action_data.get("duration_seconds")

    task_action = action_data.get("task_action")

    if interval_seconds is not None:

        try:
            interval_seconds = int(interval_seconds)

        except (
            TypeError,
            ValueError,
        ) as error:

            raise ValueError("interval_seconds must be a positive integer.") from error

        if interval_seconds <= 0:

            raise ValueError("interval_seconds must be greater than zero.")

    if duration_seconds is not None:

        try:
            duration_seconds = int(duration_seconds)

        except (
            TypeError,
            ValueError,
        ) as error:

            raise ValueError("duration_seconds must be a positive integer.") from error

        if duration_seconds <= 0:

            raise ValueError("duration_seconds must be greater than zero.")

    if task_action in TIMED_TASK_ACTIONS and duration_seconds is None:

        raise ValueError(f"{task_action} schedule requires duration_seconds.")

    if (
        task_action in TIMED_TASK_ACTIONS
        and interval_seconds is not None
        and duration_seconds is not None
        and duration_seconds >= interval_seconds
    ):

        raise ValueError(
            "duration_seconds must be shorter than interval_seconds "
            "for repeating timed schedules."
        )

    if task_action in {
        "DOSE_PH",
        "DOSE_EC",
    }:

        if action_data.get("target_value") is None:

            raise ValueError(f"{task_action} schedule requires target_value.")

        if duration_seconds is not None:

            raise ValueError(f"{task_action} schedule does not use duration_seconds.")


async def _create_schedule(
    action_data: dict[str, Any],
    conn: AsyncConnection | None = None,
) -> int:

    _validate_timing(action_data)

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
        conn=conn,
    )

    if existing:

        raise ValueError("Equivalent active schedule already exists.")

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
            active_until_at,
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
            NULL,
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
        conn=conn,
    )

    if not rows:

        raise RuntimeError("Failed to create schedule.")

    return rows[0][0]


async def _update_schedule(
    action_data: dict[str, Any],
    conn: AsyncConnection | None = None,
) -> int:

    schedule_id = action_data.get("schedule_id")

    if schedule_id is None:

        raise ValueError("UPDATE_SCHEDULE requires schedule_id.")

    current_rows = await run_query(
        """
        SELECT
            task_name,
            description,
            task_action,
            level_no,
            start_time,
            interval_seconds,
            duration_seconds,
            target_value,
            unit
        FROM farm_schedule
        WHERE schedule_id = %s;
        """,
        (schedule_id,),
        conn=conn,
    )

    if not current_rows:

        raise ValueError(f"Schedule {schedule_id} not found.")

    current = current_rows[0]

    merged = {
        "task_name": current[0],
        "task_description": current[1],
        "task_action": current[2],
        "level_no": current[3],
        "start_time": current[4],
        "interval_seconds": current[5],
        "duration_seconds": current[6],
        "target_value": current[7],
        "unit": current[8],
    }

    for field in (
        "task_name",
        "task_description",
        "task_action",
        "level_no",
        "start_time",
        "interval_seconds",
        "duration_seconds",
        "target_value",
        "unit",
    ):

        if field in action_data:

            merged[field] = action_data[field]

    if merged.get("task_name") is None:

        raise ValueError("task_name cannot be null.")

    if merged.get("task_action") is None:

        raise ValueError("task_action cannot be null.")

    if merged.get("level_no") is None:

        raise ValueError("level_no cannot be null.")

    if merged.get("start_time") is None:

        raise ValueError("start_time cannot be null.")

    _validate_timing(merged)

    rows = await run_query(
        """
        UPDATE farm_schedule
        SET
            task_name = CASE
                WHEN %s THEN %s
                ELSE task_name
            END,
            description = CASE
                WHEN %s THEN %s
                ELSE description
            END,
            task_action = CASE
                WHEN %s THEN %s
                ELSE task_action
            END,
            level_no = CASE
                WHEN %s THEN %s
                ELSE level_no
            END,
            start_time = CASE
                WHEN %s THEN %s::time
                ELSE start_time
            END,
            interval_seconds = CASE
                WHEN %s THEN %s
                ELSE interval_seconds
            END,
            duration_seconds = CASE
                WHEN %s THEN %s
                ELSE duration_seconds
            END,
            target_value = CASE
                WHEN %s THEN %s
                ELSE target_value
            END,
            unit = CASE
                WHEN %s THEN %s
                ELSE unit
            END,
            next_run_at =
                CASE
                    WHEN %s
                    THEN NOW()
                         + (
                             %s
                             * INTERVAL '1 second'
                         )
                    WHEN CURRENT_DATE + %s::time > NOW()
                    THEN CURRENT_DATE + %s::time
                    ELSE CURRENT_DATE + %s::time + INTERVAL '1 day'
                END,
            updated_at = NOW()
        WHERE schedule_id = %s
        RETURNING schedule_id;
        """,
        (
            "task_name" in action_data,
            action_data.get("task_name"),
            "task_description" in action_data,
            action_data.get("task_description"),
            "task_action" in action_data,
            action_data.get("task_action"),
            "level_no" in action_data,
            action_data.get("level_no"),
            "start_time" in action_data,
            action_data.get("start_time"),
            "interval_seconds" in action_data,
            action_data.get("interval_seconds"),
            "duration_seconds" in action_data,
            action_data.get("duration_seconds"),
            "target_value" in action_data,
            action_data.get("target_value"),
            "unit" in action_data,
            action_data.get("unit"),
            merged.get("interval_seconds") is not None,
            merged.get("interval_seconds"),
            merged.get("start_time"),
            merged.get("start_time"),
            merged.get("start_time"),
            schedule_id,
        ),
        conn=conn,
    )

    if not rows:

        raise ValueError(f"Schedule {schedule_id} not found.")

    return rows[0][0]


async def _enable_schedule(
    action_data: dict[str, Any],
    conn: AsyncConnection | None = None,
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
                    WHEN interval_seconds IS NOT NULL
                    THEN NOW()
                         + (
                             interval_seconds
                             * INTERVAL '1 second'
                         )
                    WHEN CURRENT_DATE + start_time > NOW()
                    THEN CURRENT_DATE + start_time
                    ELSE CURRENT_DATE + start_time + INTERVAL '1 day'
                END,
            updated_at = NOW()
        WHERE schedule_id = %s
        RETURNING schedule_id;
        """,
        (schedule_id,),
        conn=conn,
    )

    if not rows:

        raise ValueError(f"Schedule {schedule_id} not found.")

    return rows[0][0]


async def _disable_schedule(
    action_data: dict[str, Any],
    conn: AsyncConnection | None = None,
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
        conn=conn,
    )

    if not rows:

        raise ValueError(f"Schedule {schedule_id} not found.")

    return rows[0][0]


async def _run_scheduler_action(
    task: dict[str, Any],
) -> Any:

    action_type = task.get("action_type")

    action_data = task.get(
        "action_data",
        {},
    )

    async with get_connection() as conn:
        async with conn.transaction():

            if action_type == "CREATE_SCHEDULE":

                schedule_id = await _create_schedule(
                    action_data,
                    conn=conn,
                )

            elif action_type == "UPDATE_SCHEDULE":

                schedule_id = await _update_schedule(
                    action_data,
                    conn=conn,
                )

            elif action_type == "ENABLE_SCHEDULE":

                schedule_id = await _enable_schedule(
                    action_data,
                    conn=conn,
                )

            elif action_type == "DISABLE_SCHEDULE":

                schedule_id = await _disable_schedule(
                    action_data,
                    conn=conn,
                )

            else:
                raise ValueError(f"Unsupported scheduler action: {action_type}")

            await record_schedule_change(
                schedule_id=schedule_id,
                conn=conn,
            )

    return schedule_id


async def _create_task_execution(
    task: dict[str, Any],
) -> int:

    scheduled_for = task.get("timer_end_at")

    if scheduled_for is None:

        scheduled_for = task.get("next_run_at")

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
            scheduled_for,
        ),
    )

    if not rows:

        raise RuntimeError("Failed to create task execution.")

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

    scheduled_for = task.get("timer_end_at")

    if scheduled_for is None:

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


async def _start_timer(
    schedule_id: int,
    duration_seconds: int,
) -> datetime | None:

    rows = await run_query(
        """
        UPDATE farm_schedule
        SET
            active_until_at =
                NOW()
                + (
                    %s
                    * INTERVAL '1 second'
                ),
            updated_at = NOW()
        WHERE schedule_id = %s
          AND active_until_at IS NULL
        RETURNING active_until_at;
        """,
        (
            duration_seconds,
            schedule_id,
        ),
    )

    if not rows:

        return None

    return rows[0][0]


async def _clear_timer(
    schedule_id: int,
    timer_end_at: datetime,
) -> None:

    await run_query(
        """
        UPDATE farm_schedule
        SET
            active_until_at = NULL,
            updated_at = NOW()
        WHERE schedule_id = %s
          AND active_until_at = %s;
        """,
        (
            schedule_id,
            timer_end_at,
        ),
    )


def _build_due_task(
    row,
) -> dict[str, Any]:

    return {
        "schedule_id": row[0],
        "task_name": row[1],
        "task_action": row[2],
        "level_no": row[3],
        "start_time": row[4],
        "interval_seconds": row[5],
        "duration_seconds": row[6],
        "target_value": row[7],
        "unit": row[8],
        "last_run_at": row[9],
        "next_run_at": row[10],
        "active_until_at": row[11],
        "enabled": True,
        "status": row[13],
    }


def _build_timed_end_task(
    row,
) -> dict[str, Any]:

    return {
        "schedule_id": row[0],
        "task_name": row[1],
        "task_action": row[2],
        "level_no": row[3],
        "start_time": row[4],
        "interval_seconds": row[5],
        "duration_seconds": row[6],
        "target_value": row[7],
        "unit": row[8],
        "last_run_at": row[9],
        "next_run_at": row[10],
        "timer_end_at": row[11],
        "active_until_at": row[11],
        "enabled": False,
        "status": row[13],
        "timed_end": True,
    }


async def _prepare_due_task(
    row,
) -> dict[str, Any]:

    schedule_id = row[0]

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

    return _build_due_task(row)


async def run_scheduled_task(
    task: dict[str, Any],
) -> Any:

    if task.get("action_type"):

        return await _run_scheduler_action(task)

    if not task.get("task_action"):

        raise ValueError("Scheduled task contains no supported action.")

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

        if task.get("timed_end"):

            timer_end_at = task.get("timer_end_at")

            if isinstance(
                timer_end_at,
                datetime,
            ):

                await _clear_timer(
                    schedule_id=task.get("schedule_id"),
                    timer_end_at=timer_end_at,
                )

        elif (
            task.get("enabled") is True
            and task.get("task_action") in TIMED_TASK_ACTIONS
        ):

            duration_seconds = task.get("duration_seconds")

            if (
                isinstance(
                    duration_seconds,
                    int,
                )
                and duration_seconds > 0
            ):

                active_until_at = await _start_timer(
                    schedule_id=task.get("schedule_id"),
                    duration_seconds=(duration_seconds),
                )

                if isinstance(
                    execution_result,
                    dict,
                ):

                    execution_result = {
                        **execution_result,
                        "active_until_at": (
                            active_until_at.isoformat()
                            if active_until_at is not None
                            else None
                        ),
                    }

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

        except Exception as audit_error:

            await _report_scheduler_error(
                error=audit_error,
                action_type="SCHEDULER_AUDIT_FAILED",
                task=task,
            )

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

        except Exception as audit_error:

            await _report_scheduler_error(
                error=audit_error,
                action_type="SCHEDULER_AUDIT_FAILED",
                task=task,
            )

        raise


async def _report_scheduler_error(
    error: Exception,
    action_type: str,
    task: dict[str, Any] | None = None,
) -> None:

    metadata = {
        "error_type": type(error).__name__,
        "error": str(error),
    }

    if task is not None:
        metadata.update(
            {
                "schedule_id": task.get("schedule_id"),
                "task_name": task.get("task_name"),
                "task_action": task.get("task_action"),
                "scheduler_action": task.get("action_type"),
            }
        )

    try:
        async with get_connection() as conn:
            await audit_log(
                conn=conn,
                action_type=action_type,
                entity_type="scheduler",
                entity_id=(task.get("schedule_id") if task is not None else None),
                description="The scheduler encountered an unexpected error.",
                metadata=metadata,
            )

    except Exception as audit_error:
        print(
            f"Scheduler error: {error}. " f"Audit logging also failed: {audit_error}."
        )


async def _run_background_task(
    task: dict[str, Any],
) -> None:

    try:

        await run_scheduled_task(task)

    except Exception as error:

        await _report_scheduler_error(
            error=error,
            action_type="SCHEDULER_BACKGROUND_TASK_FAILED",
            task=task,
        )


async def _action_worker() -> None:

    while loop:

        task = await action_queue.get()

        try:

            await run_scheduled_task(task)

        except Exception as error:

            await _report_scheduler_error(
                error=error,
                action_type="SCHEDULER_ACTION_FAILED",
                task=task,
            )

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

                timed_ends = await get_due_timed_ends()

                for row in timed_ends:

                    schedule_id = row[0]

                    if await _schedule_has_active_execution(schedule_id):

                        continue

                    asyncio.create_task(
                        _run_background_task(_build_timed_end_task(row)),
                        name=(f"timed-end-{schedule_id}"),
                    )

                tasks = await get_due_tasks()

            except Exception as error:

                await _report_scheduler_error(
                    error=error,
                    action_type="SCHEDULER_LOOP_FAILED",
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
                    name=(f"scheduled-task-{schedule_id}"),
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
