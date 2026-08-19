from detector import detect_health

image_path = (
    "C:/LeafyAI_Vision_Work/03_test_images/"
    "health_tests/basil_test.jpg"
)

result = detect_health(image_path)

print(result)

assert result["status"] == "success"
assert "health" in result
assert "primary_condition" in result["health"]
assert "confidence" in result["health"]

print("Vision integration test passed.")
