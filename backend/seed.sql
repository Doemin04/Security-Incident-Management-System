-- =============================================================
-- SIMS Seed Data  — 5 realistic incidents, assets, and IoCs
-- Run AFTER init-db.ts has created all tables.
-- Safe to re-run: uses INSERT IGNORE on junction rows.
-- =============================================================

-- -------------------------------------------------------------
-- Analysts
-- -------------------------------------------------------------
INSERT INTO Analyst (AnalystID, Name, Role, Email) VALUES
  (1, 'Jordan Blake',   'Senior SOC Analyst',  'j.blake@soc.internal'),
  (2, 'Morgan Ellis',   'Threat Hunter',        'm.ellis@soc.internal'),
  (3, 'Riley Chen',     'Incident Responder',   'r.chen@soc.internal')
ON DUPLICATE KEY UPDATE Name = VALUES(Name);

-- -------------------------------------------------------------
-- Incidents
-- -------------------------------------------------------------
INSERT INTO Incident (IncidentID, Title, Description, Status, Severity, Created_At, Closed_At, TTR) VALUES
  (1,
   'Brute-Force Attack on SSH Service',
   'Multiple failed SSH login attempts detected from an external IP targeting the production jump-box. Over 3,000 attempts in 10 minutes triggered threshold alert.',
   'Closed', 'High',
   '2025-03-01 02:14:00', '2025-03-01 03:44:00', 90),

  (2,
   'Suspected C2 Beacon – Cobalt Strike',
   'EDR flagged periodic outbound HTTPS beacons to a newly registered domain at 60-second intervals. Memory scan on endpoint revealed an injected shellcode stub consistent with Cobalt Strike.',
   'In Progress', 'Critical',
   '2025-03-10 11:30:00', NULL, NULL),

  (3,
   'Phishing Campaign – Credential Harvesting',
   'Three analysts received identical spear-phishing emails containing a malicious link redirecting to a cloned O365 login page. One user submitted credentials before the link was blocked.',
   'Open', 'High',
   '2025-03-15 08:45:00', NULL, NULL),

  (4,
   'Lateral Movement via Pass-the-Hash',
   'Windows Event Log correlation detected NTLM authentication from a workstation that was previously isolated. Attacker reused harvested hashes to pivot to a file server.',
   'In Progress', 'Critical',
   '2025-03-18 16:05:00', NULL, NULL),

  (5,
   'Anomalous DNS Queries – Possible DNS Tunnelling',
   'Firewall logs show a single endpoint generating unusually long TXT record queries to an external resolver not in the approved list. Traffic volume and entropy suggest data exfiltration via DNS.',
   'Open', 'Medium',
   '2025-03-20 09:22:00', NULL, NULL)
ON DUPLICATE KEY UPDATE Title = VALUES(Title);

-- -------------------------------------------------------------
-- Assets
-- -------------------------------------------------------------
INSERT INTO Asset (AssetID, Hostname, IP_Address, Source) VALUES
  (1, 'prod-jumpbox-01',   '10.0.1.5',   'Proxmox VM'),
  (2, 'workstation-fin-07','10.0.2.47',  'Domain Controller DHCP'),
  (3, 'fileserver-corp-02','10.0.3.12',  'Proxmox VM'),
  (4, 'analyst-ws-13',     '10.0.2.113', 'Domain Controller DHCP'),
  (5, 'fw-edge-01',        '203.0.113.1','Proxmox Firewall')
ON DUPLICATE KEY UPDATE Hostname = VALUES(Hostname);

-- -------------------------------------------------------------
-- Indicators of Compromise
-- -------------------------------------------------------------
INSERT INTO IndicatorOfCompromise (IOCID, Type, Value) VALUES
  (1, 'IP',     '185.220.101.47'),                         -- Tor exit node / brute-force source
  (2, 'Domain', 'update-service-cdn.com'),                 -- C2 beacon domain
  (3, 'URL',    'https://login.micros0ft-secure.com/auth'),-- Phishing page
  (4, 'Hash',   'd41d8cd98f00b204e9800998ecf8427e'),        -- Malicious payload MD5
  (5, 'Domain', 'txr.analytics-telemetry.net')             -- DNS tunnel resolver
ON DUPLICATE KEY UPDATE Value = VALUES(Value);

-- -------------------------------------------------------------
-- Notes
-- -------------------------------------------------------------
INSERT INTO Note (IncidentID, NoteID, Content, Time) VALUES
  (1, 1, 'Source IP geo-located to Netherlands. Added to firewall blocklist.', '2025-03-01 02:30:00'),
  (1, 2, 'Root cause: SSH port was briefly exposed to 0.0.0.0 after a misconfigured firewall rule. Rule corrected and incident closed.', '2025-03-01 03:44:00'),
  (2, 1, 'Memory dump collected from affected endpoint and sent to malware analysis queue.', '2025-03-10 12:00:00'),
  (3, 1, 'Compromised user credentials reset. MFA enforced on account. Awaiting email gateway report.', '2025-03-15 09:15:00'),
  (4, 1, 'Isolated workstation-fin-07 from the network. Investigating initial access vector.', '2025-03-18 16:45:00')
ON DUPLICATE KEY UPDATE Content = VALUES(Content);

-- -------------------------------------------------------------
-- Junction: Incident ↔ Asset
-- -------------------------------------------------------------
INSERT IGNORE INTO Incident_Asset_Affects (IncidentID, AssetID) VALUES
  (1, 1),  -- SSH brute-force → jump-box
  (2, 2),  -- C2 beacon       → workstation-fin-07
  (3, 4),  -- Phishing        → analyst-ws-13
  (4, 2),  -- Pass-the-hash   → workstation-fin-07 (pivot source)
  (4, 3),  -- Pass-the-hash   → fileserver-corp-02 (pivot target)
  (5, 5);  -- DNS tunnelling  → edge firewall

-- -------------------------------------------------------------
-- Junction: Incident ↔ IoC
-- -------------------------------------------------------------
INSERT IGNORE INTO Incident_IOC_Contains (IncidentID, IOCID) VALUES
  (1, 1),  -- SSH brute-force → Tor exit node IP
  (2, 2),  -- C2 beacon       → beacon domain
  (2, 4),  -- C2 beacon       → payload hash
  (3, 3),  -- Phishing        → phishing URL
  (4, 4),  -- Pass-the-hash   → same payload hash (shared IoC — correlation target)
  (5, 5);  -- DNS tunnelling  → tunnel resolver domain

-- -------------------------------------------------------------
-- Junction: Incident ↔ Analyst
-- -------------------------------------------------------------
INSERT IGNORE INTO Incident_Analyst_Assigned (IncidentID, AnalystID) VALUES
  (1, 1),  -- Blake handles SSH brute-force
  (2, 2),  -- Ellis handles C2 beacon
  (2, 3),  -- Chen co-assigned on C2 beacon
  (3, 1),  -- Blake handles phishing
  (4, 3),  -- Chen handles lateral movement
  (5, 2);  -- Ellis handles DNS tunnelling
