# Leafy AI Farm Engine

The Leafy AI Engine is the Python service responsible for collecting farm data, processing scheduled operations, managing farm equipment and exposing farm services to the web backend.

It uses FastAPI for its HTTP API, PostgreSQL for persistent records and a hardware abstraction layer (HAL) for sensors, cameras and farm controls.

## How It Works

The Engine runs several services within one application:

| Service | Responsibility |
| --- | --- |
| API | Exposes farm data and operations to authorised services |
| Sensors | Collects and stores water and ambient sensor readings |
| Cameras | Captures images and registers them in the database |
| Vision | Processes captured images through the separate Vision worker |
| Scheduler | Executes database-backed farm schedules |
| Farm Controls | Communicates with lights, irrigation, fans and dosing equipment |
| Safety | Manages emergency state, monitoring and approval boundaries |
| AI Analysis | Performs scheduled farm assessments using available farm information |

The Engine connects these services but does not replace their individual validation and safety requirements.

## Project Structure

```text
leafy-ai/
├── run_engine.py
└── engine/
    ├── main.py
    ├── actions/
    ├── api/
    ├── hal/
    ├── logger/
    ├── managers/
    ├── security/
    └── tools/
```

| File or directory | Purpose |
| --- | --- |
| `run_engine.py` | Uvicorn entry point |
| `engine/main.py` | FastAPI application and service lifecycle |
| `engine/api/engine_api.py` | Engine HTTP endpoints |
| `engine/actions/` | Registered scheduler action handlers |
| `engine/hal/sensors.py` | Sensor collection and data publishing |
| `engine/hal/cameras.py` | Camera capture and image records |
| `engine/hal/farm_controls.py` | Equipment operations |
| `engine/managers/scheduler.py` | Schedule execution and task history |
| `engine/managers/db_manager.py` | PostgreSQL connection pool |
| `engine/managers/settings_manager.py` | Database-backed settings |
| `engine/security/` | Safety, approval and service-access functions |
| `engine/tools/` | Farm data and recommendation tools |

Vision processing has its own documentation under `engine/hal/ai_vision/`.

## Running the Engine

The tracked Engine entry point is `leafy-ai/run_engine.py`.

From the repository root:

```bash
cd leafy-ai
python run_engine.py
```

The configured Python environment must have the Engine's dependencies installed, and the required database and farm interfaces must be available.

The reviewed repository snapshot does not contain a complete Engine-wide Python requirements file. The requirements files for individual tools or components should not be treated as a complete Engine installation guide.

The entry point starts Uvicorn using `engine.main:app` at:

```text
http://127.0.0.1:8000
```

Starting the Engine also initialises its background services and attempts to initialise farm controls. Only run it in an approved development or testing environment until the hardware configuration has been verified.

### Application Lifecycle

Startup is managed by `engine/main.py`.

1. Open the PostgreSQL connection pool.
2. Load and validate stored system settings.
3. Start the HAL services.
4. Register scheduler action handlers.
5. Start the scheduler and security-monitoring tasks.
6. Expose the Engine API through FastAPI.

During shutdown, the Engine stops the background tasks, shuts down the HAL and closes the database connection pool.

## Engine API

HTTP routes are defined in `engine/api/engine_api.py`.

| Endpoint group | Purpose |
| --- | --- |
| `/health` | Engine health response |
| `/farm/state` | Current farm state |
| `/farm/sensors` | Current sensor readings |
| `/farm/sensors/stream` | Sensor updates |
| `/farm/cameras` | Camera information |
| `/farm/cameras/{camera_id}/image` | Camera image retrieval |
| `/farm/cameras/{camera_id}/analysis` | Camera analysis retrieval |
| `/farm/schedule` | Growing schedules |
| `/farm/controls` | Equipment state and control requests |
| `/ai/recommendations` | Recommendations |
| `/ai/activity` | Analysis and activity history |
| `/approvals` | Approval requests and decisions |
| `/safety/state` | Safety state |
| `/notifications` | Notifications |
| `/audit-logs` | Audit records |
| `/grow-cycles` | Grow-cycle records |
| `/harvest/history` | Harvest history |
| `/task-executions` | Task execution records |
| `/settings` | System settings |

