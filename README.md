# Leafy AI - Team Basilix

Leafy AI is a smart hydroponic farming system developed by Team Basilix at La Trobe University. The project supports sweet basil production in the university's multi-level Nutrient Film Technique (NFT) vertical farm.

The system brings together sensor monitoring, camera-based plant assessment, growing schedules, farm recommendations and equipment controls. A web dashboard provides access to farm information, while a Python-based engine manages data collection, scheduled operations and communication with the farm hardware.

## About the Project

The farm uses a multi-level NFT system with cameras, environmental and water-quality sensors, controllable lights and fans, and relay-operated dosing equipment.

Managing the growing environment involves monitoring several connected factors, including water quality, temperature, lighting, irrigation, plant growth and crop development.

Leafy AI is designed to bring these operations into one system, allowing farm information to be monitored, growing routines to be managed and recommendations to be reviewed before actions are taken.

## Features

### Farm Monitoring

The dashboard provides access to farm conditions, sensor history, camera images and equipment information.

- Current water and environmental sensor readings
- Historical sensor trends and charts
- Camera images
- Farm and equipment status
- Notifications and recent operational activity

### Camera-Based Plant Assessment

Camera capture and image analysis are handled separately.

The Vision worker processes stored images and records structured assessments in `plant_image_analysis`.

The assessments cover observable characteristics such as plant size, canopy coverage, crowding, overall appearance and visible signs of plant stress.

Image processing, model configuration, validation and stored results are described in the [Vision README](leafy-ai/engine/hal/ai_vision/README.md).

### Growing Schedules

Growing routines are managed through database-backed schedules.

The Engine checks for due tasks and calls the appropriate action handlers. Supported scheduled operations include lighting, irrigation, fan control and nutrient-management actions.

Task execution records allow the application to track scheduled operations and their reported outcomes.

### Recommendations and Growing Records

The system includes farm recommendations and analysis activity intended to support growing decisions.

Grow-cycle and harvest records provide information for reviewing previous growing routines and assessing crop outcomes and are also used by Leafy AI to evaluate crop growth and yield.

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

| Component      | Technology                        | Responsibility                                                  |
| -------------- | --------------------------------- | --------------------------------------------------------------- |
| Frontend       | React 19, Vite 8                  | Dashboard, monitoring and user interactions                     |
| Backend        | Node.js, Express 5                | Authentication, application APIs and Engine communication       |
| Farm Engine    | Python, FastAPI                   | Sensor collection, camera capture, scheduling and farm controls |
| AI Core        | Python, Ollama                    | Farm analysis and recommendations                               |
| Vision         | Python, Gemini API                | Camera-image processing and plant assessment                    |
| Database       | PostgreSQL, TimescaleDB, pgvector | Farm and application records                                    |
| Infrastructure | Docker, Nginx, Ollama             | Database container, web server configuration and LLM hosting    |

### Web Application

The backend handles authentication, user access and application operations. Farm-related requests are passed to the Python Engine through its API.

## Farm Engine

The Engine provides the farm-side services used by the application.

Its main responsibilities include collecting sensor readings, capturing camera images, processing scheduled tasks, managing equipment interfaces and recording farm operations.

The Engine also exposes endpoints used by the web backend to retrieve farm information and request supported operations.

### Vision and Analysis

Camera capture stores images independently of the Vision worker.

The Vision component processes captured images and saves assessment results to the database. These records are available to other services through the existing farm interfaces.

The AI Core is maintained separately and supports the project's farm analysis and recommendation functionality.

### Database

PostgreSQL and TimescaleDB provide persistent storage for the system.

pgvector is used to let Leafy AI have a comprehensive RAG system.

Stored information includes sensor readings, camera records, image assessments, growing schedules, task executions, recommendations, approvals, notifications, audit logs and grow-cycle records.

The web backend and farm engine have separate database responsibilities.

## Repository Structure

