import sys
from vision_tool import analyse_plants_tool

if len(sys.argv) != 2:
    print("Usage: python test_integration.py <image_path>")
    sys.exit(1)

result = analyse_plants_tool(sys.argv[1])

print(result)

assert result["status"] == "success"
assert "image" in result
assert "health" in result
assert result["image"]["width"] > 0
assert result["image"]["height"] > 0
assert result["health"]["condition"] in ["healthy", "downy_mildew"]
assert 0 <= result["health"]["confidence"] <= 1

print("Vision tool integration test passed.")
