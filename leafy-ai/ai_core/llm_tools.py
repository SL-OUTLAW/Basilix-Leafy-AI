TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "sensor_history",
            "description": (
                "Retrieve historical data for a farm sensor. "
                "Use this when investigating sensor trends, changes over time, "
                "anomalies, stability, persistence, or past farm conditions. "
                "Use either time_range OR start_time and end_time, not both. "
                "If no time range is specified, the default is the previous 1 hour. "
                "Historical readings are automatically aggregated to an "
                "appropriate resolution. "
                "This capability may be requested multiple times for different "
                "sensors or genuinely different historical periods."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sensor_type": {
                        "type": "string",
                        "enum": [
                            "ph",
                            "ec",
                            "water_temperature",
                        ],
                        "description": ("Sensor measurement to retrieve."),
                    },
                    "time_range": {
                        "type": "string",
                        "enum": [
                            "15m",
                            "30m",
                            "1h",
                            "3h",
                            "6h",
                            "12h",
                            "24h",
                            "3d",
                            "7d",
                        ],
                        "description": (
                            "Relative historical period ending at the current time. "
                            "Do not use together with start_time or end_time. "
                            "If no time range or explicit timestamps are provided, "
                            "the default is 1h."
                        ),
                    },
                    "start_time": {
                        "type": "string",
                        "format": "date-time",
                        "description": (
                            "Explicit start of the historical period. "
                            "Use together with end_time and do not use with time_range. "
                            "ISO 8601 format: YYYY-MM-DDTHH:MM:SS±HH:MM."
                        ),
                    },
                    "end_time": {
                        "type": "string",
                        "format": "date-time",
                        "description": (
                            "Explicit end of the historical period. "
                            "Use together with start_time and do not use with time_range. "
                            "ISO 8601 format: YYYY-MM-DDTHH:MM:SS±HH:MM."
                        ),
                    },
                },
                "required": [
                    "sensor_type",
                ],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "camera_analysis_history",
            "description": (
                "Retrieve recent or historical structured plant camera observations "
                "and analysis for a farm level. Use this when investigating plant "
                "growth, crowding, visible health changes, dryness, over watering, "
                "possible nutrient deficiency, spacing, or harvest readiness."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "level_no": {
                        "type": "integer",
                        "enum": [
                            1,
                            2,
                        ],
                        "description": (
                            "Farm level whose camera observations should be retrieved."
                        ),
                    },
                    "time_range": {
                        "type": "string",
                        "enum": [
                            "1h",
                            "6h",
                            "12h",
                            "24h",
                            "3d",
                            "7d",
                        ],
                        "description": (
                            "Historical period ending at the current time. "
                            "Defaults to 24h when omitted."
                        ),
                    },
                },
                "required": [
                    "level_no",
                ],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "daily_farm_schedule",
            "description": (
                "Retrieve the complete daily farm schedule. "
                "Use this to understand today's global, Level 1, and Level 2 "
                "farm operations and when investigating or proposing schedule "
                "changes. The returned information may include task identifiers, "
                "scheduled times, actions, levels, targets, enabled state, and "
                "current task status."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_recommendations",
            "description": (
                "Record one or more evidence-based farm recommendations. "
                "Use this when analysis identifies a meaningful farm action or "
                "change that should be recommended. Recommendations may optionally "
                "contain a supported proposed_action describing the desired farm "
                "action. Schedule changes must be proposed/recommended through this capability. "
                "The application determines action validity, risk, approval "
                "requirements, automatic execution eligibility, and execution. "
                "Do not assign risk or approval requirements. "
                "Do not invent action types or parameters."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "recommendations": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "properties": {
                                "recommendation_type": {
                                    "type": "string",
                                    "enum": [
                                        "PH",
                                        "EC",
                                        "TEMPERATURE",
                                        "LIGHTING",
                                        "IRRIGATION",
                                        "PLANT_HEALTH",
                                        "PLANT_SPACING",
                                        "HARVEST",
                                        "MONITORING",
                                        "SCHEDULE",
                                        "OTHER",
                                    ],
                                    "description": ("Category of the recommendation."),
                                },
                                "level_no": {
                                    "type": "integer",
                                    "enum": [
                                        0,
                                        1,
                                        2,
                                    ],
                                    "description": (
                                        "Area affected by the recommendation. "
                                        "0 = global farm or shared environment, "
                                        "1 = Level 1, 2 = Level 2."
                                    ),
                                },
                                "recommendation_message": {
                                    "type": "string",
                                    "description": (
                                        "Clear human-readable statement describing "
                                        "what is recommended. Avoid text formatting, "
                                        "Unicode decoration, and emojis."
                                    ),
                                },
                                "recommendation_reason": {
                                    "type": "string",
                                    "description": (
                                        "Evidence-based explanation of why the "
                                        "recommendation is being made."
                                    ),
                                },
                                "proposed_action": {
                                    "type": "object",
                                    "description": (
                                        "Optional structured desired farm action. "
                                        "Include only when the recommendation maps "
                                        "to a supported action. This proposes intent "
                                        "and does not determine risk, approval, or "
                                        "execution."
                                    ),
                                    "properties": {
                                        "action_type": {
                                            "type": "string",
                                            "enum": [
                                                "RUN_IRRIGATION",
                                                "SET_LIGHTING",
                                                "SET_FAN",
                                                "DOSE_PH",
                                                "DOSE_EC",
                                                "CREATE_SCHEDULE",
                                                "UPDATE_SCHEDULE",
                                                "ENABLE_SCHEDULE",
                                                "DISABLE_SCHEDULE",
                                            ],
                                            "description": (
                                                "Supported farm action being proposed."
                                            ),
                                        },
                                        "action_data": {
                                            "type": "object",
                                            "description": (
                                                "Structured parameters required for "
                                                "the proposed action. Only include "
                                                "parameters relevant to the selected "
                                                "action_type."
                                            ),
                                            "properties": {
                                                "schedule_id": {
                                                    "type": "integer",
                                                    "minimum": 1,
                                                    "description": (
                                                        "Existing schedule task identifier. "
                                                        "Used when updating, enabling, or "
                                                        "disabling an existing schedule."
                                                    ),
                                                },
                                                "task_name": {
                                                    "type": "string",
                                                    "description": (
                                                        "Simple human-readable schedule task name."
                                                    ),
                                                },
                                                "task_description": {
                                                    "type": "string",
                                                    "description": (
                                                        "Optional description of a scheduled task."
                                                    ),
                                                },
                                                "task_action": {
                                                    "type": "string",
                                                    "enum": [
                                                        "RUN_IRRIGATION",
                                                        "SET_LIGHTING",
                                                        "SET_FAN",
                                                        "DOSE_PH",
                                                        "DOSE_EC",
                                                        "ANALYSE_FARM",
                                                    ],
                                                    "description": (
                                                        "Action performed by a proposed "
                                                        "daily schedule task."
                                                    ),
                                                },
                                                "level_no": {
                                                    "type": "integer",
                                                    "enum": [
                                                        0,
                                                        1,
                                                        2,
                                                    ],
                                                    "description": (
                                                        "Action or schedule scope. "
                                                        "0 = global, 1 = Level 1, "
                                                        "2 = Level 2."
                                                    ),
                                                },
                                                "start_time": {
                                                    "type": "string",
                                                    "description": (
                                                        "Daily schedule start time using "
                                                        "24-hour HH:MM:SS format."
                                                    ),
                                                },
                                                "duration_seconds": {
                                                    "type": "integer",
                                                    "minimum": 1,
                                                    "description": (
                                                        "Optional duration in seconds for "
                                                        "time-based actions."
                                                    ),
                                                },
                                                "target_value": {
                                                    "type": "number",
                                                    "description": (
                                                        "Optional target value associated "
                                                        "with the proposed action."
                                                    ),
                                                },
                                                "unit": {
                                                    "type": "string",
                                                    "description": (
                                                        "Optional unit associated with "
                                                        "target_value."
                                                    ),
                                                },
                                            },
                                            "additionalProperties": False,
                                        },
                                    },
                                    "required": [
                                        "action_type",
                                    ],
                                    "additionalProperties": False,
                                },
                            },
                            "required": [
                                "recommendation_type",
                                "level_no",
                                "recommendation_message",
                                "recommendation_reason",
                            ],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": [
                    "recommendations",
                ],
                "additionalProperties": False,
            },
        },
    },
]
