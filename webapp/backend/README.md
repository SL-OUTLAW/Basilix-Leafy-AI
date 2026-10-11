# Leafy AI Web Backend

The Leafy AI web backend is a Node.js and Express service that connects the React dashboard to the farm engine. It handles authentication, user access, application data and API requests for farm monitoring and operations.

Application-specific records are stored in PostgreSQL. Farm data and control requests are handled through the Python Engine API.

## Tech Stack

- Node.js
- Express 5
- PostgreSQL
- Google Auth Library
- JSON Web Tokens
- Axios

## Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL database
- Backend environment configuration
- Running Leafy AI Engine for farm-related API requests

The backend configuration example is available at `.env.example`. Engine communication and service authentication are documented in [API.md](API.md).

### Installation

From the repository root:

```bash
cd webapp/backend
npm ci
```

### Start the Backend

```bash
npm start
```

The start script runs `src/server.js`.

The backend listens on port `3000` by default. The port can be configured for the local environment.

On startup, the backend checks its PostgreSQL connection before accepting HTTP requests. If the database connection fails, the server does not start successfully.

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

This confirms that the backend HTTP service is responding. Farm-related requests also depend on the Engine and its supporting services.

## Request Handling

The React frontend sends API requests to the Express backend through `/api`.

Depending on the route, the backend either accesses its application database or forwards the request to the Python Engine.

The backend is responsible for checking the user's session and permissions before allowing protected operations.

Farm control requests are processed by the Engine, which manages farm-side validation, scheduling and hardware interfaces.

## API Routes

Routes are registered in `src/server.js` and implemented in `src/routes/`.

| Route | Purpose |
| --- | --- |
| `/api/auth` | Authentication and session management |
| `/api/access` | User access information |
| `/api/admin` | User administration |
| `/api/farm` | Farm state, sensors, cameras, schedules and controls |
| `/api/ai` | Recommendations and activity records |
| `/api/approvals` | Approval requests and decisions |
| `/api/safety` | Safety state and emergency operations |
| `/api/notifications` | Notification retrieval and management |
| `/api/logs` | Audit log retrieval |
| `/api/grow-cycles` | Grow-cycle management |
| `/api/harvest` | Harvest records |
| `/api/task-executions` | Scheduled task execution history |
| `/api/settings` | System settings |

For example, the farm routes include:

- `GET /api/farm/state`
- `GET /api/farm/sensors`
- `GET /api/farm/sensors/stream`
- `GET /api/farm/cameras`
- `GET /api/farm/schedule`
- `GET /api/farm/controls`
- `POST /api/farm/controls/lighting`
- `POST /api/farm/controls/irrigation`

Individual HTTP methods, request parameters and access restrictions are defined in the route handlers.

See [API.md](API.md) for the existing API reference and Engine communication details.

## Project Structure

```text
webapp/backend/
├── src/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── server.js
├── API.md
├── package.json
└── package-lock.json
```

### Main Files

| File | Responsibility |
| --- | --- |
| `src/server.js` | Express setup, routes, health check and startup |
| `src/middleware/authenticate.js` | Request authentication |
| `src/middleware/authorizeRole.js` | Role-based access restrictions |
| `src/services/backendDatabase.js` | PostgreSQL connection and queries |
| `src/services/engineClient.js` | Communication with the Python Engine |
| `src/services/sessionService.js` | Session management |
| `src/services/accessControl.js` | Access-control operations |
| `src/services/auditLogger.js` | Audit event handling |
| `src/services/userSync.js` | User synchronisation |

Route-specific logic is kept in `src/routes/`, while shared operations are implemented in `src/services/`.

## Authentication and Access Control

Authentication is handled by the backend rather than trusting identity information supplied directly by the browser.

The implementation includes Google authentication, application sessions and role-based access checks.

The backend derives the authenticated user's identity and role before passing relevant information to the Engine.

Protected operations must be authorised by the backend even if the frontend already hides controls from users without permission.

## Engine Communication

Engine requests are managed through `src/services/engineClient.js`.

This service handles requests from the web backend to the Python Engine, including farm data retrieval and operations that require Engine processing.

The backend also supports service-level communication with the Engine.

Relevant Engine operations include:

- Retrieving sensor and camera information
- Managing farm schedules
- Requesting farm controls
- Retrieving recommendations
- Managing approvals and safety operations
- Retrieving execution and audit records

A successful HTTP request does not necessarily confirm that physical farm equipment has completed an operation. Hardware state and execution results are managed on the Engine side.

## Database

The web backend uses PostgreSQL for application records.

The database connection is managed in `src/services/backendDatabase.js`.

Database setup files are stored in the repository's `database/` directory, including:

- `database/backend-init.sql`
- `database/docker-compose.yml`

The web application database has separate responsibilities from the farm records managed by the Engine.

The backend communicates with the Engine through its API rather than querying the Engine's farm database directly.

## Audit Logging

Audit handling is implemented in `src/services/auditLogger.js`.

Backend audit events are sent to the Engine for recording through the existing service communication mechanism.

Audit records can be retrieved through the `/api/logs` routes.

## Verification

The backend package provides an `npm start` script. It does not currently define a dedicated automated test script.

The server entry point can be checked for syntax with:

```bash
node --check src/server.js
```

Installed dependencies can be audited with:

```bash
npm audit
```

Before deployment, the application should be tested for:

- Backend startup and database connectivity
- Authentication and session handling
- User permissions
- Frontend API requests
- Engine connectivity
- Farm data retrieval
- Schedule and approval operations
- Safety handling and audit records

These checks require an appropriate development or test environment. The health endpoint alone does not verify all backend integrations.

## Related Documentation

- [Project README](../../README.md)
- [System Requirements](../../REQUIREMENTS.md)
- [Frontend README](../frontend/README.md)
- [Engine README](../../leafy-ai/engine/README.md)
- [Backend API Documentation](API.md)
