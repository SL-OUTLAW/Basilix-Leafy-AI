from typing import Any

import asyncio
import selectors

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb


async def audit_log(
    conn: AsyncConnection,
    action_type: str,
    description: str,
    user_id: int | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> int:

    query = """
        INSERT INTO audit_logs (
            user_id,
            action_type,
            entity_id,
            entity_type,
            description,
            metadata
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s
        )
        RETURNING log_id;
    """

    async with conn.cursor() as cur:
        await cur.execute(
            query,
            (
                user_id,
                action_type,
                entity_id,
                entity_type,
                description,
                Jsonb(metadata) if metadata is not None else None,
            ),
        )

        result = await cur.fetchone()

    if result is None:
        raise RuntimeError("Audit insert returned no log_id")

    return result[0]
