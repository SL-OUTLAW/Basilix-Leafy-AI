from typing import Any

from psycopg import AsyncConnection

from engine.managers.db_manager import (
    get_connection,
    run_query,
)


async def get_active_grow_cycle_id(
    conn: AsyncConnection | None = None,
) -> int | None:

    rows = await run_query(
        """
        SELECT
            grow_cycle_id
        FROM grow_cycles
        WHERE status = 'ACTIVE'
        LIMIT 1;
        """,
        conn=conn,
    )

    if not rows:
        return None

    return rows[0][0]


async def get_active_grow_cycle() -> dict[str, Any] | None:

    rows = await run_query("""
        SELECT
            grow_cycle_id,
            cycle_name,
            started_at,
            completed_at,
            status,
            notes,
            created_at,
            updated_at
        FROM grow_cycles
        WHERE status = 'ACTIVE'
        LIMIT 1;
        """)

    if not rows:
        return None

    row = rows[0]

    return {
        "grow_cycle_id": row[0],
        "cycle_name": row[1],
        "started_at": (row[2].isoformat() if row[2] is not None else None),
        "completed_at": (row[3].isoformat() if row[3] is not None else None),
        "status": row[4],
        "notes": row[5],
        "created_at": (row[6].isoformat() if row[6] is not None else None),
        "updated_at": (row[7].isoformat() if row[7] is not None else None),
    }


async def create_grow_cycle(
    cycle_name: str,
    notes: str | None = None,
) -> dict[str, Any]:

    if not cycle_name.strip():
        raise ValueError("cycle_name is required.")

    async with get_connection() as conn:
        async with conn.transaction():

            active_cycle = await get_active_grow_cycle_id(
                conn=conn,
            )

            if active_cycle is not None:
                raise ValueError("A grow cycle is already active.")

            rows = await run_query(
                """
                INSERT INTO grow_cycles (
                    cycle_name,
                    notes,
                    status
                )
                VALUES (
                    %s,
                    %s,
                    'ACTIVE'
                )
                RETURNING
                    grow_cycle_id,
                    started_at;
                """,
                (
                    cycle_name.strip(),
                    notes,
                ),
                conn=conn,
            )

            if not rows:
                raise RuntimeError("Failed to create grow cycle.")

            grow_cycle_id = rows[0][0]

            await snapshot_current_schedules(
                grow_cycle_id=grow_cycle_id,
                conn=conn,
            )

    return {
        "grow_cycle_id": grow_cycle_id,
        "cycle_name": cycle_name.strip(),
        "status": "ACTIVE",
        "started_at": rows[0][1].isoformat(),
    }


