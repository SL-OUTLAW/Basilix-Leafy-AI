from engine.managers.scheduler import (
    register_action_handler,
)

from engine.actions.ai_analysis_handler import (
    create_ai_analysis_handler,
)

from engine.actions.farm_controls import (
    create_farm_control_handlers,
)


def register_scheduler_actions(
    hal,
) -> None:

    register_action_handler(
        "RUN_AI_ANALYSIS",
        create_ai_analysis_handler(hal),
    )

    farm_handlers = create_farm_control_handlers(hal)

    for (
        action_type,
        handler,
    ) in farm_handlers.items():

        register_action_handler(
            action_type,
            handler,
        )
