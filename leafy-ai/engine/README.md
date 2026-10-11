# Leafy AI Farm Engine

The Leafy AI Engine is the central farm-side Python service. It exposes the FastAPI farm API, manages database-backed settings and schedules, runs the hardware abstraction layer (HAL), coordinates safety/approval logic, provides AI tools and communicates with the AI Core.

## Current Responsibilities

| Area           | Responsibility                                                                  |
| -------------- | ------------------------------------------------------------------------------- |
| API            | Authenticated farm, safety, settings, history and control endpoints             |
| Sensors        | Poll water and ambient sensor services and persist readings                     |
| Cameras        | Capture RTSP camera snapshots and persist image records                         |
| Vision         | Process pending images through Gemini and store structured assessments          |
| Scheduler      | Execute database-backed schedules and record task executions                    |
| Farm controls  | Control lighting, irrigation, fan and pH/EC dosing through the power board      |
| Safety         | Emergency state, sensor threshold monitoring, risk classification and approvals |
| AI integration | Call AI Core and execute the approved tool set                                  |
| RAG            | Ingest reference Markdown, generate embeddings and retrieve relevant chunks     |
| Grow records   | Manage grow cycles, harvests and harvest history                                |

## Structure

```text
engine/
├── actions/
├── api/
├── hal/
│   ├── ai_vision/
│   ├── drivers/
│   ├── cameras.py
│   ├── farm_controls.py
│   ├── main.py
│   └── sensors.py
├── logger/
├── managers/
├── security/
├── sources/
├── tools/
├── ai_core_client.py
├── ingest_rag.py
├── main.py
└── run_engine.py
```

## Startup Lifecycle

`main.py` manages the FastAPI lifespan. Current startup performs:

1. Open the PostgreSQL connection pool.
2. Load/repair database-backed system settings.
3. Construct and start the HAL.
4. Start sensor, camera and vision loops.
5. Initialize farm controls.
6. Start the scheduler and security-monitoring tasks.
7. Serve the Engine API.

Shutdown stops scheduler/security tasks, HAL services and the database pool.

`run_engine.py` starts Uvicorn on:

```text
0.0.0.0:8000
```

The Docker health check calls `http://127.0.0.1:8000/health` from inside the container.

## Running Locally

```bash
cd leafy-ai/engine
pip install -r requirements.txt
python run_engine.py
```

The Engine may immediately attempt database and farm-hardware connections. Use a safe development/test configuration when live equipment should not be operated.

## Engine API

The web browser is not intended to call these endpoints directly. The Node backend authenticates the user, creates a short-lived service JWT and forwards trusted user context to the Engine.

Routes include:

| Routes                 | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `GET /health`          | Engine process health                                               |
| `POST /tools/execute`  | AI Core tool execution                                              |
| `/farm/state`          | Current farm state                                                  |
| `/farm/sensors`        | Current, raw historical and aggregated sensor data                  |
| `/farm/sensors/stream` | Server-sent sensor updates                                          |
| `/farm/cameras`        | Camera registration/listing, latest image and analysis              |
| `/farm/schedule`       | Schedule CRUD and enable/disable                                    |
| `/farm/controls`       | Lighting, irrigation, fan, pH and EC control requests               |
| `/notifications`       | Notification listing/count/details/resolution                       |
| `/ai/recommendations`  | AI recommendation records                                           |
| `/ai/activity`         | AI/task activity feed                                               |
| `/approvals`           | Approval listing and decisions                                      |
| `/safety/*`            | Safety state, configuration, activity, emergency stop and AI toggle |
| `/audit-logs`          | Create/list audit events                                            |
| `/grow-cycles`         | Grow-cycle CRUD, completion/cancellation and harvests               |
| `/harvest/history`     | Harvest history                                                     |
| `/task-executions`     | Execution history/details/summary                                   |
| `/settings`            | Settings load, update, reload and reset                             |

## HAL

### Sensors

`sensors.py` polls two network sensor sources:

- water-quality sensors
- ambient/environment sensors

Readings are normalized, stored in PostgreSQL and exposed as the latest sensor state. The water-sensor fallback address and ambient-sensor host are hardcoded in the HAL.

### Cameras

`cameras.py` loads active cameras from the database and captures JPEG snapshots from configured RTSP devices. Camera files are stored under `CAMERA_IMAGE_DIR` and registered in `camera_images`.

The web interface displays latest snapshots and it is not a continuous browser video stream.

