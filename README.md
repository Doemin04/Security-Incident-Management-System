# Security Incident Management System (SIMS)

## Project Overview

This repository contains a database-driven Security Incident Management System for a SOC-style workflow. The current codebase is split into a TypeScript/Express backend and a separate frontend prototype.

This README is the current logistics/source-of-truth file for the project structure, implemented backend features, and available API endpoints.

## Current Stack

| Layer | Technology |
|---|---|
| Database | MySQL 8.0 |
| Backend | Node.js, TypeScript, Express |
| DB Driver | `mysql2/promise` |
| Frontend | Separate prototype in `frontend/` |
| Runtime tooling | `ts-node`, `nodemon` |

## Key Features

Current backend features:

- Incident tracking with live MySQL-backed CRUD operations, status handling, and TTR calculation
- Asset and analyst management, including incident assignment/linking through junction tables
- Independent IoC registry for storing and reusing indicators across incidents
- Incident-scoped notes with weak-entity behavior under the parent incident
- Standalone Phase 4 log ingestion stores raw log events for analyst review; incidents are manually created from logs
- Log Review UI supports search and shows 20 logs per page for analyst triage
- Phase 5 threat campaign correlation across incidents that share the same IoC
- Strict CORS configuration for controlled frontend access

Planned or project-scope features not implemented in the current backend yet:

- Browser-triggered log import endpoint -deprecated

## Current Repository Structure

```text
.
|-- backend/
|   |-- .env
|   |-- .env.example
|   |-- package.json
|   |-- package-lock.json
|   |-- seed.sql
|   |-- test-pfsense.log
|   |-- tsconfig.json
|   |-- tests/
|   `-- src/
|       |-- config/
|       |   `-- db.ts
|       |-- controllers/
|       |   |-- analystController.ts
|       |   |-- assetController.ts
|       |   |-- incidentController.ts
|       |   |-- iocController.ts
|       |   |-- junctionController.ts
|       |   `-- noteController.ts
|       |-- routes/
|       |   |-- analystRoutes.ts
|       |   |-- assetRoutes.ts
|       |   |-- incidentRoutes.ts
|       |   |-- iocRoutes.ts
|       |   |-- junctionRoutes.ts
|       |   `-- noteRoutes.ts
|       |-- index.ts
|       |-- init-db.ts
|       |-- logParser.ts
|       `-- seedMitreAttack.ts
|-- frontend/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- FRONTEND_HANDOFF.md
`-- README.md
```

## Relational Schema

```text
Incident (IncidentID [PK], Title, Description, Closed_At, Created_At, TTR, Status, Severity)
Asset (AssetID [PK], Hostname, IP_Address, Source)
Analyst (AnalystID [PK], Name, Role, Email)
IndicatorOfCompromise (IOCID [PK], Type, Value)
Note (IncidentID [PK/FK], NoteID [PK], Content, Time)

Incident_Asset_Affects (IncidentID [FK], AssetID [FK])
Incident_IOC_Contains (IncidentID [FK], IOCID [FK])
Incident_Analyst_Assigned (IncidentID [FK], AnalystID [FK])
```

## Improved Schema (Phase 4/5 Decision)

We decided to improve the schema so logs are stored as first-class telemetry instead of existing only as incident text.

```text
LogEvent (LogEventID [PK], EventTime, SourceIP, DestinationIP, Message, RawLine, SourceSystem, SourceAssetID [FK], DestinationAssetID [FK], Ingested_At)
Incident_LogEvent_Contains (IncidentID [FK], LogEventID [FK])
```

Why this was added:

- `LogEvent.EventTime` stores the parsed syslog timestamp
- `Incident.Created_At` stays reserved for when the SIMS ticket is created
- raw telemetry is preserved for future reprocessing, auditing, and correlation
- incidents can now reference one or many log events through a junction table

Supporting index decision:

- `Asset.IP_Address` is indexed to support faster asset dedupe during ingestion

## Current Backend Behavior

Implemented and present in `backend/src/`:

- MySQL connection pooling through `backend/src/config/db.ts`
- Database/table bootstrap through `backend/src/init-db.ts`
- Standalone log ingestion through `backend/src/logParser.ts`
- Log review and manual incident creation through the new `GET /api/logs` and `POST /api/logs/:logEventID/create-incident` endpoints
- Standalone MITRE-style seeding through `backend/src/seedMitreAttack.ts`
- Threat campaign correlation through `GET /api/correlation/threats`
- Incident full CRUD
- Asset full CRUD
- IoC full CRUD
- Analyst full CRUD
- Incident-scoped notes create/list/delete
- Junction endpoints for linking and unlinking assets, IoCs, and analysts to incidents
- Strict CORS based on `FRONTEND_ORIGIN`
- Automatic `Closed_At` and `TTR` calculation when incident status is set to `Closed` or `False Positive`

Planned or not implemented in the current backend code:

- Log-ingestion endpoints exposed through the API

## Important Notes

- The backend uses the live MySQL database. There is no in-memory storage layer.
- `pool` is exported from `backend/src/config/db.ts`.
- The frontend prototype displays `Resolved`, but the backend enum value is `Closed`. The frontend currently maps between those values in `frontend/app.js`.
- Notes are weak entities under incidents and cascade on incident delete at the database level.
- Junction tables use composite primary keys and `ON DELETE CASCADE`.
- The parsed syslog timestamp maps to `LogEvent.EventTime`, not `Incident.Created_At`.
- `logParser.ts` writes directly through the existing MySQL pool rather than going through the Express API.

## Setup

## Test Helpers

The backend now keeps test helper scripts in `backend/tests/`, and `backend/tests/` is excluded from version control by `.gitignore`.


