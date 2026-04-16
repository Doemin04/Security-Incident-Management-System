import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import pool from './config/db';

interface CliOptions {
  count: number;
  dryRun: boolean;
}

interface AnalystSeed {
  Email: string;
  Name: string;
  Role: string;
}

interface AssetSeed {
  Hostname: string;
  IP_Address: string;
  Source: string;
}

interface IocSeed {
  Type: 'IP' | 'Domain' | 'Hash' | 'URL' | 'Email';
  Value: string;
}

interface NoteSeed {
  Content: string;
  Time: string;
}

interface IncidentSeed {
  Analyst: AnalystSeed;
  Assets: AssetSeed[];
  Closed_At: string | null;
  Created_At: string;
  Description: string;
  IOCs: IocSeed[];
  Notes: NoteSeed[];
  Severity: 'Low' | 'Medium' | 'High' | 'Critical';
  Status: 'Open' | 'In Progress' | 'Closed' | 'False Positive';
  Title: string;
  TTR: number | null;
}

interface IdRow extends RowDataPacket {
  id: number;
}

const MITRE_PAIRS: Array<[string, string, 'Low' | 'Medium' | 'High' | 'Critical']> = [
  ['Initial Access', 'Phishing', 'High'],
  ['Execution', 'Command and Scripting Interpreter', 'High'],
  ['Persistence', 'Valid Accounts', 'Medium'],
  ['Privilege Escalation', 'Exploitation for Privilege Escalation', 'Critical'],
  ['Defense Evasion', 'Obfuscated Files or Information', 'Medium'],
  ['Credential Access', 'Brute Force', 'High'],
  ['Discovery', 'Network Service Scanning', 'Low'],
  ['Lateral Movement', 'Remote Services', 'High'],
  ['Collection', 'Data from Local System', 'Medium'],
  ['Exfiltration', 'Exfiltration Over Web Service', 'Critical'],
];

const AREAS = ['homepage', 'login page', 'checkout page', 'customer dashboard', 'search API', 'payment webhook', 'admin portal', 'product catalog'];
const TRAFFIC_PROFILES = ['normal browsing traffic', 'checkout rush traffic', 'scheduled admin traffic', 'partner API traffic', 'marketing campaign traffic'];
const LABELS = ['True Positive', 'False Positive', 'False Negative', 'True Negative'];
const WORDS = ['secure', 'billing', 'auth', 'verify', 'promo', 'account'];
const ENDINGS = ['.com', '.net', '.org', '.co'];
const OPEN_STATUSES: Array<'Open' | 'In Progress'> = ['Open', 'In Progress'];

const SHARED_IOCS: IocSeed[] = [
  { Type: 'IP', Value: '185.22.81.14' },
  { Type: 'Domain', Value: 'malicious-login.example.com' },
  { Type: 'Hash', Value: 'e3b0c44298fc1c149afbf4c8996fb924' },
];

const ANALYSTS: AnalystSeed[] = [
  { Name: 'Farhan Tanvir', Role: 'SOC Analyst', Email: 'farhant@sims.com' },
  { Name: 'Fahiyeen Nasser', Role: 'Incident Responder', Email: 'fahiyeenn@sims.com' },
  { Name: 'Minh Nguyen', Role: 'Threat Analyst', Email: 'minhn@sims.com' },
  { Name: 'Ava Patel', Role: 'SOC Analyst', Email: 'avap@sims.com' },
  { Name: 'Jordan Lee', Role: 'Threat Analyst', Email: 'jordanl@sims.com' },
];

function parseArgs(argv: string[]): CliOptions {
  let count = 25;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--count':
        count = Number(argv[index + 1]);
        index += 1;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--help':
        console.log(`Usage:
  npx ts-node src/seedMitreAttack.ts --count 25
  npx ts-node src/seedMitreAttack.ts --count 5 --dry-run`);
        process.exit(0);
        break;
      default:
        if (token.startsWith('--')) {
          throw new Error(`Unknown option: ${token}`);
        }
        count = Number(token);
        break;
    }
  }

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Count must be a positive integer.');
  }

  return { count, dryRun };
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[rand(0, items.length - 1)];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function makeIp(): string {
  return `${rand(23, 212)}.${rand(1, 255)}.${rand(1, 255)}.${rand(1, 254)}`;
}

