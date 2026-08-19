import sys
from detector import detect_health


if len(sys.argv) != 2:
    print("Usage: python test_integration.py <image_path>")
    sys.exit(1)

result = detect_health(sys.argv[1])

print(result)

assert result["status"] == "success"
assert result["health"]["condition"] in ["healthy", "downy_mildew"]
assert 0 <= result["health"]["confidence"] <= 1

print("Vision integration test passed.")