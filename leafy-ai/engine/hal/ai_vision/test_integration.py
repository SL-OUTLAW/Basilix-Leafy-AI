import asyncio
import sys
from datetime import datetime, timezone

import engine.hal.ai_vision.vision_tool as vision_tool


insert_calls = []


async def fake_run_query(query, params=None):
    insert_calls.append(params)

    return [
        (
            1,
            datetime.now(timezone.utc),
        )
    ]


async def main():

    if len(sys.argv) != 2:
        print(
            "Usage: python -m "
            "engine.hal.ai_vision.test_integration "
            "<image_path>"
        )
        sys.exit(1)

    vision_tool.run_query = fake_run_query

    image_paths = {
        101: sys.argv[1]
    }

    result = await vision_tool.analyse_camera_images(
        image_paths
    )

    assert result["status"] == "success"
    assert result["processed"] == 1
    assert result["successful"] == 1
    assert len(insert_calls) == 1

    analysis = result["results"]["101"]["analysis"]

    assert analysis["status"] == "success"
    assert analysis["image_id"] == 101
    assert 0 <= analysis["canopy"]["coverage_percent"] <= 100
    assert analysis["health"]["status"] == "available"
    assert analysis["health"]["condition"] in {
        "healthy",
        "downy_mildew",
        "review_unknown",
    }
    assert 0 <= analysis["health"]["confidence"] <= 1
    assert analysis["health"]["model_scope"] == "healthy_vs_downy_mildew"
    assert analysis["health"]["other_diseases"] == "not_evaluated"
    assert isinstance(analysis["health"]["review_needed"], bool)
    assert isinstance(analysis["health"]["flagged"], bool)

    assert "plants" not in analysis
    assert "crowding" in analysis
    assert "visual_anomaly" in analysis

    anomaly = analysis["visual_anomaly"]

    assert anomaly["status"] in {
        "available",
        "unavailable",
    }

    if anomaly["status"] == "available":
        assert anomaly["assessment"] in {
            "normal_visual",
            "abnormal_visual",
        }
        assert isinstance(anomaly["flagged"], bool)
    assert analysis["crowding"]["metric"] == "canopy_coverage_percent"
    assert analysis["crowding"]["assessment"] == "not_classified"
    assert analysis["water_stress"]["assessment"] == "not_classified"
    assert analysis["water_stress"]["requires_sensor_context"] is True
    assert analysis["nutrient_stress"]["assessment"] == "not_classified"
    assert analysis["nutrient_stress"]["requires_sensor_context"] is True
    assert analysis["growth"]["assessment"] == "not_classified"
    assert analysis["growth"]["requires_history_context"] is True
    assert analysis["harvest_readiness"]["assessment"] == "not_classified"
    assert analysis["harvest_readiness"]["requires_history_context"] is True

    assert analysis["size"]["scope"] == "camera_view_image_space"
    assert analysis["size"]["metric"] == "canopy_coverage_percent"
    assert analysis["size"]["unit"] == "percent"
    assert (
        analysis["size"]["value"]
        == analysis["canopy"]["coverage_percent"]
    )
    assert "analysed_image" not in analysis

    latest = vision_tool.get_latest_analysis()

    assert latest is not None
    assert latest["successful"] == 1

    print("Vision integration test passed.")


if __name__ == "__main__":
    asyncio.run(main())