Individual operations have their own HTTP methods, request formats, validation and access requirements.

The web backend is the intended interface between the browser and the Engine. The browser should not directly bypass the backend to request farm operations.

## Camera and Vision Processing

Camera capture is handled by `engine/hal/cameras.py`. Captured images are saved locally and registered in `plant_images`, including their camera ID and capture time.

The separate Vision worker processes pending images and saves the assessment results in `plant_image_analysis`. Model configuration, image validation and processing details are documented in the [Vision README](hal/ai_vision/README.md).

## Scheduler

The scheduler is implemented in `engine/managers/scheduler.py`.

The database is the source of truth for scheduled operations.

| Database table | Purpose |
| --- | --- |
| `farm_schedule` | Scheduled actions and timing information |
| `task_executions` | Execution state and outcomes |
| `system_settings` | Runtime configuration |

The scheduler checks for due tasks, processes registered actions, handles timed operations and records execution results.

It supports scheduled operations and interval-based tasks. The default polling interval is five seconds and can be changed through system settings.

### Registered Actions

Actions are registered in `engine/actions/register_actions.py`.

| Action | Operation |
| --- | --- |
| `RUN_AI_ANALYSIS` | Run a scheduled farm analysis |
| `SET_LIGHTING` | Set lighting state for a farm level |
| `RUN_IRRIGATION` | Operate irrigation |
| `SET_FAN` | Set fan state |
| `DOSE_PH` | Process a pH target |
| `DOSE_EC` | Process an EC target |

The farm-control handlers are defined in `engine/actions/farm_controls.py`.

The Engine's control mapping currently handles lighting for levels 1 and 2 and a single fan control. Per-level fan support must be confirmed against the physical installation and implementation.

### Task Execution

The scheduler reads due tasks from `farm_schedule` and runs the corresponding registered action. Execution results are recorded in `task_executions`.

Actions involving farm equipment are handled through the HAL. A successful API response does not necessarily confirm that the physical equipment completed the requested operation.

## Sensors and Farm Controls

The sensor service manages water and ambient readings, database storage and recent reading updates.

The farm-control service supports:

- Lighting
- Irrigation
- Fan operation
- Equipment outlet state
- pH dosing
- EC dosing

Dosing operations include target and limit validation. Equipment connections and safety behavior must be verified before operating the live farm.

If farm-control initialisation fails, the Engine may continue without available farm controls. A running API must not be interpreted as confirmation that hardware is operational.

## Safety Boundaries

The farm has shared irrigation, EC and pH systems. Operations affecting those systems cannot be treated as independent level-specific actions.

The project requires:

- Safety validation before hardware execution.
- Human approval for irrigation and dosing during the initial operating stage.
- Supporting trend evidence for medium- and high-risk decisions.
- Controlled dosing limits.
- Appropriate permissions for protected operations.
- Emergency handling and audit records.

The presence of an API endpoint or action handler does not establish that all safety requirements have passed end-to-end testing.

The Engine must be tested against the actual farm equipment before live automated operation.

## Configuration and Database

Runtime settings are managed by `engine/managers/settings_manager.py` and stored in `system_settings`.

The settings include scheduler timing, sensor and camera intervals, Vision polling, equipment mappings, dosing limits and monitoring behaviour.

Database connection management is implemented in `engine/managers/db_manager.py`.

Database schema and initialisation files are maintained in the repository's `database/` directory.

Configuration values must be appropriate for the deployment environment. Do not assume that default equipment mappings or operating limits are correct for every installation.

## Verification

Before deployment, verify:

- Database connection and application startup.
- HAL service initialisation and shutdown.
- Sensor collection and camera capture.
- Vision result retrieval.
- Scheduler timing and execution records.
- Equipment state confirmation.
- Approval and safety enforcement.
- Dosing validation and emergency handling.
- Communication with the web backend.

A successful HTTP health response confirms that the endpoint is responding. It does not prove that every farm device or background operation is functioning correctly.

## Related Documentation

- [Project README](../../README.md)
- [System Requirements](../../REQUIREMENTS.md)
- [Backend README](../../webapp/backend/README.md)
- [Backend API Documentation](../../webapp/backend/API.md)
- [Vision README](hal/ai_vision/README.md)
