# Basilix — Leafy AI

Leafy AI is a smart hydroponic farming system developed by Team Basilix at La Trobe University. The project supports sweet basil production in the university's multi-level Nutrient Film Technique (NFT) vertical farm.

The system brings together sensor monitoring, camera-based plant assessment, growing schedules, farm recommendations and equipment controls. A web dashboard provides access to farm information, while a Python-based engine manages data collection, scheduled operations and communication with the farm hardware.

## About the Project

The farm uses a multi-level NFT system with cameras, environmental and water-quality sensors, controllable lights and fans, and relay-operated dosing equipment.

Managing the growing environment involves monitoring several connected factors, including water quality, temperature, lighting, irrigation, plant growth and crop development.

Leafy AI is designed to bring these operations into one system, allowing farm information to be monitored, growing routines to be managed and recommendations to be reviewed before actions are taken.

The project builds on the existing farm installation rather than replacing or redesigning its hardware.

## Features

### Farm Monitoring

The dashboard provides access to farm conditions, sensor history, camera images and equipment information.

- Current water and environmental sensor readings
- Historical sensor trends and charts
- Camera images associated with farm locations
- Farm and equipment status
- Notifications and recent operational activity

### Camera-Based Plant Assessment

Camera capture and image analysis are handled separately.

Captured images are saved and registered in `plant_images`. The Vision worker processes stored images and records structured assessments in `plant_image_analysis`.

The assessments cover observable characteristics such as plant size, canopy coverage, crowding, overall appearance and visible signs of plant stress.

Image processing, model configuration, validation and stored results are described in the [Vision README](leafy-ai/engine/hal/ai_vision/README.md).

### Growing Schedules

Growing routines are managed through database-backed schedules.

The Engine checks for due tasks and calls the appropriate action handlers. Supported scheduled operations include lighting, irrigation, fan control and nutrient-management actions.

Task execution records allow the application to track scheduled operations and their reported outcomes.

### Recommendations and Growing Records

The system includes farm recommendations and analysis activity intended to support growing decisions.

Grow-cycle and harvest records provide information for reviewing previous growing routines and assessing crop outcomes.

The Leafy AI dashboard displays recommendations and activity records; it does not provide an interactive chat interface.

### Safety and Farm Controls

The system includes application and farm-side controls for managing operations.

- Authentication and role-based access
- Approval requests for restricted operations
- Equipment control and status information
- Safety settings and emergency handling
- Notifications and audit logs
- Administrative user management

Farm actions remain subject to the Engine's validation and the approval requirements defined for the existing installation.

## System Architecture

Leafy AI consists of a React frontend, an Express backend, a Python farm engine, supporting analysis components and a PostgreSQL database.

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React 19, Vite 8 | Dashboard, monitoring and user interactions |
| Backend | Node.js, Express 5 | Authentication, application APIs and Engine communication |
| Farm Engine | Python, FastAPI | Sensor collection, camera capture, scheduling and farm controls |
| AI Core | Python | Farm analysis and recommendations |
| Vision | Python | Camera-image processing and plant assessment |
| Database | PostgreSQL, TimescaleDB | Farm and application records |
| Infrastructure | Docker, Nginx | Database container and web server configuration |

### Web Application

The frontend sends API requests to the Express backend.

The backend handles authentication, user access and application operations. Farm-related requests are passed to the Python Engine through its API.

During development, Vite forwards requests beginning with `/api` to the backend on port `3000`.

### Farm Engine

The Engine provides the farm-side services used by the application.

Its main responsibilities include collecting sensor readings, capturing camera images, processing scheduled tasks, managing equipment interfaces and recording farm operations.

The Engine also exposes endpoints used by the web backend to retrieve farm information and request supported operations.

### Vision and Analysis

Camera capture stores images independently of the Vision worker.

The Vision component processes captured images and saves assessment results to the database. These records are available to other services through the existing farm interfaces.

The AI Core is maintained separately and supports the project's farm analysis and recommendation functionality.

### Database

PostgreSQL and TimescaleDB provide persistent storage for the system.

Stored information includes sensor readings, camera records, image assessments, growing schedules, task executions, recommendations, approvals, notifications, audit logs and grow-cycle records.

The web backend and farm engine have separate database responsibilities.

## Repository Structure

```text
Basilix-Leafy-AI/
├── database/
│   ├── init.sql
│   ├── backend-init.sql
│   └── docker-compose.yml
├── leafy-ai/
│   ├── ai_core/
│   ├── engine/
│   │   ├── actions/
│   │   ├── api/
│   │   ├── hal/
│   │   ├── managers/
│   │   ├── security/
│   │   └── tools/
│   └── run_engine.py
├── webapp/
│   ├── backend/
│   ├── frontend/
│   └── nginx/
├── README.md
└── REQUIREMENTS.md
```