### Vision

`hal/ai_vision/` contains the Gemini-based worker. Camera capture and vision analysis are independent loops so image capture can continue when Gemini processing is delayed or unavailable.

See [Vision README](hal/ai_vision/README.md).

### Farm Controls

`hal/farm_controls.py` uses the power-board driver under `hal/drivers/` and `python-kasa` to control configured outlets.

Current logical outlet mapping is database-backed under the `farm_controls` settings group. The current power-board network address remains hardcoded.

Supported operations include:

- Lighting
- Irrigation
- Fan
- pH dosing
- EC dosing

## Scheduler

The scheduler uses PostgreSQL as the schedule source of truth.

Key tables:

- `farm_schedule`
- `task_executions`
- `system_settings`

Registered scheduler actions include:

- `RUN_AI_ANALYSIS`
- `SET_LIGHTING`
- `RUN_IRRIGATION`
- `SET_FAN`
- `DOSE_PH`
- `DOSE_EC`

Schedules support create/update, enable/disable and deletion. Execution records are retained separately so historical task activity can remain available when schedules change.

## Safety, Risk and Approvals

The Engine contains separate modules for:

- service authentication
- action risk classification
- approval handling
- emergency-stop state
- sensor-security monitoring

Sensor security thresholds are loaded from `system_settings`. The current monitor supports EC, pH, humidity, dew point, water level, water temperature and ambient temperature configuration. It records alert state and creates threshold/recovery notifications on state transitions.

AI enablement and emergency-stop state are protected settings and are changed through the Safety API rather than ordinary settings updates.

Restricted recommendation/action workflows use approval records. Approval does not bypass Engine safety validation.

## Settings

`managers/settings_manager.py` maintains an in-memory settings dictionary backed by the `system_settings` table. Missing or invalid stored values are repaired from defaults during load.

Current groups are:

- `scheduler`
- `security`
- `risk`
- `sensor_security_thresholds`
- `notifications`
- `vision`
- `cameras`
- `sensors`
- `farm_controls`
- `dosing_ph`
- `dosing_ec`


## AI Core Integration

`ai_core_client.py` sends authenticated analysis requests to:

```env
AI_CORE_URL=http://ai-core:8001
```

The Engine signs short-lived Ed25519 JWTs with the security private key. AI Core responses are treated as application input; executable actions remain subject to Engine rules.

## RAG

RAG implementation is under `tools/rag_tool/`.

- source Markdown: `sources/`
- source manifest: `sources/source_metadata.json`
- chunk size: 500 words
- overlap: 75 words
- embedding model: `nomic-embed-text`
- expected embedding dimensions: 768
- storage: pgvector columns in PostgreSQL

Run ingestion locally from this directory with:

```bash
python ingest_rag.py
```

The root Compose file also defines a one-shot `rag-ingest` service. In the Docker layout it runs `python ingest_rag.py` from `/usr/src/app`.

Document content hashes are used to avoid re-inserting unchanged source content.

## Docker Configuration

The Engine container receives:

```env
DB_HOST=db
DB_PORT=5432
AI_CORE_URL=http://ai-core:8001
AI_CORE_PUBLIC_KEY_PATH=/run/keys/ai-core/public.pem
WEBAPP_BACKEND_PUBLIC_KEY_PATH=/run/keys/backend/public.pem
SECURITY_PRIVATE_KEY_PATH=/run/keys/security/private.pem
CAMERA_IMAGE_DIR=/data/camera
```

Gemini configuration is supplied through `GEMINI_VISION_*` plus an API key or API-key file when enabled.

## Current Limitations

- Three farm network endpoints are still hardcoded in HAL/control source and should be migrated to settings.
- Hardware availability is independent of API process health; `/health` returning 200 does not prove sensors, cameras or farm controls are reachable.
- `.local` hostname resolution may not work reliably inside every Docker/LAN environment.
- Farm-control discovery/communication can fail across Docker networking even when the Engine itself is healthy.
- RAG and AI functionality depend on host Ollama availability.
- Vision depends on Gemini availability when enabled.
- Physical sensor calibration and actuator fail-safe behaviour must be validated on the real farm.
- The scheduler/action architecture should continue to be tested for restart recovery and idempotency.

## Related Documentation

- [Project README](../../README.md)
- [AI Core README](../ai_core/README.md)
- [Vision README](hal/ai_vision/README.md)
- [Backend README](../../webapp/backend/README.md)
