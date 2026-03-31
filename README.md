# Security Incident Management System (SIMS)

## Project Overview

This project is a database-driven, web-based Information System designed for a Security Operations Center (SOC). It serves as a centralized platform for security analysts to document, track, and manage cybersecurity incidents efficiently.

Unlike heavy enterprise tools, this application features a streamlined workflow optimized for home lab environments, complete with a custom automated Threat Actor Correlation engine.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | MySQL 8.0 |
| Back-end | Node.js + TypeScript + Express.js |
| Front-end | HTML, CSS, JavaScript *(separate developer)* |
| DB Driver | `mysql2/promise` |
| Runtime tooling | `ts-node`, `nodemon` |

---

## Key Features

- **Incident Tracking** — Full CRUD operations for logging incidents, updating statuses, and recording resolution times (TTR).
- **Asset & Analyst Management** — Link compromised assets and assign SOC analysts to open cases via relational junction tables.
- **IoC Registry** — Store and query Indicators of Compromise (IPs, domains, hashes, URLs, emails) independently of any specific incident.
- **Live Log Ingestion** — Backend script parses and ingests live system/firewall logs from a Proxmox home lab directly into the database.
- **Threat Actor Correlation Engine** — Automated backend logic that cross-references IoCs across incidents. If separate incidents share the same IoC (e.g. a malicious IP or payload hash), the engine automatically links them to expose broader threat campaigns.

---

## Relational Schema

```
Incident        (IncidentID [PK], Title, Description, Status, Severity, Created_At, Closed_At, TTR)
Asset           (AssetID [PK], Hostname, IP_Address, Source)
Analyst         (AnalystID [PK], Name, Role, Email)
IndicatorOfCompromise (IOCID [PK], Type, Value)
Note            (IncidentID [PK/FK], NoteID [PK], Content, Time)   ← weak entity

Junction tables (many-to-many):
  Incident_Asset_Affects    (IncidentID [FK], AssetID [FK])
  Incident_IOC_Contains     (IncidentID [FK], IOCID [FK])
  Incident_Analyst_Assigned (IncidentID [FK], AnalystID [FK])
```

Key constraints:
- `Note` is a weak entity — it cascades on `Incident` delete.
- Analysts and IoCs may exist independently of any incident.
- All junction tables use composite primary keys and enforce referential integrity with `ON DELETE CASCADE`.

---

## Project Structure

```
.
├── src/
│   ├── config/
│   │   └── db.ts              # mysql2 connection pool
│   ├── controllers/           # Request handlers (CRUD logic)
│   ├── routes/                # Express route definitions
│   ├── init-db.ts             # DDL script — creates all tables
│   └── index.ts               # App entry point
├── seed.sql                   # Realistic dummy data (5 incidents, assets, IoCs)
├── .env                       # Environment variables (not committed)
├── .env.example               # Template for environment variables
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [MySQL Server 8.0](https://dev.mysql.com/downloads/mysql/)
- npm (included with Node.js)
- A MySQL user with `CREATE DATABASE` and full table privileges

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/Doemin04/Security-Incident-Management-System.git
cd Security-Incident-Management-System
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your MySQL credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=security_incident_management_system
```

### 4. Start MySQL

**Windows (Services):**
```
Win + R → services.msc → start "MySQL80"
```

**Windows (terminal, run as Administrator):**
```bash
net start MySQL80
```

**macOS / Linux:**
```bash
sudo systemctl start mysql
```

### 5. Initialise the database

This script creates the database (if it does not exist) and builds all 8 tables with foreign key constraints:

```bash
npm run init-db
```

Expected output:

```
[OK] Database 'security_incident_management_system' ready.
  [OK] Incident
  [OK] Asset
  [OK] Analyst
  [OK] IndicatorOfCompromise
  [OK] Note
  [OK] Incident_Asset_Affects
  [OK] Incident_IOC_Contains
  [OK] Incident_Analyst_Assigned

Database initialised successfully.
```

### 6. Load seed data *(optional but recommended for testing)*

```bash
# Windows — adjust path if your MySQL bin is elsewhere
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p security_incident_management_system < seed.sql

# macOS / Linux
mysql -u root -p security_incident_management_system < seed.sql
```

This inserts 5 realistic incidents, 5 assets, 5 IoCs, 3 analysts, 5 notes, and all junction records.

### 7. Start the development server

```bash
npm run dev
```

The API will be available at `http://localhost:3000` (or the port set in your `.env`).

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `ts-node src/index.ts` | Start the server with ts-node |
| `npm run init-db` | `ts-node src/init-db.ts` | Create database and all tables |

---

## API Endpoints

> Base URL: `http://localhost:3000/api`

### Incidents

| Method | Endpoint | Description |
|---|---|---|
| GET | `/incidents` | List all incidents |
| GET | `/incidents/:id` | Get a single incident |
| POST | `/incidents` | Create a new incident |
| PUT | `/incidents/:id` | Update an incident |
| DELETE | `/incidents/:id` | Delete an incident |

### Assets

| Method | Endpoint | Description |
|---|---|---|
| GET | `/assets` | List all assets |
| GET | `/assets/:id` | Get a single asset |
| POST | `/assets` | Create a new asset |
| PUT | `/assets/:id` | Update an asset |
| DELETE | `/assets/:id` | Delete an asset |

### Indicators of Compromise

| Method | Endpoint | Description |
|---|---|---|
| GET | `/iocs` | List all IoCs |
| GET | `/iocs/:id` | Get a single IoC |
| POST | `/iocs` | Create a new IoC |
| PUT | `/iocs/:id` | Update an IoC |
| DELETE | `/iocs/:id` | Delete an IoC |

---

## Development Notes

- `init-db.ts` is safe to re-run — all `CREATE TABLE` statements use `IF NOT EXISTS`.
- `seed.sql` uses `ON DUPLICATE KEY UPDATE` and `INSERT IGNORE` so it can also be re-run without errors.
- Incidents 2 and 4 in the seed data intentionally share IoC `#4` (a payload hash) to serve as a test case for the Correlation Engine.
- The `Note` table uses a composite primary key `(IncidentID, NoteID)` with an additional index on `NoteID` to satisfy MySQL's `AUTO_INCREMENT` key requirement.
