from detector import analyse_plants


def analyse_plants_tool(image_path):
    return analyse_plants(image_path)


VISION_TOOL_SCHEMA = {
    "name": "analyse_plants_tool",
    "description": (
        "Analyse a basil image and return plant health, "
        "plant count, plant positions and analysed image details."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "image_path": {
                "type": "string",
                "description": "Path to the basil image."
            }
        },
        "required": ["image_path"],
        "additionalProperties": False
    }
}