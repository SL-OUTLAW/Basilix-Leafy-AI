from typing import Any

from engine.managers.db_manager import run_query


async def daily_farm_schedule(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    query = """
        SELECT
            schedule_id,
            task_name,
            description,
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
        ORDER BY
            level_no ASC,
            start_time ASC,
            schedule_id ASC;
    """

    rows = await run_query(query)

    schedule = []

    for row in rows:
        schedule.append(
            {
                "schedule_id": row[0],
                "task_name": row[1],
                "description": row[2],
                "task_action": row[3],
                "level_no": row[4],
                "start_time": (row[5].isoformat() if row[5] is not None else None),
                "duration_seconds": row[6],
                "target_value": (float(row[7]) if row[7] is not None else None),
                "unit": row[8],
                "last_run_at": (row[9].isoformat() if row[9] is not None else None),
                "next_run_at": (row[10].isoformat() if row[10] is not None else None),
                "enabled": row[11],
                "status": row[12],
            }
        )

    global_tasks = [task for task in schedule if task["level_no"] == 0]

    level_1_tasks = [task for task in schedule if task["level_no"] == 1]

    level_2_tasks = [task for task in schedule if task["level_no"] == 2]

    return {
        "schedule_count": len(schedule),
        "global": global_tasks,
        "level_1": level_1_tasks,
        "level_2": level_2_tasks,
        "schedule": schedule,
    }
