from detector import analyse_plants, compare_growth, analyse_cameras

def analyse_plants_tool(image_path):
    return analyse_plants(image_path)

def compare_growth_tool(previous_image_path, current_image_path):
    return compare_growth(previous_image_path, current_image_path)


def analyse_cameras_tool(image_paths):
    return analyse_cameras(image_paths)


VISION_TOOL_SCHEMA = {
    "name": "analyse_plants_tool",
    "description": (
        "Analyse a basil image and return plant count, plant positions, "
        "canopy coverage, crowding, plant size information and "
        "analysed image details."
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

COMPARE_GROWTH_TOOL_SCHEMA = {
    "name": "compare_growth_tool",
    "description": (
        "Compare two basil images from the same camera and return "
        "image-space growth changes over time."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "previous_image_path": {
                "type": "string",
                "description": "Path to the older basil image."
            },
            "current_image_path": {
                "type": "string",
                "description": "Path to the newer basil image."
            }
        },
        "required": [
            "previous_image_path",
            "current_image_path"
        ],
        "additionalProperties": False
    }
}

ANALYSE_CAMERAS_TOOL_SCHEMA = {
    "name": "analyse_cameras_tool",
    "description": (
        "Analyse basil images from different cameras and return "
        "separate results for each camera."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "image_paths": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "minItems": 1,
                "description": "Paths to basil images from different cameras."
            }
        },
        "required": ["image_paths"],
        "additionalProperties": False
    }
}