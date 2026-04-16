# Security Incident Management System Frontend

## Overview
This is the frontend for the Security Incident Management System project. It uses HTML, CSS, and JavaScript, and it communicates with the backend only through API endpoints.

## Files
- `index.html` - page structure
- `styles.css` - styling
- `app.js` - startup and event wiring
- `api.js` - shared API helpers and state
- `render.js` - rendering helpers
- `actions.js` - incident actions and handlers
- `scripts/seed_mitre_attack.js` - API-based seed script

## Features
- load and filter incidents
- create incidents
- update status and severity
- view incident details
- add and delete notes
- view linked assets, IOCs, and analysts
- link and unlink assets, IOCs, and analysts
- show timestamps in local time

## Notes
- The frontend uses API endpoints only
- The seed script does not connect directly to MySQL
- Main backend route expected: `http://localhost:3000/api`