async def update_grow_cycle(
    grow_cycle_id: int,
    cycle_name: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:

    if cycle_name is not None and not cycle_name.strip():
        raise ValueError("cycle_name cannot be empty.")

    rows = await run_query(
        """
        UPDATE grow_cycles
        SET
            cycle_name = COALESCE(%s, cycle_name),
            notes = %s,
            updated_at = NOW()
        WHERE grow_cycle_id = %s
        RETURNING
            grow_cycle_id, cycle_name, started_at, completed_at,
            status, notes, created_at, updated_at;
        """,
        (cycle_name.strip() if cycle_name is not None else None, notes, grow_cycle_id),
    )

    if not rows:
        raise ValueError("Grow cycle not found.")

    row = rows[0]
    return {
        "grow_cycle_id": row[0],
        "cycle_name": row[1],
        "started_at": row[2].isoformat() if row[2] is not None else None,
        "completed_at": row[3].isoformat() if row[3] is not None else None,
        "status": row[4],
        "notes": row[5],
        "created_at": row[6].isoformat() if row[6] is not None else None,
        "updated_at": row[7].isoformat() if row[7] is not None else None,
    }


async def delete_grow_cycle(grow_cycle_id: int) -> bool:
    rows = await run_query(
        """
        DELETE FROM grow_cycles
        WHERE grow_cycle_id = %s
        RETURNING grow_cycle_id;
        """,
        (grow_cycle_id,),
    )
    return bool(rows)


async def snapshot_current_schedules(
    grow_cycle_id: int,
    conn: AsyncConnection | None = None,
) -> None:

    schedules = await run_query(
        """
        SELECT
            schedule_id,
            task_name,
            description,
            task_action,
            level_no,
            start_time,
            interval_seconds,
            duration_seconds,
            target_value,
            unit,
            enabled,
            status
        FROM farm_schedule
        WHERE status = 'ACTIVE'
        ORDER BY schedule_id;
        """,
        conn=conn,
    )

    for schedule in schedules:

        await run_query(
            """
            INSERT INTO grow_cycle_schedule_history (
                grow_cycle_id,
                schedule_id,
                task_name,
                description,
                task_action,
                level_no,
                start_time,
                interval_seconds,
                duration_seconds,
                target_value,
                unit,
                enabled,
                status,
                valid_from
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                NOW()
            );
            """,
            (
                grow_cycle_id,
                schedule[0],
                schedule[1],
                schedule[2],
                schedule[3],
                schedule[4],
                schedule[5],
                schedule[6],
                schedule[7],
                schedule[8],
                schedule[9],
                schedule[10],
                schedule[11],
            ),
            conn=conn,
        )


async def record_schedule_change(
    schedule_id: int,
    conn: AsyncConnection | None = None,
) -> None:

    grow_cycle_id = await get_active_grow_cycle_id(
        conn=conn,
    )

    if grow_cycle_id is None:
        return

    rows = await run_query(
        """
        SELECT
            schedule_id,
            task_name,
            description,
            task_action,
            level_no,
            start_time,
            interval_seconds,
            duration_seconds,
            target_value,
            unit,
            enabled,
            status
        FROM farm_schedule
        WHERE schedule_id = %s;
        """,
        (schedule_id,),
        conn=conn,
    )

    if not rows:
        return

    schedule = rows[0]

    await run_query(
        """
        UPDATE grow_cycle_schedule_history
        SET
            valid_until = NOW()
        WHERE grow_cycle_id = %s
          AND schedule_id = %s
          AND valid_until IS NULL;
        """,
        (
            grow_cycle_id,
            schedule_id,
        ),
        conn=conn,
    )

    await run_query(
        """
        INSERT INTO grow_cycle_schedule_history (
            grow_cycle_id,
            schedule_id,
            task_name,
            description,
            task_action,
            level_no,
            start_time,
            interval_seconds,
            duration_seconds,
            target_value,
            unit,
            enabled,
            status,
            valid_from
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            NOW()
        );
        """,
        (
            grow_cycle_id,
            schedule[0],
            schedule[1],
            schedule[2],
            schedule[3],
            schedule[4],
            schedule[5],
            schedule[6],
            schedule[7],
            schedule[8],
            schedule[9],
            schedule[10],
            schedule[11],
        ),
        conn=conn,
    )


async def record_harvest(
    harvest_weight_g: float,
    plant_count_harvested: int | None = None,
    quality_score: float | None = None,
    notes: str | None = None,
) -> dict[str, Any]:

    grow_cycle_id = await get_active_grow_cycle_id()

    if grow_cycle_id is None:
        raise ValueError("There is no active grow cycle.")

    if harvest_weight_g < 0:
        raise ValueError("harvest_weight_g cannot be negative.")

    if plant_count_harvested is not None and plant_count_harvested < 0:
        raise ValueError("plant_count_harvested cannot be negative.")

    if quality_score is not None and (quality_score < 0 or quality_score > 10):
        raise ValueError("quality_score must be between 0 and 10.")

    rows = await run_query(
        """
        INSERT INTO harvest_records (
            grow_cycle_id,
            harvest_weight_g,
            plant_count_harvested,
            quality_score,
            notes
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s
        )
        RETURNING
            harvest_id,
            harvested_at;
        """,
        (
            grow_cycle_id,
            harvest_weight_g,
            plant_count_harvested,
            quality_score,
            notes,
        ),
    )

    if not rows:
        raise RuntimeError("Failed to record harvest.")

    return {
        "harvest_id": rows[0][0],
        "grow_cycle_id": grow_cycle_id,
        "harvested_at": rows[0][1].isoformat(),
        "harvest_weight_g": float(harvest_weight_g),
        "plant_count_harvested": (plant_count_harvested),
        "quality_score": quality_score,
        "notes": notes,
    }


async def complete_grow_cycle(
    grow_cycle_id: int | None = None,
) -> dict[str, Any]:

    async with get_connection() as conn:
        async with conn.transaction():

            if grow_cycle_id is None:
                grow_cycle_id = await get_active_grow_cycle_id(
                    conn=conn,
                )

            if grow_cycle_id is None:
                raise ValueError("There is no active grow cycle.")

            rows = await run_query(
                """
                UPDATE grow_cycles
                SET
                    status = 'COMPLETED',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE grow_cycle_id = %s
                  AND status = 'ACTIVE'
                RETURNING
                    grow_cycle_id,
                    completed_at;
                """,
                (grow_cycle_id,),
                conn=conn,
            )

            if not rows:
                raise ValueError("Active grow cycle not found.")

            await run_query(
                """
                UPDATE grow_cycle_schedule_history
                SET
                    valid_until = NOW()
                WHERE grow_cycle_id = %s
                  AND valid_until IS NULL;
                """,
                (grow_cycle_id,),
                conn=conn,
            )

    return {
        "grow_cycle_id": rows[0][0],
        "status": "COMPLETED",
        "completed_at": rows[0][1].isoformat(),
    }


async def cancel_grow_cycle(
    grow_cycle_id: int | None = None,
) -> dict[str, Any]:

    async with get_connection() as conn:
        async with conn.transaction():

            if grow_cycle_id is None:
                grow_cycle_id = await get_active_grow_cycle_id(
                    conn=conn,
                )

            if grow_cycle_id is None:
                raise ValueError("There is no active grow cycle.")

            rows = await run_query(
                """
                UPDATE grow_cycles
                SET
                    status = 'CANCELLED',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE grow_cycle_id = %s
                  AND status = 'ACTIVE'
                RETURNING
                    grow_cycle_id,
                    completed_at;
                """,
                (grow_cycle_id,),
                conn=conn,
            )

            if not rows:
                raise ValueError("Active grow cycle not found.")

            await run_query(
                """
                UPDATE grow_cycle_schedule_history
                SET
                    valid_until = NOW()
                WHERE grow_cycle_id = %s
                  AND valid_until IS NULL;
                """,
                (grow_cycle_id,),
                conn=conn,
            )

    return {
        "grow_cycle_id": rows[0][0],
        "status": "CANCELLED",
        "completed_at": rows[0][1].isoformat(),
    }


async def get_harvest_data(
    limit: int = 10,
    include_active: bool = True,
) -> dict[str, Any]:

    if limit < 1:
        limit = 1

    if limit > 50:
        limit = 50

    if include_active:

        cycles = await run_query(
            """
            SELECT
                grow_cycle_id,
                cycle_name,
                started_at,
                completed_at,
                status,
                notes
            FROM grow_cycles
            ORDER BY started_at DESC
            LIMIT %s;
            """,
            (limit,),
        )

    else:

        cycles = await run_query(
            """
            SELECT
                grow_cycle_id,
                cycle_name,
                started_at,
                completed_at,
                status,
                notes
            FROM grow_cycles
            WHERE status = 'COMPLETED'
            ORDER BY completed_at DESC
            LIMIT %s;
            """,
            (limit,),
        )

    result = []

    for cycle in cycles:

        grow_cycle_id = cycle[0]

        harvest_rows = await run_query(
            """
            SELECT
                harvest_id,
                harvested_at,
                harvest_weight_g,
                plant_count_harvested,
                quality_score,
                notes
            FROM harvest_records
            WHERE grow_cycle_id = %s
            ORDER BY harvested_at;
            """,
            (grow_cycle_id,),
        )

        schedule_rows = await run_query(
            """
            SELECT
                grow_cycle_schedule_id,
                schedule_id,
                task_name,
                description,
                task_action,
                level_no,
                start_time,
                interval_seconds,
                duration_seconds,
                target_value,
                unit,
                enabled,
                status,
                valid_from,
                valid_until
            FROM grow_cycle_schedule_history
            WHERE grow_cycle_id = %s
            ORDER BY
                valid_from,
                grow_cycle_schedule_id;
            """,
            (grow_cycle_id,),
        )

        harvests = []

        total_harvest_weight_g = 0.0

        total_plants_harvested = 0

        has_plant_count = False

        quality_total = 0.0

        quality_entries = 0

        for harvest in harvest_rows:

            harvest_weight = float(harvest[2])

            plant_count = harvest[3]

            quality_score = float(harvest[4]) if harvest[4] is not None else None

            total_harvest_weight_g += harvest_weight

            if plant_count is not None:

                total_plants_harvested += plant_count

                has_plant_count = True

            if quality_score is not None:

                quality_total += quality_score

                quality_entries += 1

            harvests.append(
                {
                    "harvest_id": harvest[0],
                    "harvested_at": (
                        harvest[1].isoformat() if harvest[1] is not None else None
                    ),
                    "harvest_weight_g": (harvest_weight),
                    "plant_count_harvested": (plant_count),
                    "quality_score": (quality_score),
                    "notes": harvest[5],
                }
            )

        schedule_history = []

        for schedule in schedule_rows:

            schedule_history.append(
                {
                    "grow_cycle_schedule_id": (schedule[0]),
                    "schedule_id": schedule[1],
                    "task_name": schedule[2],
                    "description": schedule[3],
                    "task_action": schedule[4],
                    "level_no": schedule[5],
                    "start_time": (
                        schedule[6].isoformat() if schedule[6] is not None else None
                    ),
                    "interval_seconds": (schedule[7]),
                    "duration_seconds": (schedule[8]),
                    "target_value": (
                        float(schedule[9]) if schedule[9] is not None else None
                    ),
                    "unit": schedule[10],
                    "enabled": schedule[11],
                    "status": schedule[12],
                    "valid_from": (
                        schedule[13].isoformat() if schedule[13] is not None else None
                    ),
                    "valid_until": (
                        schedule[14].isoformat() if schedule[14] is not None else None
                    ),
                }
            )

        yield_per_plant_g = None

        if has_plant_count and total_plants_harvested > 0:

            yield_per_plant_g = total_harvest_weight_g / total_plants_harvested

        result.append(
            {
                "grow_cycle_id": grow_cycle_id,
                "cycle_name": cycle[1],
                "started_at": (cycle[2].isoformat() if cycle[2] is not None else None),
                "completed_at": (
                    cycle[3].isoformat() if cycle[3] is not None else None
                ),
                "status": cycle[4],
                "notes": cycle[5],
                "harvest_summary": {
                    "harvest_count": len(harvests),
                    "total_harvest_weight_g": (total_harvest_weight_g),
                    "total_plants_harvested": (
                        total_plants_harvested if has_plant_count else None
                    ),
                    "yield_per_plant_g": (yield_per_plant_g),
                    "average_quality_score": (
                        quality_total / quality_entries if quality_entries > 0 else None
                    ),
                },
                "harvests": harvests,
                "schedule_history": (schedule_history),
            }
        )

    return {
        "count": len(result),
        "grow_cycles": result,
    }