```text
Basilix-Leafy-AI/
├── .env.example
├── docker-compose.yml
├── database/
│   ├── Dockerfile
│   ├── init.sql
│   └── backend-init.sql
├── leafy-ai/
│   ├── ai_core/
│   │   ├── api.py
│   │   ├── main.py
│   │   ├── llm_api.py
│   │   ├── llm_auth.py
│   │   ├── llm_tools.py
│   │   ├── modelfile/
│   │   │   └── Modelfile
│   │   ├── schema.json
│   │   ├── system_prompt.md
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── engine/
│   │   ├── actions/
│   │   ├── api/
│   │   ├── hal/
│   │   │   └── ai_vision/
│   │   ├── logger/
│   │   ├── managers/
│   │   ├── security/
│   │   ├── sources/
│   │   ├── tools/
│   │   ├── ai_core_client.py
│   │   ├── ingest_rag.py
│   │   ├── main.py
│   │   ├── run_engine.py
│   │   ├── Dockerfile
│   │   └── README.md
│   └── requirements.txt
├── webapp/
│   ├── backend/
│   │   ├── src/
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── frontend/
│   │   ├── public/
│   │   ├── src/
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   ├── Dockerfile
│   │   └── README.md
│   └── nginx/
│       └── nginx.conf
├── README.md
└── REQUIREMENTS.md
```

The frontend, backend, Engine, AI Core and Vision components have separate implementation directories and documentation.

## Installation and Startup

The supported deployment is Docker Compose. It starts the database, Engine,
AI Core, backend, HTTPS frontend and the one-shot RAG ingestion and key-init jobs. Docker
managed volumes retain the database, generated keys and camera images.

### Requirements

- Docker Desktop with Compose
- A Google OAuth web client ID for sign-in
- Ollama on the host for AI Core features
- A Gemini API key only when Vision analysis is enabled
- Network access to the Farm network

### 1. Configure the environment

From the repository root copy .env.example to .env

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```env
DB_PASSWORD=replace_with_a_strong_password
GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_CLIENT_ID=your_google_client_id
JWT_SECRET=replace_with_a_long_random_secret
AI_CORE_URL=http://ai-core:8001
OLLAMA_HOST=http://host.docker.internal:11434
WATER_SENSOR_HOST=WaterSensors.local
WATER_SENSOR_FALLBACK_IP=192.168.1.100
AMBIENT_SENSOR_HOST=AmbientLevelSensors.local:8080
```

If Docker cannot resolve `.local` sensor names, use the sensors' LAN addresses
instead, for example:

```env
WATER_SENSOR_HOST=192.168.1.100
AMBIENT_SENSOR_HOST=192.168.1.101:8080
```

For AI Core, make sure Ollama is running and the configured model exists:

```bash
ollama serve
ollama list
```

To build the repository model when required:

```bash
cd leafy-ai/ai_core/modelfile
ollama create leafy-ai -f Modelfile
```

### 2. Build and start the complete system

From the repository root:

```bash
docker compose up -d --build
```

The first startup generates service keys and the local HTTPS certificate.
Open the application at [https://localhost](https://localhost). A browser
warning may appear until the generated local CA certificate is trusted.

The frontend publishes ports `80` and `443`. The Engine and backend are kept
inside the Compose network. The database is bound to `127.0.0.1:5432`.

### Local service development

The services can also be run individually for development, but Docker remains
the recommended integration environment. See the service READMEs for local
commands:

- [Engine README](leafy-ai/engine/README.md)
- [AI Core README](leafy-ai/ai_core/README.md)
- [Backend README](webapp/backend/README.md)
- [Frontend README](webapp/frontend/README.md)


## Documentation

| Document                                                 | Contents                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| [Frontend README](webapp/frontend/README.md)             | Application pages, navigation, authentication and API services   |
| [Backend README](webapp/backend/README.md)               | Express API, database operations and Engine communication        |
| [Engine README](leafy-ai/engine/README.md)               | Service lifecycle, scheduler, sensors, cameras and farm controls |
| [AI Core README](leafy-ai/ai_core/README.md)             | AI Core documentation                                            |
| [Vision README](leafy-ai/engine/hal/ai_vision/README.md) | Camera-image analysis and Vision configuration                   |

<br></br>

**Team Basilix**
La Trobe University

Developed as a university 2026 Capstone project focused on smart hydroponic farming.
