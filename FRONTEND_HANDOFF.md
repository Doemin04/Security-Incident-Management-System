# Frontend Integration Handoff - SIMS Backend

This document is the current frontend-facing guide to the backend. It reflects the latest implemented backend and frontend integration work, including the new Threat Actor Correlation endpoint, browser-driven log import, and the analyst log review workflow.

## Starting the Backend

Run from `backend/`:

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Copy the env template and fill in your MySQL password
cp .env.example .env

# 3. Create or update the database schema
npm run init-db

# 4. Start the API server
npm run dev
```

Server starts at `http://localhost:3000`.

## Base URL

```text
http://localhost:3000/api
```

## CORS Setup

The backend uses strict CORS. Only the exact frontend origin listed in `backend/.env` is allowed.

Example:

```env
FRONTEND_ORIGIN=http://127.0.0.1:5500
```

If your frontend runs on a different origin, update the value and restart the backend.

## Response Format

All responses are JSON.

Success shapes:

```json
{ "message": "...", "IncidentID": 7 }
```

```json
{ "...": "single record fields" }
```

```json
[
  { "...": "record 1" }
]
```

Error shape:

```json
{ "error": "Human-readable reason here." }
```

HTTP status codes used:

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Bad request |
| `404` | Record or route not found |
| `500` | Server error |

## Backend Status Summary

Implemented now:

- Incident CRUD
- Asset CRUD
- IoC CRUD
- Analyst CRUD
- Incident notes create/list/delete
- Incident <-> asset link/unlink/list
- Incident <-> IoC link/unlink/list
- Incident <-> analyst assign/unassign/list
- correlation endpoint: `GET /api/correlation/threats`
- browser-triggered log import endpoint: `POST /api/log-import`
- log review endpoint: `GET /api/logs`
- create incident from log endpoint: `POST /api/logs/:logEventID/create-incident`
- delete log endpoint: `DELETE /api/logs/:logEventID`
- frontend log review UI with search and 20-items-per-page pagination
- frontend asset, IoC, and analyst management UI

Not implemented as frontend/API features yet:

- Browser-triggered log import endpoint -deprecated
- Frontend UI for asset CRUD -deprecated
- Frontend UI for IoC CRUD -deprecated
- Frontend UI for analyst CRUD -deprecated
- Frontend UI for linking/unlinking assets, IoCs, and analysts -deprecated
- Frontend UI for correlation campaigns -deprecated

## Incidents - `/api/incidents`

### Field reference

| Field | Type | Notes |
|---|---|---|
| `IncidentID` | number | Auto-assigned |
| `Title` | string | Required on create |
| `Description` | string | Required on create |
| `Status` | string | `"Open"` `"In Progress"` `"Closed"` `"False Positive"` |
| `Severity` | string | `"Low"` `"Medium"` `"High"` `"Critical"` |
| `Created_At` | ISO datetime | Auto-assigned by DB/system |
| `Closed_At` | ISO datetime or `null` | Auto-filled when closed/false positive |
| `TTR` | number or `null` | Minutes to resolve |

### Routes

| Method | URL | Body |
|---|---|---|
| `GET` | `/incidents` | - |
| `GET` | `/incidents/:id` | - |
| `POST` | `/incidents` | `{ Title, Description, Status?, Severity? }` |
| `PUT` | `/incidents/:id` | Any subset of `Title`, `Description`, `Status`, `Severity` |
| `DELETE` | `/incidents/:id` | - |

Notes:

- The frontend currently maps display label `Resolved` to backend value `Closed`.
- Setting `Status` to `Closed` or `False Positive` auto-populates `Closed_At` and `TTR`.

## Assets - `/api/assets`

| Method | URL | Body |
|---|---|---|
| `GET` | `/assets` | - |
| `GET` | `/assets/:id` | - |
| `POST` | `/assets` | `{ Hostname, IP_Address, Source }` |
| `PUT` | `/assets/:id` | Any subset of fields |
| `DELETE` | `/assets/:id` | - |

## IoCs - `/api/iocs`

| Method | URL | Body |
|---|---|---|
| `GET` | `/iocs` | - |
| `GET` | `/iocs/:id` | - |
| `POST` | `/iocs` | `{ Type, Value }` |
| `PUT` | `/iocs/:id` | Any subset of fields |
| `DELETE` | `/iocs/:id` | - |

Allowed `Type` values:

- `IP`
- `Domain`
- `Hash`
- `URL`
- `Email`

## Analysts - `/api/analysts`

| Method | URL | Body |
|---|---|---|
| `GET` | `/analysts` | - |
| `GET` | `/analysts/:id` | - |
| `POST` | `/analysts` | `{ Name, Role, Email }` |
| `PUT` | `/analysts/:id` | Any subset of fields |
| `DELETE` | `/analysts/:id` | - |

