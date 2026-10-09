from typing import Any

from engine.managers.db_manager import run_query


async def pending_recommendations(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    rows = await run_query("""
        SELECT
            recommendation_id,
            recommendation_type,
            level_no,
            recommendation_message,
            recommendation_reason,
            evidence,
            risk_level,
            requires_approval,
            status,
            proposed_action,
            created_at
        FROM ai_recommendations
        WHERE status = 'PENDING'
        ORDER BY created_at DESC;
        """)

    recommendations = []

    for row in rows:
        recommendations.append(
            {
                "recommendation_id": row[0],
                "recommendation_type": row[1],
                "level_no": row[2],
                "recommendation_message": row[3],
                "recommendation_reason": row[4],
                "evidence": row[5],
                "risk_level": row[6],
                "requires_approval": row[7],
                "status": row[8],
                "proposed_action": row[9],
                "created_at": (row[10].isoformat() if row[10] is not None else None),
            }
        )

    return {
        "count": len(recommendations),
        "recommendations": recommendations,
    }
