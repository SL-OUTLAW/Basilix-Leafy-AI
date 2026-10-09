from typing import Any

from engine.managers.db_manager import get_connection
from engine.managers.scheduler import queue_scheduler_action


async def approve_request(
    approval_id: int,
    reviewed_by: int | None = None,
    review_note: str | None = None,
) -> dict[str, Any]:

    async with get_connection() as conn:

        async with conn.cursor() as cur:

            await cur.execute(
                """
                SELECT
                    approval_id,
                    recommendation_id,
                    action_type,
                    action_data,
                    status
                FROM approval_requests
                WHERE approval_id = %s
                FOR UPDATE;
                """,
                (approval_id,),
            )

            row = await cur.fetchone()

            if row is None:
                raise ValueError("Approval request not found")

            if row[4] != "PENDING":
                raise ValueError("Approval request is not pending")

            recommendation_id = row[1]
            action_type = row[2]
            action_data = row[3]

            await cur.execute(
                """
                UPDATE approval_requests
                SET
                    status = 'APPROVED',
                    reviewed_by = %s,
                    reviewed_at = NOW(),
                    review_note = %s
                WHERE approval_id = %s;
                """,
                (
                    reviewed_by,
                    review_note,
                    approval_id,
                ),
            )

            await cur.execute(
                """
                UPDATE ai_recommendations
                SET
                    status = 'APPROVED',
                    reviewed_by = %s,
                    reviewed_at = NOW()
                WHERE recommendation_id = %s;
                """,
                (
                    reviewed_by,
                    recommendation_id,
                ),
            )

            await conn.commit()

    await queue_scheduler_action(
        action_type=action_type,
        action_data=action_data,
        recommendation_id=recommendation_id,
        approval_id=approval_id,
    )

    return {
        "approval_id": approval_id,
        "recommendation_id": recommendation_id,
        "status": "APPROVED",
        "queued_for_execution": True,
    }


async def reject_request(
    approval_id: int,
    reviewed_by: int | None = None,
    review_note: str | None = None,
) -> dict[str, Any]:

    async with get_connection() as conn:

        async with conn.cursor() as cur:

            await cur.execute(
                """
                SELECT
                    recommendation_id,
                    status
                FROM approval_requests
                WHERE approval_id = %s
                FOR UPDATE;
                """,
                (approval_id,),
            )

            row = await cur.fetchone()

            if row is None:
                raise ValueError("Approval request not found")

            if row[1] != "PENDING":
                raise ValueError("Approval request is not pending")

            recommendation_id = row[0]

            await cur.execute(
                """
                UPDATE approval_requests
                SET
                    status = 'REJECTED',
                    reviewed_by = %s,
                    reviewed_at = NOW(),
                    review_note = %s
                WHERE approval_id = %s;
                """,
                (
                    reviewed_by,
                    review_note,
                    approval_id,
                ),
            )

            await cur.execute(
                """
                UPDATE ai_recommendations
                SET
                    status = 'REJECTED',
                    reviewed_by = %s,
                    reviewed_at = NOW()
                WHERE recommendation_id = %s;
                """,
                (
                    reviewed_by,
                    recommendation_id,
                ),
            )

            await conn.commit()

    return {
        "approval_id": approval_id,
        "recommendation_id": recommendation_id,
        "status": "REJECTED",
        "queued_for_execution": False,
    }