## Notes - `/api/incidents/:id/notes`

| Method | URL | Body |
|---|---|---|
| `GET` | `/incidents/:id/notes` | - |
| `POST` | `/incidents/:id/notes` | `{ Content }` |
| `DELETE` | `/incidents/:id/notes/:noteId` | - |

## Incident Relationship Endpoints

### Incident <-> Asset

| Method | URL | Body |
|---|---|---|
| `GET` | `/incidents/:id/assets` | - |
| `POST` | `/incidents/:id/assets/:assetId` | Empty body is fine |
| `DELETE` | `/incidents/:id/assets/:assetId` | - |

### Incident <-> IoC

| Method | URL | Body |
|---|---|---|
| `GET` | `/incidents/:id/iocs` | - |
| `POST` | `/incidents/:id/iocs/:iocId` | Empty body is fine |
| `DELETE` | `/incidents/:id/iocs/:iocId` | - |

### Incident <-> Analyst

| Method | URL | Body |
|---|---|---|
| `GET` | `/incidents/:id/analysts` | - |
| `POST` | `/incidents/:id/analysts/:analystId` | Empty body is fine |
| `DELETE` | `/incidents/:id/analysts/:analystId` | - |

## Threat Actor Correlation - `/api/correlation/threats`

This is the new Phase 5 advanced endpoint.

Purpose:

- Finds IoCs that are linked to more than one distinct incident
- Groups the shared IoC together with the incident records that contain it

Route:

| Method | URL | Body |
|---|---|---|
| `GET` | `/api/correlation/threats` | - |

Example response shape:

```json
[
  {
    "IncidentCount": 2,
    "IOC": {
      "IOCID": 12,
      "Type": "IP",
      "Value": "185.22.81.14"
    },
    "Incidents": [
      {
        "IncidentID": 19,
        "Title": "Phase 5 Correlation Test Incident B",
        "Description": "Second temporary incident mapped to the same IOC for correlation endpoint validation.",
        "Status": "In Progress",
        "Severity": "Critical",
        "Created_At": "2026-04-15T01:33:43.000Z",
        "Closed_At": null,
        "TTR": null
      },
      {
        "IncidentID": 18,
        "Title": "Phase 5 Correlation Test Incident A",
        "Description": "Temporary incident created to verify shared IOC threat campaign grouping.",
        "Status": "Open",
        "Severity": "High",
        "Created_At": "2026-04-15T01:33:43.000Z",
        "Closed_At": null,
        "TTR": null
      }
    ]
  }
]
```

Frontend recommendation:

- Add a dedicated "Threat Campaigns" view or panel
- Render campaign cards by shared IoC
- Show incident count, IoC value/type, and the linked incident records

## Phase 4 Log Import Status

Current state:

- Log import exists as a backend CLI script: `backend/src/logParser.ts`
- It reads either a local file or a remote file over SSH
- It writes raw log rows into `LogEvent`
- It creates linked incidents/assets in MySQL

What the frontend does not have yet:

- No HTTP endpoint to trigger log import from the browser
- No UI for selecting a log file and submitting an import job
- No UI for displaying raw `LogEvent` records

For now, treat log import as an operator/backend workflow, not a frontend feature.

## Frontend Work Needed Now

Recommended next frontend tasks:

1. Add a correlation page or section that calls `GET /api/correlation/threats`.
2. Add a delete incident action that calls `DELETE /api/incidents/:id`.
3. Open asset, IoC, and analyst CRUD in the UI. (we dont have time to do authentication but it is normally required for these operations)
4. Add UI controls for linking/unlinking assets, IoCs, and analysts to incidents if those workflows are needed.
5. Do not build a browser log-import flow yet unless a backend HTTP endpoint is added for it.

## Frontend Testing Checklist

Basic incident flow:

1. Fetch incidents with `GET /api/incidents`
2. Create one with `POST /api/incidents`
3. Update status/severity with `PUT /api/incidents/:id`
4. Delete it with `DELETE /api/incidents/:id`

Detail flow:

1. Select an incident
2. Fetch notes, assets, IoCs, and analysts for it
3. Add and delete a note

Correlation flow:

1. Call `GET /api/correlation/threats`
2. Confirm that the shared IoC `185.22.81.14` returns a grouped threat campaign
3. Render the linked incidents under that IoC

## Frontend Cautions

- Do not assume the browser can trigger log import yet. It cannot. It is back end only as there is no auth. Just do the front end import end point so it is there.
- The current backend already supports more than the prototype frontend uses.
- If rendering user-generated fields such as incident titles, descriptions, or notes, avoid `innerHTML` where possible to reduce XSS risk.
