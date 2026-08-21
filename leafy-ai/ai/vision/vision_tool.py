from detector import analyse_plants


def analyse_plants_tool(image_path):
    return analyse_plants(image_path)


VISION_TOOL_SCHEMA = {
    "name": "analyse_plants_tool",
    "description": (
        "Analyse a basil plant image and return general visual information "
        "including image size, plant health classification, confidence, "
        "health flag and review action."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "image_path": {
                "type": "string",
                "description": "Path to the basil plant image."
            }
        },
        "required": ["image_path"],
        "additionalProperties": False
    }
}