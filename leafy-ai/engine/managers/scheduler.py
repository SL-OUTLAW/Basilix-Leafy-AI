import asyncio

from managers.db_manager import run_query


POLL_INTERVAL = 5


async def get_due_tasks():
    return await run_query(
        """
        SELECT
            schedule_id,
            task_name,
            task_action,
            level_no,
            start_time,
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
        """
    )


async def create_notification(message):
    print(message)


async def run_scheduled_task(task):
    print(f"Running scheduled task: {task[1]}")


async def scheduler_loop():
    while True:
        try:
            tasks = await get_due_tasks()
        except Exception as error:
            print(f"Scheduler query failed: {error}")
            await asyncio.sleep(POLL_INTERVAL)
            continue

        for task in tasks:
            asyncio.create_task(run_scheduled_task(task))

        await asyncio.sleep(POLL_INTERVAL)
