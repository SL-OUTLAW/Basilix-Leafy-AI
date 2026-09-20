from typing import Any

from psycopg.types.json import Jsonb

from engine.managers.db_manager import run_query

VALID_SEVERITIES = {
    "INFO",
    "WARN",
    "CRITICAL",
}


async def create_notification(
    notification_type: str,
    severity: str,
    title: str,
    message: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> int:

    if severity not in VALID_SEVERITIES:
        raise ValueError(f"Invalid notification severity: {severity}")

    rows = await run_query(
        """
        INSERT INTO notifications (
            notification_type,
            severity,
            title,
            message,
            audience,
            entity_type,
            entity_id,
            metadata,
            status
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            'ALL',
            %s,
            %s,
            %s,
            'OPEN'
        )
        RETURNING notification_id;
        """,
        (
            notification_type,
            severity,
            title,
            message,
            entity_type,
            entity_id,
            (Jsonb(metadata) if metadata is not None else None),
        ),
    )

    if not rows:
        raise RuntimeError("Failed to create notification")

    return rows[0][0]


async def get_notifications(
    status: str | None = None,
    severity: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:

    rows = await run_query(
        """
        SELECT
            notification_id,
            notification_type,
            severity,
            title,
            message,
            audience,
            entity_type,
            entity_id,
            metadata,
            status,
            created_at,
            resolved_at
        FROM notifications
        WHERE (
            %s::varchar IS NULL
            OR status = %s
        )
          AND (
            %s::varchar IS NULL
            OR severity = %s
        )
        ORDER BY created_at DESC
        LIMIT %s;
        """,
        (
            status,
            status,
            severity,
            severity,
            limit,
        ),
    )

    return [
        {
            "notification_id": row[0],
            "notification_type": row[1],
            "severity": row[2],
            "title": row[3],
            "message": row[4],
            "audience": row[5],
            "entity_type": row[6],
            "entity_id": row[7],
            "metadata": row[8],
            "status": row[9],
            "created_at": (row[10].isoformat() if row[10] is not None else None),
            "resolved_at": (row[11].isoformat() if row[11] is not None else None),
        }
        for row in rows
    ]


async def resolve_notification(
    notification_id: int,
) -> bool:

    rows = await run_query(
        """
        UPDATE notifications
        SET
            status = 'RESOLVED',
            resolved_at = NOW()
        WHERE notification_id = %s
          AND status = 'OPEN'
        RETURNING notification_id;
        """,
        (notification_id,),
    )

    return bool(rows)


async def resolve_sensor_notification(
    sensor_id: int,
) -> None:

    await run_query(
        """
        UPDATE notifications
        SET
            status = 'RESOLVED',
            resolved_at = NOW()
        WHERE entity_type = 'sensor'
          AND entity_id = %s
          AND notification_type = 'SENSOR_THRESHOLD'
          AND status = 'OPEN';
        """,
        (sensor_id,),
    )
