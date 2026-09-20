from engine.managers.scheduler import (
    register_action_handler,
)

from engine.actions.ai_analysis_handler import (
    create_ai_analysis_handler,
)


def register_scheduler_actions(
    hal,
) -> None:

    register_action_handler(
        "RUN_AI_ANALYSIS",
        create_ai_analysis_handler(hal),
    )
