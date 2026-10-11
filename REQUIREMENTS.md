# Leafy AI - System Requirements

## Project Overview

Leafy AI is a capstone project developed by Team Basilix at La Trobe University. The system is intended to support sweet basil production in the university's existing multi-level Nutrient Film Technique (NFT) hydroponic farm.

The project combines farm monitoring, growing schedules, plant image analysis, recommendations, safety controls and a web dashboard.

This document records the main functional requirements, system constraints and verification criteria. The requirements are based on the Leafy AI project proposal and subsequent team implementation decisions.

Implementation status must be assessed against the current code and test evidence. A feature being present in the repository does not establish that it has passed integration or hardware testing.

## System Components

| Component | Responsibility |
| --- | --- |
| Web frontend | Monitoring, schedules, approvals, controls and system records |
| Web backend | Application API, access control and engine communication |
| Farm engine | Scheduling, farm data processing, safety and hardware interfaces |
| AI Core | Farm recommendations and explanations |
| Vision | Camera-image assessment of basil growth and visible plant conditions |
| Database | Farm data, schedules, decisions, approvals and operational records |

## Functional Requirements

### Farm Monitoring

| ID | Requirement | Verification |
| --- | --- | --- |
| FR-01 | The system shall retrieve and record available farm sensor readings, including EC, pH and temperature. | Confirm readings are stored and can be retrieved with their timestamps. |
| FR-02 | The dashboard shall display available current and historical farm readings. | Compare displayed readings against their database records. |
| FR-03 | The system shall retrieve camera images for the relevant farm cameras and levels. | Confirm camera, level and capture information remain associated with each image. |
| FR-04 | Camera analysis shall support assessment of plant size, crowding, growth and visible health or stress signs, including dryness, wilting, overwatering-like symptoms and nutrient-deficiency-like symptoms. | Review outputs against labelled or manually reviewed camera images, including uncertain cases. |

### Growing Schedules

| ID | Requirement | Verification |
| --- | --- | --- |
| FR-05 | Growing schedules shall be stored and managed through the database. | Create or update a schedule and verify the stored record. |
| FR-06 | The engine shall process supported scheduled farm operations and record their execution outcomes. | Test task timing, execution records, failures and recovery using an approved test environment. |
| FR-07 | Schedule changes must be reflected consistently between the database, engine and dashboard. | Update a schedule and verify subsequent retrieval and execution behaviour. |

### Recommendations and Decisions

| ID | Requirement | Verification |
| --- | --- | --- |
| FR-08 | The system shall generate farm recommendations using available farm information and approved growing requirements. | Review recommendations against the data available when they were produced. |
| FR-09 | Recommendations and decisions shall include understandable explanations. | Confirm the explanation identifies the proposed change and its supporting information. |
| FR-10 | Recommended actions must pass through the required safety validation before hardware execution. | Test that an unsafe or invalid request is prevented from reaching the hardware interface. |

### Farm Controls and Approvals

| ID | Requirement | Verification |
| --- | --- | --- |
| FR-11 | Irrigation and dosing actions shall initially require human approval. | Confirm unapproved operations cannot execute through the supported control paths. |
| FR-12 | The system shall support permitted light and fan operations according to the farm's physical control layout. | Verify the control mapping and resulting device states against the actual farm. |
| FR-13 | Medium- and high-risk decisions shall use supporting trends rather than a single sensor reading. | Test decisions with insufficient, conflicting and confirmed trend evidence. |
| FR-14 | Dosing operations shall enforce approved software safety limits. | Test validation, refusal and stop conditions without exposing the live farm to unsafe dosing. |
| FR-15 | The system shall support manual overrides and emergency handling where provided by the farm control interface. | Verify access permissions, state changes, safety handling and audit records. |

### Web Application

| ID | Requirement | Verification |
| --- | --- | --- |
| FR-16 | The dashboard shall provide access to monitoring, recommendations, schedules, approvals, alerts and audit records. | Check the relevant pages and their backend data connections. |
| FR-17 | Protected operations shall require appropriate user permissions. | Test access as users with different permitted roles. |
| FR-18 | Important system events and actions shall be recorded for later review. | Verify audit records include the relevant action, time, outcome and available actor information. |
| FR-19 | The system shall provide notifications for relevant farm or operational events. | Trigger a supported notification condition and check its recorded and displayed state. |

### Grow Cycles and Harvests

