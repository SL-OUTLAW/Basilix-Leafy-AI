TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "sensor_history",
            "description": (
                "Retrieve historical data for a farm sensor. "
                "Use this when investigating sensor trends, changes over time, "
                "anomalies, stability, persistence, past farm conditions or "
                "analysing farm and health. "
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
            "name": "rag_tool",
            "description": (
                "Search the Leafy AI farm knowledge base for relevant reference "
                "information. Use this when farm analysis or a user question requires "
                "knowledge contained in indexed documentation, such as crop guidance, "
                "nutrient management, pH and EC guidance, environmental requirements, "
                "plant health, irrigation, lighting, disease, deficiencies, or other "
                "supported farm reference material. "
                "Provide a concise semantic search query describing the information "
                "needed. Do not use this tool for live or historical sensor readings, "
                "camera observations, farm schedules, pending recommendations, or "
                "pending approvals when a dedicated tool exists for that information."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "Semantic search query describing the farm knowledge or "
                            "reference information needed."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 10,
                        "description": (
                            "Maximum number of relevant knowledge chunks to return. "
                            "Defaults to 5 when omitted."
                        ),
                    },
                },
                "required": [
                    "query",
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
            "name": "pending_recommendations",
            "description": (
                "Retrieve all currently pending farm recommendations. "
                "Use this before creating a new recommendation to determine "
                "whether an equivalent or substantially similar recommendation "
                "already exists. Do not create a duplicate recommendation when "
                "an existing pending recommendation addresses the same issue, "
                "farm level, and intended action."
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
            "name": "pending_approvals",
            "description": (
                "Retrieve all currently pending farm approval requests. "
                "Use this before creating a recommendation or proposing an action "
                "that may require approval to determine whether a related action "
                "is already awaiting human approval. "
                "This tool returns all pending approvals and does not accept filters."
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
                "Before creating recommendations, check pending recommendations "
                "and pending approvals when relevant so equivalent actions are "
                "not duplicated. "
                "When recommending a concrete schedule creation, update, enable, "
                "or disable operation, action_required must be true and "
                "proposed_action MUST be included. "
                "For CREATE_SCHEDULE provide task_name, task_action, level_no, "
                "start_time, and every parameter required by task_action. "
                "Use interval_seconds when a task must repeat more frequently "
                "than once per day. "
                "For example, interval_seconds=1800 means run every 30 minutes. "
                "Omit interval_seconds for a once-daily task. "
                "duration_seconds describes how long each individual operation "
                "runs and is not the recurrence interval. "
                "SET_LIGHTING, RUN_IRRIGATION, and SET_FAN schedules MUST include "
                "duration_seconds as a positive integer number of seconds. "
                "For schedule updates retrieve the current daily schedule first "
                "and use UPDATE_SCHEDULE with schedule_id and the changed fields. "
                "ENABLE_SCHEDULE and DISABLE_SCHEDULE require schedule_id. "
                "The application determines action validity, risk, approval "
                "requirements, automatic execution eligibility, and execution. "
                "Do not assign risk or approval requirements."
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
                                },
                                "level_no": {
                                    "type": "integer",
                                    "enum": [
                                        0,
                                        1,
                                        2,
                                    ],
                                },
                                "recommendation_message": {
                                    "type": "string",
                                },
                                "recommendation_reason": {
                                    "type": "string",
                                },
                                "action_required": {
                                    "type": "boolean",
                                    "description": (
                                        "True when this recommendation represents "
                                        "a concrete supported schedule change. "
                                        "When true, proposed_action is required."
                                    ),
                                },
                                "proposed_action": {
                                    "type": "object",
                                    "properties": {
                                        "action_type": {
                                            "type": "string",
                                            "enum": [
                                                "CREATE_SCHEDULE",
                                                "UPDATE_SCHEDULE",
                                                "ENABLE_SCHEDULE",
                                                "DISABLE_SCHEDULE",
                                            ],
                                        },
                                        "action_data": {
                                            "type": "object",
                                            "properties": {
                                                "schedule_id": {
                                                    "type": "integer",
                                                    "minimum": 1,
                                                },
                                                "task_name": {
                                                    "type": "string",
                                                },
                                                "task_description": {
                                                    "type": "string",
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
                                                },
                                                "interval_seconds": {
                                                    "type": "integer",
                                                    "minimum": 1,
                                                    "description": (
                                                        "Optional recurrence interval in seconds. "
                                                        "When provided, the task repeats at this interval continuously. "
                                                        "For example, 1800 means every 30 minutes, "
                                                        "3600 means every hour, and 7200 means every 2 hours. "
                                                        "Omit this field for a once-daily schedule."
                                                    ),
                                                },
                                                "level_no": {
                                                    "type": "integer",
                                                    "enum": [
                                                        0,
                                                        1,
                                                        2,
                                                    ],
                                                },
                                                "start_time": {
                                                    "type": "string",
                                                    "pattern": "^([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$",
                                                    "description": (
                                                        "Daily recurring start time in "
                                                        "24-hour HH:MM:SS format. "
                                                        "Do not include a date or timezone."
                                                    ),
                                                },
                                                "duration_seconds": {
                                                    "type": "integer",
                                                    "minimum": 1,
                                                    "description": (
                                                        "Duration of timed actions in seconds. "
                                                        "Required for SET_LIGHTING, "
                                                        "RUN_IRRIGATION, and SET_FAN."
                                                    ),
                                                },
                                                "target_value": {
                                                    "type": "number",
                                                },
                                                "unit": {
                                                    "type": "string",
                                                },
                                            },
                                            "additionalProperties": False,
                                        },
                                    },
                                    "required": [
                                        "action_type",
                                        "action_data",
                                    ],
                                    "additionalProperties": False,
                                },
                            },
                            "required": [
                                "recommendation_type",
                                "level_no",
                                "recommendation_message",
                                "recommendation_reason",
                                "action_required",
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
