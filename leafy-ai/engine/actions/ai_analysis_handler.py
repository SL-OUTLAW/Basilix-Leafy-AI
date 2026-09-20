from datetime import datetime, timezone
from typing import Any

from engine.ai_core_client import run_ai
from engine.security.emergency_stop import ai_enabled


def create_ai_analysis_handler(
    hal,
):

    async def run_ai_analysis(
        task: dict[str, Any],
    ) -> dict[str, Any]:

        if not ai_enabled():

            raise RuntimeError("AI access is disabled by system safety state")

        current_time = datetime.now(timezone.utc).isoformat()

        latest_sensors = hal.sensors.latest()

        result = await run_ai(
            task=(
                "Perform a comprehensive scheduled whole-farm health and operations analysis. "
                "Assess the current state of both farm levels and the shared farm systems. "
                "Use the current farm state supplied in context as the latest available evidence. "
                "Evaluate pH, EC, water temperature, ambient temperature, humidity, dew point, "
                "water level, plant health, growth, canopy condition, crowding, spacing, harvest "
                "readiness, irrigation, lighting, and other meaningful farm conditions. "
                "Use sensor history when trends, persistence, stability, anomalies, or recent "
                "changes need to be established. "
                "Use camera analysis history when changes in plant condition over time need "
                "to be established. "
                "Review the current farm schedule when operational timing or existing scheduled "
                "activities are relevant. "
                "Use agricultural reference knowledge when appropriate operating conditions "
                "or crop guidance for sweet basil are required. "
                "Consider Level 1 and Level 2 separately where conditions are level-specific "
                "and shared systems globally where appropriate. "
                "Identify meaningful abnormalities, concerning trends, inconsistencies, stale "
                "information, missing evidence, and conditions requiring attention. "
                "Before creating recommendations, check existing pending recommendations and "
                "pending approvals when relevant and avoid duplicates. "
                "Create evidence-supported recommendations only when there is a meaningful "
                "reason for intervention, monitoring, or a schedule change. "
                "Do not treat a single current reading as a trend. "
                "Do not assume missing or stale information is normal or abnormal. "
                "Complete the whole-farm assessment and return the important findings, "
                "limitations, and confirmed recommendation outcomes."
            ),
            context={
                "trigger": "scheduled_full_farm_analysis",
                "scope": "whole_farm",
                "schedule_id": task.get("schedule_id"),
                "scheduled_for": task.get("next_run_at"),
                "current_time": current_time,
                "latest_sensor_readings": latest_sensors,
            },
        )

        if not result.get("success"):
            raise RuntimeError(
                result.get(
                    "error",
                    "Leafy AI farm analysis failed",
                )
            )

        return result

    return run_ai_analysis
