# Frontend Integration Handoff — SIMS Backend

This document is everything you need to connect the frontend to the backend.

---

## Starting the Backend

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Copy the env template and fill in your MySQL password
cp .env.example .env

# 3. Create the database and all tables (first time only)
npm run init-db

# 4. Start the API server
npm run dev
```

Server starts at: **`http://localhost:3000`**

---

## Base URL

```
http://localhost:3000/api
```

---

## CORS Setup — Required Before You Can Connect

The backend uses **strict CORS** (least privilege). It will only accept requests from the exact origin you register in the backend's `.env` file. Every other origin gets blocked by the browser.

**You need to tell the backend developer your frontend's port so they can add it. Or, if you have access to the `.env` file yourself, do this:**

### Step 1 — Find out what port your frontend runs on

| Tool | Default origin |
|---|---|
| VS Code Live Server | `http://localhost:5500` |
| Vite | `http://localhost:5173` |
| React (Create React App) | `http://localhost:3001` |
| Plain `index.html` opened as a file | ⚠️ Won't work — must use a dev server |

### Step 2 — Set it in the backend `.env` file

Open the `.env` file in the backend project root and add/update this line:

```env
FRONTEND_ORIGIN=http://localhost:5500
```

Replace `5500` with your actual port.

### Step 3 — Restart the backend

```bash
npm run dev
```

You should see no CORS warning in the terminal. If you see:

```
[CORS] WARNING: FRONTEND_ORIGIN is not set in .env — all cross-origin requests will be blocked.
```

It means the variable is missing — go back to Step 2.

### Step 4 — Verify it works

Open your browser's DevTools → Network tab → make a request to the API. If CORS is misconfigured you will see a red error like:

```
Access to fetch at 'http://localhost:3000/api/incidents' from origin 'http://localhost:5500'
has been blocked by CORS policy
```

Fix: double-check the origin in `.env` matches exactly (including `http://`, no trailing slash).

---

## Response Format

Every response is JSON.

**Success:**
```json
{ "message": "...", "IncidentID": 7 }   // create
{ ...data object... }                    // single fetch
[ ...array of objects... ]               // list fetch
```

**Error (all failures):**
```json
{ "error": "Human-readable reason here." }
```

**HTTP status codes used:**

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Bad request — missing/invalid field |
| `404` | Record not found |
| `500` | Server error |

---

## Incidents — `/api/incidents`

### Field reference

| Field | Type | Notes |
|---|---|---|
| `IncidentID` | number | Auto-assigned, read-only |
| `Title` | string | Required on create |
| `Description` | string | Required on create |
| `Status` | string | `"Open"` `"In Progress"` `"Closed"` `"False Positive"` |
| `Severity` | string | `"Low"` `"Medium"` `"High"` `"Critical"` |
| `Created_At` | ISO datetime | Auto-assigned |
| `Closed_At` | ISO datetime or `null` | Auto-filled when Status → Closed |
| `TTR` | number or `null` | Minutes to resolve — auto-calculated on close |

---

### GET all incidents
```
GET /api/incidents
```
Returns array ordered newest first.

```js
const res  = await fetch('http://localhost:3000/api/incidents');
const data = await res.json(); // array of incident objects
```

---

