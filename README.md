# Security Incident Management System (SIMS)

## 📌 Project Overview
This project is a database-driven, Web-based Information System designed for a Security Operations Center (SOC). It serves as a centralized platform for security analysts to document, track, and manage cybersecurity incidents efficiently. 

Unlike heavy enterprise tools, this application features a streamlined workflow optimized for Home Lab environments, complete with a custom automated Threat Actor Correlation engine.

## 🛠️ Tech Stack
* **Database:** MySQL
* **Back-End:** Node.js with TypeScript & Express.js
* **Front-End:** HTML, CSS, JavaScript 

## ✨ Key Features
* **Incident Tracking:** Full CRUD operations for logging incidents, updating statuses, and managing resolution times.
* **Asset & Analyst Management:** Link compromised assets and assign specific SOC analysts to open cases.
* **Live Data Ingestion:** Backend scripts designed to parse and ingest live system/firewall logs.
* **Threat Actor Correlation (Advanced Function):** Automated backend logic that cross-references Indicators of Compromise (IoCs). If separate incidents share specific IoCs (e.g., the same malicious IP address), the engine automatically links them to expose broader threat campaigns.

## 🗄️ Relational Schema 
The underlying MySQL database enforces strict relational integrity with the following core entities:
* `Incident` (IncidentID [PK], Title, Description, Closed_At, Created_At, TTR, Status, Severity)
* `Asset` (AssetID [PK], Hostname, IP_Address, Source)
* `Analyst` (AnalystID [PK], Name, Role, Email)
* `IndicatorOfCompromise` (IOCID [PK], Type, Value)
* `Note` (IncidentID [PK/FK], NoteID [PK], Content, Time) 

*Junction tables (`Incident_Asset_Affects`, `Incident_IOC_Contains`, `Incident_Analyst_Assigned`) are utilized to manage many-to-many relationships without null anomalies.*

## 🚀 Setup & Installation
*(Instructions for the TA/Instructor to run the project locally)*

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Doemin04/Security-Incident-Management-System](https://github.com/Doemin04/Security-Incident-Management-System)