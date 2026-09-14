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
    assert analysis["plants"]["count"] >= 0
    assert 0 <= analysis["canopy"] <= 100
    assert analysis["health"]["status"] == "not_available"

    latest = vision_tool.get_latest_analysis()

    assert latest is not None
    assert latest["successful"] == 1

    print("Vision integration test passed.")


if __name__ == "__main__":
    asyncio.run(main())
