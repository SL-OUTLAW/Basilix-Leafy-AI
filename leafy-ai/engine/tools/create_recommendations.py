from typing import Any

from psycopg.types.json import Jsonb

from engine.managers.db_manager import get_connection
from engine.security.risk_checker import (
    get_action_risk,
    requires_approval,
)
from engine.managers.scheduler import queue_scheduler_action

VALID_RECOMMENDATION_TYPES = {
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


VALID_SCHEDULER_ACTIONS = {
    "CREATE_SCHEDULE",
    "UPDATE_SCHEDULE",
    "ENABLE_SCHEDULE",
    "DISABLE_SCHEDULE",
}


VALID_TASK_ACTIONS = {
    "RUN_IRRIGATION",
    "SET_LIGHTING",
    "SET_FAN",
    "DOSE_PH",
    "DOSE_EC",
    "ANALYSE_FARM",
}


def _validate_level(
    level_no: Any,
) -> None:

    if level_no not in {
        0,
        1,
        2,
    }:
        raise ValueError("level_no must be 0, 1, or 2")


def _validate_task_scope(
    task_action: str,
    level_no: int,
) -> None:

    if task_action == "SET_LIGHTING" and level_no not in {
        1,
        2,
    }:
        raise ValueError("SET_LIGHTING must target level_no 1 or 2")

    if (
        task_action
        in {
            "RUN_IRRIGATION",
            "SET_FAN",
            "DOSE_PH",
            "DOSE_EC",
        }
        and level_no != 0
    ):
        raise ValueError(f"{task_action} must use level_no 0")


def _validate_duration(
    task_action: str,
    action_data: dict[str, Any],
) -> None:

    if task_action not in {
        "RUN_IRRIGATION",
        "SET_LIGHTING",
        "SET_FAN",
    }:
        return

    duration_seconds = action_data.get("duration_seconds")

    if duration_seconds is None:
        raise ValueError(f"{task_action} schedule requires duration_seconds")

    if (
        not isinstance(
            duration_seconds,
            int,
        )
        or isinstance(
            duration_seconds,
            bool,
        )
        or duration_seconds <= 0
    ):
        raise ValueError("duration_seconds must be a positive integer")


def _validate_create_schedule(
    action_data: dict[str, Any],
) -> None:

    required_fields = [
        "task_name",
        "task_action",
        "level_no",
        "start_time",
    ]

    missing_fields = [
        field for field in required_fields if action_data.get(field) is None
    ]

    if missing_fields:
        raise ValueError(
            f"CREATE_SCHEDULE missing required fields: {', '.join(missing_fields)}"
        )

    task_name = action_data.get("task_name")

    if (
        not isinstance(
            task_name,
            str,
        )
        or not task_name.strip()
    ):
        raise ValueError("task_name must be a non-empty string")

    task_action = action_data.get("task_action")

    if task_action not in VALID_TASK_ACTIONS:
        raise ValueError(f"Unsupported task_action: {task_action}")

    level_no = action_data.get("level_no")

    _validate_level(level_no)

    _validate_task_scope(
        task_action,
        level_no,
    )

    start_time = action_data.get("start_time")

    if (
        not isinstance(
            start_time,
            str,
        )
        or not start_time.strip()
    ):
        raise ValueError("start_time must be a non-empty string")

    _validate_duration(
        task_action,
        action_data,
    )


def _validate_update_schedule(
    action_data: dict[str, Any],
) -> None:

    schedule_id = action_data.get("schedule_id")

    if (
        not isinstance(
            schedule_id,
            int,
        )
        or isinstance(
            schedule_id,
            bool,
        )
        or schedule_id <= 0
    ):
        raise ValueError("UPDATE_SCHEDULE requires a valid schedule_id")

    update_fields = {
        "task_name",
        "task_description",
        "task_action",
        "level_no",
        "start_time",
        "duration_seconds",
        "target_value",
        "unit",
    }

    if not any(field in action_data for field in update_fields):
        raise ValueError("UPDATE_SCHEDULE requires at least one field to update")

    if "task_action" in action_data:

        task_action = action_data.get("task_action")

        if task_action not in VALID_TASK_ACTIONS:
            raise ValueError(f"Unsupported task_action: {task_action}")

    if "level_no" in action_data:
        _validate_level(action_data.get("level_no"))

    if "task_action" in action_data and "level_no" in action_data:
        _validate_task_scope(
            action_data.get("task_action"),
            action_data.get("level_no"),
        )

    if "duration_seconds" in action_data:

        duration_seconds = action_data.get("duration_seconds")

        if (
            not isinstance(
                duration_seconds,
                int,
            )
            or isinstance(
                duration_seconds,
                bool,
            )
            or duration_seconds <= 0
        ):
            raise ValueError("duration_seconds must be a positive integer")


def _validate_schedule_state_action(
    action_type: str,
    action_data: dict[str, Any],
) -> None:

    schedule_id = action_data.get("schedule_id")

    if (
        not isinstance(
            schedule_id,
            int,
        )
        or isinstance(
            schedule_id,
            bool,
        )
        or schedule_id <= 0
    ):
        raise ValueError(f"{action_type} requires a valid schedule_id")


def _validate_action(
    action_type: Any,
    action_data: dict[str, Any],
) -> None:

    if not isinstance(
        action_type,
        str,
    ):
        raise ValueError("action_type must be a string")

    if action_type not in VALID_SCHEDULER_ACTIONS:
        raise ValueError(f"Unsupported scheduler action: {action_type}")

    if action_type == "CREATE_SCHEDULE":
        _validate_create_schedule(action_data)

        return

    if action_type == "UPDATE_SCHEDULE":
        _validate_update_schedule(action_data)

        return

    if action_type in {
        "ENABLE_SCHEDULE",
        "DISABLE_SCHEDULE",
    }:
        _validate_schedule_state_action(
            action_type,
            action_data,
        )


async def create_recommendations(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    if not isinstance(
        arguments,
        dict,
    ):
        raise ValueError("create_recommendations arguments must be an object")

    recommendations = arguments.get("recommendations")

    if isinstance(
        recommendations,
        dict,
    ):
        recommendations = [recommendations]

    if not isinstance(
        recommendations,
        list,
    ):
        raise ValueError(
            f"recommendations must be an array, got {type(recommendations).__name__}"
        )

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

        if recommendation_type not in VALID_RECOMMENDATION_TYPES:
            raise ValueError(f"Unsupported recommendation_type: {recommendation_type}")

        level_no = recommendation.get("level_no")

        _validate_level(level_no)

        recommendation_message = recommendation.get("recommendation_message")

        if (
            not isinstance(
                recommendation_message,
                str,
            )
            or not recommendation_message.strip()
        ):
            raise ValueError("recommendation_message must be a non-empty string")

        recommendation_reason = recommendation.get("recommendation_reason")

        if (
            not isinstance(
                recommendation_reason,
                str,
            )
            or not recommendation_reason.strip()
        ):
            raise ValueError("recommendation_reason must be a non-empty string")

        action_required = recommendation.get("action_required")

        if not isinstance(
            action_required,
            bool,
        ):
            raise ValueError("action_required must be true or false")

        proposed_action = recommendation.get("proposed_action")

        if action_required and proposed_action is None:
            raise ValueError("Actionable recommendations require proposed_action")

        if not action_required and proposed_action is not None:
            raise ValueError("proposed_action requires action_required=true")

        risk_level = None
        approval_required = None
        recommendation_status = "PENDING"

        action_type = None
        action_data = None

        if proposed_action is not None:

            if not isinstance(
                proposed_action,
                dict,
            ):
                raise ValueError("proposed_action must be an object")

            action_type = proposed_action.get("action_type")

            action_data = proposed_action.get("action_data")

            if not isinstance(
                action_data,
                dict,
            ):
                raise ValueError("action_data must be an object")

            action_data = dict(action_data)

            if action_type == "CREATE_SCHEDULE" and action_data.get("level_no") is None:
                action_data["level_no"] = level_no

            if (
                action_data.get("level_no") is not None
                and action_data.get("level_no") != level_no
            ):
                raise ValueError(
                    "proposed_action level_no must match recommendation level_no"
                )

            _validate_action(
                action_type,
                action_data,
            )

            proposed_action = {
                "action_type": action_type,
                "action_data": action_data,
            }

            risk_level = get_action_risk(action_type)

            approval_required = requires_approval(action_type)

            if risk_level == "LOW":
                recommendation_status = "APPROVED"

        async with get_connection() as conn:

            async with conn.cursor() as cur:

                await cur.execute(
                    """
                    INSERT INTO ai_recommendations (
                        recommendation_type,
                        level_no,
                        recommendation_message,
                        recommendation_reason,
                        evidence,
                        risk_level,
                        requires_approval,
                        status,
                        proposed_action
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
                        %s
                    )
                    RETURNING recommendation_id;
                    """,
                    (
                        recommendation_type,
                        level_no,
                        recommendation_message,
                        recommendation_reason,
                        (
                            Jsonb(recommendation.get("evidence"))
                            if recommendation.get("evidence") is not None
                            else None
                        ),
                        risk_level,
                        approval_required,
                        recommendation_status,
                        (
                            Jsonb(proposed_action)
                            if proposed_action is not None
                            else None
                        ),
                    ),
                )

                row = await cur.fetchone()

                if row is None:
                    raise RuntimeError("Failed to create recommendation")

                recommendation_id = row[0]

                approval_id = None

                if proposed_action is not None and approval_required:

                    await cur.execute(
                        """
                        INSERT INTO approval_requests (
                            recommendation_id,
                            action_type,
                            action_data,
                            risk_level,
                            status,
                            requested_by
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            %s,
                            'PENDING',
                            NULL
                        )
                        RETURNING approval_id;
                        """,
                        (
                            recommendation_id,
                            action_type,
                            Jsonb(action_data),
                            risk_level,
                        ),
                    )

                    approval_row = await cur.fetchone()

                    if approval_row is None:
                        raise RuntimeError("Failed to create approval request")

                    approval_id = approval_row[0]

                await conn.commit()

        queued_for_execution = False

        if proposed_action is not None and risk_level == "LOW":

            await queue_scheduler_action(
                action_type=action_type,
                action_data=action_data,
                recommendation_id=recommendation_id,
            )

            queued_for_execution = True

        created.append(
            {
                "recommendation_id": recommendation_id,
                "recommendation_type": recommendation_type,
                "level_no": level_no,
                "risk_level": risk_level,
                "requires_approval": approval_required,
                "status": recommendation_status,
                "approval_id": approval_id,
                "queued_for_execution": queued_for_execution,
                "proposed_action": proposed_action,
            }
        )

    return {
        "count": len(created),
        "recommendations": created,
    }