function makeHash(): string {
  const alphabet = 'abcdef0123456789';
  return Array.from({ length: 32 }, () => pick(alphabet.split(''))).join('');
}

function makeDomain(): string {
  return `${pick(WORDS)}-${pick(WORDS)}-${rand(10, 999)}${pick(ENDINGS)}`;
}

function makeAssets(index: number): AssetSeed[] {
  return Array.from({ length: rand(1, 3) }, (_, assetIndex) => ({
    Hostname: `mitre-web-${rand(1, 8)}-${index + 1}-${assetIndex + 1}`,
    IP_Address: makeIp(),
    Source: 'MITRE seed',
  }));
}

function makeIocs(index: number): IocSeed[] {
  const iocs: IocSeed[] = [];

  if (index % 3 === 0) iocs.push(SHARED_IOCS[0]);
  if (index % 5 === 0) iocs.push(SHARED_IOCS[1]);
  if (index % 7 === 0) iocs.push(SHARED_IOCS[2]);

  const randomCount = rand(0, 2);
  for (let i = 0; i < randomCount; i += 1) {
    iocs.push(pick([
      { Type: 'IP', Value: makeIp() },
      { Type: 'Hash', Value: makeHash() },
      { Type: 'Domain', Value: makeDomain() },
      { Type: 'URL', Value: `http://${makeDomain()}/login` },
      { Type: 'Email', Value: `alert+${rand(1, 999)}@${makeDomain()}` },
    ]));
  }

  const unique = Array.from(
    new Map(iocs.map((item) => [`${item.Type}:${item.Value}`, item])).values()
  );

  if (unique.length === 0) {
    unique.push({ Type: 'IP', Value: makeIp() });
  }

  return unique.slice(0, Math.min(unique.length, 3));
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
}

function makeIncident(index: number): IncidentSeed {
  const [tactic, technique, severity] = pick(MITRE_PAIRS);
  const label = LABELS[index % LABELS.length];
  const area = pick(AREAS);
  const trafficProfile = pick(TRAFFIC_PROFILES);
  const analyst = pick(ANALYSTS);

  const created = new Date();
  created.setDate(created.getDate() - rand(0, 45));
  created.setHours(rand(0, 23), rand(0, 59), rand(0, 59), 0);

  const isClosed = Math.random() > 0.45;
  const closed = new Date(created);
  closed.setHours(closed.getHours() + rand(2, 96));

  const status: IncidentSeed['Status'] = isClosed
    ? label === 'False Positive'
      ? 'False Positive'
      : 'Closed'
    : pick(OPEN_STATUSES);

  const description =
    `${label}. MITRE tactic "${tactic}" with technique "${technique}" was observed on the ${area} during ${trafficProfile}. ` +
    'This record is seeded for correlation and analytics testing against the existing SIMS schema.';

  const createdAt = formatDateTime(created);

  return {
    Analyst: analyst,
    Assets: makeAssets(index),
    Closed_At: isClosed ? formatDateTime(closed) : null,
    Created_At: createdAt,
    Description: description,
    IOCs: makeIocs(index),
    Notes: [
      {
        Content: `Triage note: ${analyst.Name} reviewed ${tactic}/${technique} activity and classified it as ${label}.`,
        Time: createdAt,
      },
      {
        Content: `Context note: Event observed on ${area} during ${trafficProfile}.`,
        Time: createdAt,
      },
    ].slice(0, rand(1, 2)),
    Severity: severity,
    Status: status,
    Title: `${technique} observed on ${area}`,
    TTR: isClosed ? minutesBetween(created, closed) : null,
  };
}