| ID | Requirement | Verification |
| --- | --- | --- |
| FR-20 | The system shall record grow-cycle information and harvest outcomes. | Record a test grow cycle and harvest and verify retrieval. |
| FR-21 | Recorded outcomes shall support assessment and improvement of future growing routines. | Confirm that historical cycle and harvest information can be retrieved for comparison. |
| FR-22 | The project shall support predictive harvest or yield estimation as specified in the proposal. | Evaluate estimates against recorded harvest outcomes using an agreed validation method. |

## Hardware and Safety Constraints

The system must use the existing farm hardware without assuming control capabilities that are not available.

| ID | Constraint |
| --- | --- |
| HC-01 | Irrigation is shared across the farm. |
| HC-02 | EC and pH are shared across the farm. |
| HC-03 | Lights and fans are intended to support per-level control according to the farm design. |
| HC-04 | Dosing pumps are relay-based and require strict software limits. |
| HC-05 | Irrigation and dosing initially require human approval. |
| HC-06 | Medium- and high-risk actions require trend confirmation and safety validation. |
| HC-07 | Telescopic NFT channel expansion remains a manual physical operation prompted by a recommendation. |
| HC-08 | The project does not include redesigning farm hardware or relay safety systems. |

The current software and hardware configuration must be checked before claiming that all per-level controls are available.

Approved operating limits must come from the farm's authorised settings or growing routines. Numerical thresholds must not be assumed.

## Component Design Constraints

### Vision

Production Vision shall use one configured model for image assessment. Reference models may be used separately for evaluation. The current Vision documentation describes Gemini API integration.

Vision processing should:

- Process pending camera images in chronological order, including older unanalysed captures.
- Support a configurable analysis interval.
- Preserve camera, image and level information in its results.
- Use image evidence rather than sensor readings for visual assessment.
- Return structured results that other system components can use.
- Indicate uncertainty when image evidence is insufficient.

Vision should describe observed image conditions rather than directly issue farm-control commands.

The Vision team maintains its implementation and detailed documentation separately.

### Farm Engine

The engine is responsible for scheduled task processing and farm-side operations.

Schedule execution must use authoritative database records. Actions affecting hardware must respect the required safety and approval processes.

### Web Backend

The backend is responsible for the web application's API, access checks and communication with the engine.

The backend must not treat a successful request submission as proof that a physical operation has completed.

### Web Frontend

The frontend must display available farm information without inventing readings or successful operation states.

Interface restrictions do not replace server-side permission checks.

## Non-Functional Requirements

| ID | Requirement | Verification |
| --- | --- | --- |
| NFR-01 | The web dashboard shall support desktop and smaller-screen layouts. | Test the main workflows at representative screen sizes. |
| NFR-02 | Protected operations and data shall be accessible only to authorised users. | Test access restrictions at API and interface levels. |
| NFR-03 | Farm actions shall remain subject to the required safety checks. | Verify allowed and rejected requests across supported execution paths. |
| NFR-04 | Operational records shall retain sufficient information for audit and investigation. | Review sample records from successful and failed operations. |
| NFR-05 | Failures in database, engine, sensor or camera services shall be handled without misleading success states. | Test unavailable dependencies and inspect the reported outcomes. |
| NFR-06 | System configuration and installation procedures shall be documented for maintenance and handover. | Have another developer follow the documented setup in an approved environment. |

## Out of Scope

The original project proposal excludes:

- Redesign of the existing hydroponic farm hardware.
- Redesign of physical relay safety systems.
- Native mobile application development.
- Training custom AI or vision models entirely from scratch as a required deliverable.

The team's current application scope also excludes interactive AI chat in the web dashboard.

## Verification and Handover

Requirements should be marked complete only when supporting evidence exists.

Appropriate evidence may include:

- Source code and reviewed changes.
- Database records showing expected behaviour.
- API request and response tests.
- Frontend build and interaction tests.
- Integration test results.
- Approved hardware test records.
- Screenshots and logs demonstrating the tested outcome.

Test results must distinguish successful source checks from actual runtime, integration and hardware validation.

Any remaining limitations, failed tests and unverified requirements should be recorded before final handover.

## Related Documentation

- [Project README](README.md)
- [Frontend README](webapp/frontend/README.md)
- [Backend README](webapp/backend/README.md)
- [Engine README](leafy-ai/engine/README.md)
- [AI Core README](leafy-ai/ai_core/README.md)
- [Vision README](leafy-ai/engine/hal/ai_vision/README.md)
