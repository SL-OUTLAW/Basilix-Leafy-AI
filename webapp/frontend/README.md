# Leafy AI Web Frontend

The frontend is a React application for monitoring and managing the Leafy AI hydroponic farm. It provides the dashboard for sensor readings, cameras, schedules, recommendations, approvals and system records.

Farm data and operations are accessed through the Express backend. The frontend does not communicate directly with farm hardware.

## Tech Stack

- React 19
- Vite 8
- JavaScript
- CSS Modules
- ECharts
- Lucide React
- Inter

## Run Locally

From the repository root:

```bash
cd webapp/frontend
npm ci
npm run dev
```

Vite prints the local development address after startup.

The development proxy in `vite.config.js` forwards `/api` requests to `http://localhost:3000`. The backend must be running for authentication and farm data requests to work.

To build the frontend:

```bash
npm run build
```

The production files are generated in `dist/`.

To preview that build locally:

```bash
npm run preview
```

The development proxy is not a production API configuration. Production hosting must route API requests to the backend separately.

## Pages

Page paths are defined in `src/App.jsx`.

| Path | Page | Purpose |
| --- | --- | --- |
| `/overview` | System Overview | Farm status, sensors, recommendations and recent activity |
| `/farm` | Farm Management | Monitoring, cameras, routines and farm controls |
| `/leafy-ai` | Leafy AI | Recommendations and analysis activity |
| `/safety` | Safety Management | Safety state, approvals and configuration |
| `/schedule` | Task Schedule | Scheduled operations and execution history |
| `/logs` | Audit Logs | System activity records |
| `/settings` | Settings | Application and farm settings |
| `/admin` | Admin | User and access management |

The root path `/` also opens the Overview page.

The Leafy AI page displays recommendations and activity records. It does not provide an interactive chat interface.

## Project Structure

```text
src/
├── App.jsx
├── main.jsx
├── components/
│   ├── auth/
│   ├── common/
│   ├── layout/
│   └── settings/
├── features/
│   ├── admin/
│   ├── farm/
│   ├── leafyAI/
│   ├── logs/
│   ├── overview/
│   ├── safety/
│   └── schedule/
├── services/
├── styles/
└── utils/
```

`main.jsx` mounts the application. `App.jsx` manages the current page, navigation, application state and loading of the main dashboard sections.

Shared interface components are kept in `components/`. Dashboard pages and their related components are grouped under `features/`.

Settings is implemented under `components/settings/`.

## Navigation and Data Loading

The application uses the browser History API for navigation. Route paths and page mappings are maintained in `App.jsx`; React Router is not used.

The main dashboard pages load data through their respective API services. Each page maintains loading and error states so an unavailable backend can be reported without inventing farm readings.

The Overview and Farm pages also receive sensor updates through `sensorStream.js`.

Global safety information and user access information are refreshed separately from the selected page's data.

The application stores the selected theme in browser local storage.

## Backend API Services

API requests are organised under `src/services/`.

| File | Responsibility |
| --- | --- |
| `apiClient.js` | Shared HTTP requests |
| `authApi.js` | Authentication requests |
| `overviewApi.js` | Overview dashboard data |
| `farmApi.js` | Sensors, cameras, schedules and farm controls |
| `sensorStream.js` | Sensor event stream |
| `leafyAiApi.js` | Recommendations and activity |
| `scheduleApi.js` | Schedule operations |
| `taskExecutionApi.js` | Execution records |
| `safetyApi.js` | Safety state and approvals |
| `notificationApi.js` | Notifications |
| `logsApi.js` | Audit logs |
| `growCycleApi.js` | Grow-cycle and harvest records |
| `settingsApi.js` | System settings |
| `adminApi.js` | User administration and access information |

API request formats and permissions are handled by the backend. See the [Backend API documentation](../backend/API.md) for the available interfaces.

## Authentication and Access

The frontend uses the backend authentication service for sign-in and session handling.

Google sign-in requires the backend's authentication configuration to be available. If that configuration is missing, the login page cannot complete Google authentication.

The application uses the authenticated user's access information when displaying navigation and protected pages. The Admin page is restricted to users with the `ADMIN` role.

Frontend access checks control the interface; the backend remains responsible for enforcing permissions on API requests.

## Styling

The interface uses CSS Modules for component-specific styles and shared styles for application-wide appearance.

The layout includes responsive navigation for smaller screens and supports the application's light and dark themes.

Charts are rendered using ECharts, and interface icons use Lucide React.

## Verification

The frontend currently defines these npm scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build |

There is no dedicated test or lint script defined in the current frontend package.

A successful build verifies compilation, but does not establish that backend requests or farm operations work.

Application testing should cover authentication, page navigation, permissions, sensor and camera data, schedules, approvals, notifications and responsive layouts.

## Related Documentation

- [Project README](../../README.md)
- [System Requirements](../../REQUIREMENTS.md)
- [Backend README](../backend/README.md)
- [Backend API Documentation](../backend/API.md)