async function findOrCreateId(
  connection: PoolConnection,
  selectSql: string,
  selectParams: unknown[],
  insertSql: string,
  insertParams: unknown[]
): Promise<number> {
  const [rows] = await connection.query<IdRow[]>(selectSql, selectParams);

  if (rows.length > 0) {
    return rows[0].id;
  }

  const [insertResult] = await connection.query<ResultSetHeader>(insertSql, insertParams);
  return insertResult.insertId;
}

async function seedIncident(connection: PoolConnection, incident: IncidentSeed): Promise<number> {
  await connection.beginTransaction();

  try {
    const analystId = await findOrCreateId(
      connection,
      `SELECT AnalystID AS id
       FROM Analyst
       WHERE Email = ?
       ORDER BY AnalystID ASC
       LIMIT 1`,
      [incident.Analyst.Email],
      `INSERT INTO Analyst (Name, Role, Email)
       VALUES (?, ?, ?)`,
      [incident.Analyst.Name, incident.Analyst.Role, incident.Analyst.Email]
    );

    const [incidentResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO Incident (Title, Description, Created_At, Closed_At, TTR, Status, Severity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        incident.Title,
        incident.Description,
        incident.Created_At,
        incident.Closed_At,
        incident.TTR,
        incident.Status,
        incident.Severity,
      ]
    );

    await connection.query(
      `INSERT IGNORE INTO Incident_Analyst_Assigned (IncidentID, AnalystID)
       VALUES (?, ?)`,
      [incidentResult.insertId, analystId]
    );

    for (const asset of incident.Assets) {
      const assetId = await findOrCreateId(
        connection,
        `SELECT AssetID AS id
         FROM Asset
         WHERE IP_Address = ?
         ORDER BY AssetID ASC
         LIMIT 1`,
        [asset.IP_Address],
        `INSERT INTO Asset (Hostname, IP_Address, Source)
         VALUES (?, ?, ?)`,
        [asset.Hostname, asset.IP_Address, asset.Source]
      );

      await connection.query(
        `INSERT IGNORE INTO Incident_Asset_Affects (IncidentID, AssetID)
         VALUES (?, ?)`,
        [incidentResult.insertId, assetId]
      );
    }

    for (const ioc of incident.IOCs) {
      const iocId = await findOrCreateId(
        connection,
        `SELECT IOCID AS id
         FROM IndicatorOfCompromise
         WHERE Type = ? AND Value = ?
         ORDER BY IOCID ASC
         LIMIT 1`,
        [ioc.Type, ioc.Value],
        `INSERT INTO IndicatorOfCompromise (Type, Value)
         VALUES (?, ?)`,
        [ioc.Type, ioc.Value]
      );

      await connection.query(
        `INSERT IGNORE INTO Incident_IOC_Contains (IncidentID, IOCID)
         VALUES (?, ?)`,
        [incidentResult.insertId, iocId]
      );
    }

    for (const note of incident.Notes) {
      await connection.query(
        `INSERT INTO Note (IncidentID, Content, Time)
         VALUES (?, ?, ?)`,
        [incidentResult.insertId, note.Content, note.Time]
      );
    }

    await connection.commit();
    return incidentResult.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const generated = Array.from({ length: options.count }, (_, index) => makeIncident(index));

  if (options.dryRun) {
    console.log(JSON.stringify(generated, null, 2));
    await pool.end();
    return;
  }

  const connection = await pool.getConnection();
  let inserted = 0;

  try {
    for (const incident of generated) {
      try {
        await seedIncident(connection, incident);
        inserted += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[seedMitreAttack] Failed to seed "${incident.Title}": ${message}`);
      }
    }
  } finally {
    connection.release();
    await pool.end();
  }

  console.log(`[seedMitreAttack] Inserted ${inserted}/${generated.length} incident bundles.`);
}

main().catch((error) => {
  console.error(`[seedMitreAttack] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
