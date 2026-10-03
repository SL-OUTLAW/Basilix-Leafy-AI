import asyncio
import sys
import types
from datetime import datetime, timezone


insert_calls = []


async def fake_run_query(query, params=None):
    normalized = " ".join(query.lower().split())

    if normalized.startswith(
        "insert into plant_image_analysis"
    ):
        insert_calls.append(params)
        return [
            (
                1,
                datetime.now(timezone.utc),
            )
        ]

    if normalized.startswith(
        "with current_image as"
    ):
        return []

    raise AssertionError(
        f"Unexpected database query: {query}"
    )


fake_db_manager = types.ModuleType(
    "engine.managers.db_manager"
)
fake_db_manager.run_query = fake_run_query
sys.modules[
    "engine.managers.db_manager"
] = fake_db_manager

import engine.hal.ai_vision.vision_tool as vision_tool


def fake_analyse_image(image_path, camera_name=None):
    return {
        "source": "vision",
        "status": "success",
        "camera": "camera1",
        "image": {
            "width": 704,
            "height": 576,
        },
        "vision_version": "4.5",
        "schema_version": "1.0",
        "model": "gemini-3.8-flash",
        "thinking_level": "medium",
        "prompt_sha256": "test",
        "schema_sha256": "test",
        "health": {
            "status": "healthy",
            "certainty": "high",
            "dryness_wilt": {
                "presence": "none",
                "severity": "none",
                "distribution": "none",
                "observations": [],
            },
            "overwatering_like": {
                "presence": "none",
                "severity": "none",
                "distribution": "none",
                "observations": [],
            },
            "nutrient_deficiency_like": {
                "presence": "none",
                "severity": "none",
                "distribution": "none",
                "observations": [],
            },
            "disease_signs": {
                "status": "none",
                "suspected_type": "none",
                "severity": "none",
                "distribution": "none",
                "observations": [],
                "certainty": "high",
            },
            "other_visible_signs": [],
            "summary": "Healthy basil.",
        },
        "plant_size": {
            "relative_size": "small",
            "reference_match": "early",
            "certainty": "high",
            "evidence": "Open growing space remains.",
        },
        "canopy": {
            "coverage_percent": 45.0,
            "crowding_state": "not_crowded",
            "visible_gaps": "many",
            "overlap": "low",
            "certainty": "high",
            "evidence": "Clear gaps remain.",
        },
        "growth": {
            "stage": "early",
            "reference_match": "early",
            "trend": "insufficient_history",
            "history_used": False,
            "certainty": "high",
            "evidence": "Matches the early reference.",
        },
        "image_quality": {
            "status": "good",
            "issues": [],
        },
        "review": {
            "required": False,
            "reasons": [],
        },
    }


async def main():
    if len(sys.argv) != 2:
        print(
            "Usage: python -m "
            "engine.hal.ai_vision.test_integration "
            "<image_path>"
        )
        sys.exit(1)

    vision_tool.analyse_image = fake_analyse_image

    result = await vision_tool.analyse_camera_images(
        {
            101: sys.argv[1],
        }
    )

    assert result["status"] == "success"
    assert result["processed"] == 1
    assert result["successful"] == 1
    assert len(insert_calls) == 1

    analysis = result["results"]["101"]["analysis"]

    assert analysis["status"] == "success"
    assert analysis["image_id"] == 101
    assert analysis["model"] == "gemini-3.8-flash"
    assert analysis["vision_version"] == "4.5"

    assert analysis["health"]["status"] == "healthy"
    assert (
        analysis["health"]["dryness_wilt"]["presence"]
        == "none"
    )
    assert (
        analysis["health"]["overwatering_like"]["presence"]
        == "none"
    )
    assert (
        analysis["health"]["nutrient_deficiency_like"]["presence"]
        == "none"
    )

    assert analysis["plant_size"]["relative_size"] == "small"
    assert analysis["growth"]["stage"] == "early"

    assert 0 <= (
        analysis["canopy"]["coverage_percent"]
    ) <= 100
    assert (
        analysis["canopy"]["crowding_state"]
        == "not_crowded"
    )

    history = analysis["growth_history"]
    assert history["status"] == "insufficient_history"
    assert history["history_samples"] == 0

    assert analysis["review"]["required"] is False

    assert "harvest_readiness" not in analysis
    assert "water_stress" not in analysis
    assert "nutrient_stress" not in analysis

    latest = vision_tool.get_latest_analysis()

    assert latest is not None
    assert latest["successful"] == 1

    print("Vision integration test passed.")


if __name__ == "__main__":
    asyncio.run(main())
