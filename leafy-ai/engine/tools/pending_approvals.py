from typing import Any

from engine.managers.db_manager import run_query


async def pending_approvals(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    rows = await run_query("""
        SELECT
            ar.approval_id,
            ar.recommendation_id,
            ar.action_type,
            ar.action_data,
            ar.risk_level,
            ar.status,
            ar.requested_by,
            ar.reviewed_by,
            ar.requested_at,
            ar.reviewed_at,
            ar.review_note
        FROM approval_requests ar
        WHERE ar.status = 'PENDING'
        ORDER BY ar.requested_at DESC;
        """)

    approvals = []

    for row in rows:
        approvals.append(
            {
                "approval_id": row[0],
                "recommendation_id": row[1],
                "action_type": row[2],
                "action_data": row[3],
                "risk_level": row[4],
                "status": row[5],
                "requested_by": row[6],
                "reviewed_by": row[7],
                "requested_at": (row[8].isoformat() if row[8] is not None else None),
                "reviewed_at": (row[9].isoformat() if row[9] is not None else None),
                "review_note": row[10],
            }
        )

    return {
        "count": len(approvals),
        "approvals": approvals,
    }
