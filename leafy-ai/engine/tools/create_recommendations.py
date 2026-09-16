from typing import Any

from psycopg.types.json import Jsonb

from engine.managers.db_manager import run_query

SUPPORTED_RECOMMENDATION_TYPES = {
    "PH",
    "EC",
    "TEMPERATURE",
    "LIGHTING",
    "IRRIGATION",
    "PLANT_HEALTH",
    "PLANT_SPACING",
    "HARVEST",
    "MONITORING",
    "SCHEDULE",
    "OTHER",
}


SUPPORTED_ACTION_TYPES = {
    "RUN_IRRIGATION",
    "SET_LIGHTING",
    "SET_FAN",
    "DOSE_PH",
    "DOSE_EC",
    "CREATE_SCHEDULE",
    "UPDATE_SCHEDULE",
    "ENABLE_SCHEDULE",
    "DISABLE_SCHEDULE",
}


async def create_recommendations(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    recommendations = arguments.get("recommendations")

    if not isinstance(
        recommendations,
        list,
    ):
        raise ValueError("recommendations must be a list")

    if not recommendations:
        raise ValueError("At least one recommendation is required")

    created = []

    for recommendation in recommendations:

        if not isinstance(
            recommendation,
            dict,
        ):
            raise ValueError("Each recommendation must be an object")

        recommendation_type = recommendation.get("recommendation_type")

        if recommendation_type not in SUPPORTED_RECOMMENDATION_TYPES:
            raise ValueError("Unsupported recommendation type")

        level_no = recommendation.get("level_no")

        if level_no not in (0, 1, 2):
            raise ValueError("level_no must be 0, 1, or 2")

        recommendation_message = recommendation.get("recommendation_message")

        recommendation_reason = recommendation.get("recommendation_reason")

        if (
            not isinstance(
                recommendation_message,
                str,
            )
            or not recommendation_message.strip()
        ):
            raise ValueError("recommendation message is required")

        if (
            not isinstance(
                recommendation_reason,
                str,
            )
            or not recommendation_reason.strip()
        ):
            raise ValueError("recommendation_reason is required")

        proposed_action = recommendation.get("proposed_action")

        if proposed_action is not None:

            if not isinstance(
                proposed_action,
                dict,
            ):
                raise ValueError("proposed_action must be an object")

            action_type = proposed_action.get("action_type")

            if action_type not in SUPPORTED_ACTION_TYPES:
                raise ValueError("Unsupported proposed action type")

            action_data = proposed_action.get("action_data")

            if action_data is not None:

                if not isinstance(
                    action_data,
                    dict,
                ):
                    raise ValueError("action_data must be an object")

        query = """
            INSERT INTO ai_recommendations (
                recommendation_type,
                level_no,
                recommendation_message,
                recommendation_reason,
                proposed_action,
                status
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                'PENDING'
            )
            RETURNING
                recommendation_id,
                created_at;
        """

        rows = await run_query(
            query,
            (
                recommendation_type,
                level_no,
                recommendation_message,
                recommendation_reason,
                (Jsonb(proposed_action) if proposed_action is not None else None),
            ),
        )

        if not rows:
            raise RuntimeError("Recommendation insert returned no result")

        recommendation_id = rows[0][0]
        created_at = rows[0][1]

        created.append(
            {
                "recommendation_id": (recommendation_id),
                "recommendation_type": (recommendation_type),
                "level_no": level_no,
                "recommendation_message": (recommendation_message),
                "recommendation_reason": (recommendation_reason),
                "proposed_action": (proposed_action),
                "status": "PENDING",
                "created_at": (created_at.isoformat()),
            }
        )

    return {
        "success": True,
        "created_count": len(created),
        "recommendations": created,
    }