### Backend

Run commands from `backend/`:

```bash
cd backend
npm install
cp .env.example .env
npm run init-db
npm run dev
```

The API runs on `http://localhost:3000` unless `PORT` is overridden.

### Frontend Prototype

The frontend is a separate prototype in `frontend/`. It should be served from a local dev server so the configured backend CORS origin can allow it.

The backend expects:

```env
FRONTEND_ORIGIN=http://127.0.0.1:5500
```

Adjust that value in `backend/.env` if the frontend is served from a different origin.

## Available Backend Scripts

Run from `backend/`:

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `ts-node src/index.ts` | Start the API |
| `npm run init-db` | `ts-node src/init-db.ts` | Create database/tables if missing |
| `npm run parse-logs` | `ts-node src/logParser.ts` | Parse local or SSH-fetched logs into `LogEvent` and linked incidents |
| `npm run seed-mitre` | `ts-node src/seedMitreAttack.ts` | Seed MITRE-style incidents directly into MySQL |

## Log Import Commands

Run from `backend/`:

```bash
npx ts-node src/logParser.ts test-pfsense.log
npx ts-node src/logParser.ts --file test-pfsense.log --source-system pfSense
npx ts-node src/logParser.ts --ssh --host 10.0.0.5 --user admin --remote-path /var/log/filter.log --source-system pfSense
```

Useful flags:

- `--dry-run`
- `--limit <count>`

The included `backend/test-pfsense.log` file is a representative pfSense-style sample for local parser testing.

## MITRE Seed Commands

Run from `backend/`:

```bash
npx ts-node src/seedMitreAttack.ts --count 25
npx ts-node src/seedMitreAttack.ts --count 5 --dry-run
```

## API Base URL

```text
http://localhost:3000/api
```

## Correlation Endpoint

```text
GET /api/correlation/threats
```

This route returns grouped "threat campaigns" for any IoC that is linked to more than one discrete incident.

## API Endpoints

### Incidents

| Method | Endpoint | Description |
|---|---|---|
| GET | `/incidents` | List all incidents |
| GET | `/incidents/:id` | Get one incident |
| POST | `/incidents` | Create an incident |
| PUT | `/incidents/:id` | Update incident fields |
| DELETE | `/incidents/:id` | Delete an incident |

Incident status values:

- `Open`
- `In Progress`
- `Closed`
- `False Positive`

Incident severity values:

- `Low`
- `Medium`
- `High`
- `Critical`

### Assets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/assets` | List all assets |
| GET | `/assets/:id` | Get one asset |
| POST | `/assets` | Create an asset |
| PUT | `/assets/:id` | Update an asset |
| DELETE | `/assets/:id` | Delete an asset |

### IoCs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/iocs` | List all IoCs |
| GET | `/iocs/:id` | Get one IoC |
| POST | `/iocs` | Create an IoC |
| PUT | `/iocs/:id` | Update an IoC |
| DELETE | `/iocs/:id` | Delete an IoC |

IoC type values:

- `IP`
- `Domain`
- `Hash`
- `URL`
- `Email`

### Analysts

| Method | Endpoint | Description |
|---|---|---|
| GET | `/analysts` | List all analysts |
| GET | `/analysts/:id` | Get one analyst |
| POST | `/analysts` | Create an analyst |
| PUT | `/analysts/:id` | Update an analyst |
| DELETE | `/analysts/:id` | Delete an analyst |

### Notes

Notes are incident-scoped:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/incidents/:id/notes` | List notes for an incident |
| POST | `/incidents/:id/notes` | Add a note to an incident |
| DELETE | `/incidents/:id/notes/:noteId` | Delete one note from an incident |

### Incident Junctions

#### Incident <-> Asset

| Method | Endpoint | Description |
|---|---|---|
| GET | `/incidents/:id/assets` | List assets linked to an incident |
| POST | `/incidents/:id/assets/:assetId` | Link asset to incident |
| DELETE | `/incidents/:id/assets/:assetId` | Unlink asset from incident |

#### Incident <-> IoC

| Method | Endpoint | Description |
|---|---|---|
| GET | `/incidents/:id/iocs` | List IoCs linked to an incident |
| POST | `/incidents/:id/iocs/:iocId` | Link IoC to incident |
| DELETE | `/incidents/:id/iocs/:iocId` | Unlink IoC from incident |

#### Incident <-> Analyst

| Method | Endpoint | Description |
|---|---|---|
| GET | `/incidents/:id/analysts` | List analysts assigned to an incident |
| POST | `/incidents/:id/analysts/:analystId` | Assign analyst to incident |
| DELETE | `/incidents/:id/analysts/:analystId` | Unassign analyst from incident |

### Correlation

| Method | Endpoint | Description |
|---|---|---|
| GET | `/correlation/threats` | Group incidents that share the exact same IoC |

## Response Conventions

Successful responses return JSON in one of these shapes:

```json
{ "message": "Incident created.", "IncidentID": 6 }
```

```json
{ "IncidentID": 1, "Title": "..." }
```

```json
[
  { "IncidentID": 1, "Title": "..." }
]
```

Errors return:

```json
{ "error": "Human-readable reason." }
```

Typical status codes used:

- `200`
- `201`
- `400`
- `404`
- `500`

## Seed Data

`backend/seed.sql` currently seeds:

- 3 analysts
- 5 incidents
- 5 assets
- 5 IoCs
- 5 notes
- incident/asset links
- incident/IoC links
- incident/analyst links

The seed data intentionally includes a shared IoC between incidents 2 and 4, which is useful for future correlation work.