The frontend, backend, Engine, AI Core and Vision components have separate implementation directories and documentation.

## Getting Started

### Requirements

Local development requires:

- Node.js and npm
- Python with the required Engine dependencies
- Docker or an existing PostgreSQL/TimescaleDB installation
- Local configuration for the services being used

The backend provides `.env.example` as a configuration reference. Keep local credentials and environment files out of version control.

### 1. Database

Database configuration and initialization scripts are located in `database/`.

For a local development database, the supplied Docker Compose configuration can be used:

```bash
docker compose -f database/docker-compose.yml up -d
```

The database service exposes PostgreSQL on port `5432` by default.

Use a dedicated development database when testing operations that may create, update or delete records. Do not reinitialize an existing database containing important farm information.

### 2. Backend

From the repository root:

```bash
cd webapp/backend
npm ci
npm start
```

The backend starts through `src/server.js` and requires a working PostgreSQL connection.

With the default port configuration, the health endpoint is available at:

```text
http://localhost:3000/health
```

The endpoint returns:

```json
{
  "status": "ok"
}
```

Farm-related API requests also depend on the Python Engine and its supporting services.

See the [Backend README](webapp/backend/README.md) for the route structure, authentication and Engine communication.

### 3. Frontend

Open a separate terminal from the repository root:

```bash
cd webapp/frontend
npm ci
npm run dev
```

Vite prints the local development URL after startup.

To create a production build:

```bash
npm run build
```

The build output is generated in `webapp/frontend/dist/`.

See the [Frontend README](webapp/frontend/README.md) for application pages, navigation and API services.

### 4. Farm Engine

The tracked Engine entry point is:

```text
leafy-ai/run_engine.py
```

The FastAPI application is defined in `leafy-ai/engine/main.py`.

The current entry point uses Uvicorn on `127.0.0.1:8000`.

The Engine requires the appropriate Python environment, database connection and farm interfaces before startup. Starting it also initializes background services and may attempt hardware connections.

Use an approved development or test setup before running the Engine against farm equipment.

See the [Engine README](leafy-ai/engine/README.md) for its lifecycle, scheduler, HAL services and operational requirements.

## Farm Hardware and Operating Constraints

The system must work within the capabilities of the existing NFT farm.

| Farm component | Operating constraint |
| --- | --- |
| Irrigation | Shared across the farm |
| EC and pH | Shared across the farm |
| Lighting | Controllable by farm level |
| Fans | Per-level control is part of the farm design; actual software mapping must be verified |
| Dosing pumps | Relay-controlled, with software safety limits |
| NFT channels | Telescopic expansion is a manual operation |

Irrigation and dosing initially require human approval. Medium- and high-risk decisions require supporting sensor trends and safety validation.

Recommendations are separate from physical execution. Equipment operations must pass through the appropriate control and safety mechanisms.

## Development and Testing

The repository contains independent frontend, backend and Python services. Changes to API contracts, database records or equipment operations may affect multiple components.

### Frontend

From `webapp/frontend/`:

```bash
npm run build
```

### Backend

From `webapp/backend/`:

```bash
node --check src/server.js
npm audit
```

These checks cover compilation, JavaScript syntax and known npm dependency advisories. They do not replace runtime or integration testing.

Authentication, database communication, schedules, approvals and hardware operations should be verified in an appropriate development environment before deployment.

The repository includes a separate database Docker Compose configuration. A complete root-level deployment process has not yet been verified.

## Documentation

| Document | Contents |
| --- | --- |
| [System Requirements](REQUIREMENTS.md) | Project requirements, farm constraints and verification criteria |
| [Frontend README](webapp/frontend/README.md) | Application pages, navigation, authentication and API services |
| [Backend README](webapp/backend/README.md) | Express API, database operations and Engine communication |
| [Engine README](leafy-ai/engine/README.md) | Service lifecycle, scheduler, sensors, cameras and farm controls |
| [AI Core README](leafy-ai/ai_core/README.md) | AI Core documentation |
| [Vision README](leafy-ai/engine/hal/ai_vision/README.md) | Camera-image analysis and Vision configuration |
| [Backend API Documentation](webapp/backend/API.md) | API routes and service communication |

## Project Team

**Team Basilix**
La Trobe University

Developed as a university capstone project focused on smart hydroponic farming.
