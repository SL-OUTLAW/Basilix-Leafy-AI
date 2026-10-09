# Webapp Backend to Leafy Engine API

The browser authenticates to the Node backend with the normal webapp access token. The Node backend validates the user and then calls the Leafy Engine with a short-lived Ed25519 service JWT plus trusted user context headers.

## Required backend environment

```env
ENGINE_URL=http://127.0.0.1:8000
ENGINE_TIMEOUT_MS=15000
ENGINE_PRIVATE_KEY_PATH=../../secrets/webapp_backend_private_key
```

If the backend and Engine run in Docker Compose, use the Engine service hostname instead of localhost, for example `ENGINE_URL=http://engine:8000`.

Generate the webapp backend Engine key pair once with:

```bash
npm run generate:engine-keys
```

Configure the Engine to read the generated public key through `WEBAPP_BACKEND_PUBLIC_KEY_PATH`.

## Backend routes

All routes below require a valid webapp user access token. Admin-only routes are also checked against the live `allowed_users` role.

- `GET /api/farm/state`
- `GET /api/farm/sensors`
- `GET /api/farm/sensors/:sensorType/history`
- `GET /api/farm/sensors/stream`
- `GET /api/farm/cameras`
- `GET /api/farm/cameras/:cameraId/image`
- `GET /api/farm/cameras/:cameraId/analysis`
- `GET /api/farm/schedule`
- `GET /api/farm/schedule/:scheduleId`
- `POST /api/farm/schedule`
- `PATCH /api/farm/schedule/:scheduleId`
- `POST /api/farm/schedule/:scheduleId/enable`
- `POST /api/farm/schedule/:scheduleId/disable`
- `GET /api/farm/controls`
- `POST /api/farm/controls/lighting`
- `POST /api/farm/controls/irrigation`
- `POST /api/farm/controls/fan`
- `POST /api/farm/controls/ph/target` (ADMIN)
- `POST /api/farm/controls/ec/target` (ADMIN)
- `GET /api/notifications`
- `GET /api/notifications/:notificationId`
- `PATCH /api/notifications/:notificationId/resolve`
- `GET /api/ai/recommendations`
- `GET /api/ai/activity`
- `GET /api/approvals`
- `GET /api/approvals/:approvalId`
- `POST /api/approvals/:approvalId/approve` (ADMIN)
- `POST /api/approvals/:approvalId/reject` (ADMIN)
- `GET /api/safety`
- `GET /api/safety/configuration`
- `POST /api/safety/emergency-stop` (ADMIN)
- `POST /api/safety/emergency-stop/clear` (ADMIN)
- `POST /api/safety/ai/enable` (ADMIN)
- `POST /api/safety/ai/disable` (ADMIN)
- `GET /api/logs`
- `GET /api/grow-cycles`
- `GET /api/grow-cycles/active`
- `POST /api/grow-cycles`
- `GET /api/grow-cycles/:growCycleId`
- `POST /api/grow-cycles/:growCycleId/complete`
- `POST /api/grow-cycles/:growCycleId/cancel` (ADMIN)
- `POST /api/grow-cycles/:growCycleId/harvests`
- `GET /api/grow-cycles/:growCycleId/harvests`
- `GET /api/harvest/history`
- `GET /api/task-executions`
- `GET /api/task-executions/:executionId`
- `GET /api/settings` (ADMIN)
- `POST /api/settings/reload` (ADMIN)
- `PATCH /api/settings` (ADMIN)

The backend never trusts `X-User-ID` or `X-User-Role` values from the browser. It derives both values from its authenticated user and sends them to the Engine itself.

## Backend audit logging

The web backend does not connect directly to the Leafy Engine database. Backend audit events are sent to the Engine over the authenticated service connection:

```text
POST /audit-logs
```

The Engine writes the event to its `audit_logs` table. The backend database remains responsible only for web authentication/session data.