### GET one incident
```
GET /api/incidents/:id
```
```js
const res  = await fetch(`http://localhost:3000/api/incidents/${id}`);
const data = await res.json();
```

---

### POST — create incident
```
POST /api/incidents
Content-Type: application/json
```
**Required:** `Title`, `Description`
**Optional:** `Status` (default `"Open"`), `Severity` (default `"Medium"`)

```js
const res = await fetch('http://localhost:3000/api/incidents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    Title: 'Malware on WS-03',
    Description: 'Defender flagged a trojan dropper.',
    Status: 'Open',
    Severity: 'High'
  })
});
const data = await res.json();
// { "message": "Incident created.", "IncidentID": 7 }
```

---

### PUT — update incident
```
PUT /api/incidents/:id
Content-Type: application/json
```
Send only the fields you want to change. All fields are optional.

```js
const res = await fetch(`http://localhost:3000/api/incidents/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Status: 'Closed' })
});
```

> Setting `Status` to `"Closed"` or `"False Positive"` automatically populates `Closed_At` and calculates `TTR`. You do not need to send those fields.

---

## Assets — `/api/assets`

### Field reference

| Field | Type | Notes |
|---|---|---|
| `AssetID` | number | Auto-assigned, read-only |
| `Hostname` | string | Required on create |
| `IP_Address` | string | Required on create |
| `Source` | string | Required on create (e.g. `"Proxmox VM"`) |

### Routes

| Method | URL | Body |
|---|---|---|
| `GET` | `/api/assets` | — |
| `GET` | `/api/assets/:id` | — |
| `POST` | `/api/assets` | `{ Hostname, IP_Address, Source }` |
| `PUT` | `/api/assets/:id` | Any subset of fields |
| `DELETE` | `/api/assets/:id` | — |

```js
// Create
await fetch('http://localhost:3000/api/assets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Hostname: 'ws-finance-03', IP_Address: '10.0.2.50', Source: 'Domain DHCP' })
});

// Delete
await fetch(`http://localhost:3000/api/assets/${id}`, { method: 'DELETE' });
```

---

## Indicators of Compromise (IoCs) — `/api/iocs`

### Field reference

| Field | Type | Notes |
|---|---|---|
| `IOCID` | number | Auto-assigned, read-only |
| `Type` | string | Must be one of: `"IP"` `"Domain"` `"Hash"` `"URL"` `"Email"` |
| `Value` | string | Required on create |

### Routes

| Method | URL | Body |
|---|---|---|
| `GET` | `/api/iocs` | — |
| `GET` | `/api/iocs/:id` | — |
| `POST` | `/api/iocs` | `{ Type, Value }` |
| `PUT` | `/api/iocs/:id` | Any subset of fields |
| `DELETE` | `/api/iocs/:id` | — |

```js
// Create
await fetch('http://localhost:3000/api/iocs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Type: 'Domain', Value: 'malicious-c2.net' })
});
```

---

## Notes — `/api/incidents/:id/notes`

Notes are scoped to a parent incident. Deleting an incident automatically deletes its notes (cascade).

### Field reference

| Field | Type | Notes |
|---|---|---|
| `NoteID` | number | Auto-assigned, read-only |
| `Content` | string | Required on create |
| `Time` | ISO datetime | Auto-stamped on create |

### Routes

| Method | URL | Body |
|---|---|---|
| `GET` | `/api/incidents/:id/notes` | — |
| `POST` | `/api/incidents/:id/notes` | `{ Content }` |
| `DELETE` | `/api/incidents/:id/notes/:noteId` | — |

```js
// Add a note to incident 3
await fetch('http://localhost:3000/api/incidents/3/notes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Content: 'Analyst confirmed phishing link is now sinkholed.' })
});

// Fetch all notes for incident 3
const res   = await fetch('http://localhost:3000/api/incidents/3/notes');
const notes = await res.json();
```

---

## Reusable fetch helper (optional)

Drop this in your frontend JS to avoid repeating the base URL and headers:

```js
const API = 'http://localhost:3000/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Unknown error');
  return data;
}

// Usage examples
const incidents = await apiFetch('/incidents');
const newInc    = await apiFetch('/incidents', { method: 'POST', body: { Title: '...', Description: '...' } });
await apiFetch(`/incidents/${id}`, { method: 'PUT', body: { Status: 'Closed' } });
```

---

## Coming in Future Phases

These endpoints do not exist yet — do not try to call them:

- `GET /api/correlation/threats` — links incidents sharing the same IoC (Phase 5: Correlation Engine)
- Log ingestion script — Proxmox/pfSense syslog parser (Phase 4)
