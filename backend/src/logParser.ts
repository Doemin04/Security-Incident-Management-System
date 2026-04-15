import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import pool from './config/db';

interface CliOptions {
  dryRun: boolean;
  filePath?: string;
  host?: string;
  isSsh: boolean;
  limit?: number;
  port?: number;
  remotePath?: string;
  sourceSystem?: string;
  user?: string;
}

interface ParsedLogLine {
  destinationIp: string | null;
  eventTime: Date;
  message: string;
  rawLine: string;
  sourceIp: string | null;
  sourceSystem: string;
}

interface AssetRow extends RowDataPacket {
  AssetID: number;
}

const RFC3164_PATTERN =
  /^(?<timestamp>[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(?<host>\S+)\s+(?<program>[^:]+):\s*(?<message>.+)$/;

const ISO_PATTERN =
  /^(?:<\d+>\d\s+)?(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(?<host>\S+)\s+(?<program>[^:]+):\s*(?<message>.+)$/;

const IPV4_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

function printUsage(): void {
  console.log(`Usage:
  npx ts-node src/logParser.ts test-pfsense.log
  npx ts-node src/logParser.ts --file test-pfsense.log --source-system pfSense
  npx ts-node src/logParser.ts --ssh --host 10.0.0.5 --user admin --remote-path /var/log/filter.log --source-system pfSense

Options:
  --file <path>           Read a local syslog file
  --ssh                   Read a remote log file over SSH using the system ssh client
  --host <hostname>       SSH host or IP
  --user <username>       SSH username
  --port <port>           SSH port (default: 22)
  --remote-path <path>    Remote log file path to read with cat
  --source-system <name>  Source tag stored on LogEvent rows, e.g. pfSense or Proxmox
  --limit <count>         Process only the first N non-empty lines
  --dry-run               Parse and preview without writing to MySQL
  --help                  Show this help text`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, isSsh: false };
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--file':
        options.filePath = argv[index + 1];
        index += 1;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      case '--host':
        options.host = argv[index + 1];
        index += 1;
        break;
      case '--limit':
        options.limit = Number(argv[index + 1]);
        index += 1;
        break;
      case '--port':
        options.port = Number(argv[index + 1]);
        index += 1;
        break;
      case '--remote-path':
        options.remotePath = argv[index + 1];
        index += 1;
        break;
      case '--source-system':
        options.sourceSystem = argv[index + 1];
        index += 1;
        break;
      case '--ssh':
        options.isSsh = true;
        break;
      case '--user':
        options.user = argv[index + 1];
        index += 1;
        break;
      default:
        if (token.startsWith('--')) {
          throw new Error(`Unknown option: ${token}`);
        }
        positionals.push(token);
        break;
    }
  }

  if (!options.filePath && positionals.length > 0) {
    options.filePath = positionals[0];
  }

  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    throw new Error('--limit must be a positive integer.');
  }

  if (options.port !== undefined && (!Number.isInteger(options.port) || options.port <= 0)) {
    throw new Error('--port must be a positive integer.');
  }

  if (options.isSsh) {
    if (!options.host || !options.remotePath) {
      throw new Error('SSH mode requires --host and --remote-path.');
    }
  } else if (!options.filePath) {
    throw new Error('Provide a local log file path or use --ssh.');
  }

  return options;
}

function inferSourceSystem(options: CliOptions): string {
  if (options.sourceSystem) {
    return options.sourceSystem;
  }

  const haystack = `${options.filePath ?? ''} ${options.remotePath ?? ''}`.toLowerCase();

  if (haystack.includes('pfsense')) {
    return 'pfSense';
  }
  if (haystack.includes('proxmox')) {
    return 'Proxmox';
  }

  return options.isSsh ? 'Remote Syslog' : 'Local Syslog';
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function readLinesFromFile(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, 'utf8');
  return content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}

async function readLinesOverSsh(options: CliOptions): Promise<string[]> {
  const sshArgs: string[] = [];
  const target = options.user ? `${options.user}@${options.host}` : String(options.host);

  if (options.port) {
    sshArgs.push('-p', String(options.port));
  }

  sshArgs.push(target, `cat ${shellQuote(String(options.remotePath))}`);

  return await new Promise<string[]>((resolve, reject) => {
    const child = spawn('ssh', sshArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start ssh: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `ssh exited with code ${code}`));
        return;
      }

      resolve(stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0));
    });
  });
}

function parseRfc3164Timestamp(timestampText: string): Date | null {
  const match =
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(timestampText);

  if (!match) {
    return null;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentDate = new Date();
  const year = currentDate.getFullYear();

  const parsed = new Date(
    year,
    monthNames.indexOf(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );

  if (parsed.getTime() > currentDate.getTime() + 24 * 60 * 60 * 1000) {
    parsed.setFullYear(year - 1);
  }

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimestamp(timestampText: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}T/.test(timestampText)) {
    const parsed = new Date(timestampText);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return parseRfc3164Timestamp(timestampText);
}

function extractIps(message: string): { destinationIp: string | null; sourceIp: string | null } {
  const kvMatch =
    /\bSRC=(?<source>\d{1,3}(?:\.\d{1,3}){3}).*?\bDST=(?<destination>\d{1,3}(?:\.\d{1,3}){3})\b/i.exec(message);

  if (kvMatch?.groups) {
    return {
      sourceIp: kvMatch.groups['source'] ?? null,
      destinationIp: kvMatch.groups['destination'] ?? null,
    };
  }

  const directionalMatch =
    /\bfrom\s+(?<source>\d{1,3}(?:\.\d{1,3}){3})\s+to\s+(?<destination>\d{1,3}(?:\.\d{1,3}){3})\b/i.exec(message);

  if (directionalMatch?.groups) {
    return {
      sourceIp: directionalMatch.groups['source'] ?? null,
      destinationIp: directionalMatch.groups['destination'] ?? null,
    };
  }

  const ipMatches = message.match(IPV4_PATTERN) ?? [];

  return {
    sourceIp: ipMatches[0] ?? null,
    destinationIp: ipMatches[1] ?? null,
  };
}

function parseLogLine(rawLine: string, sourceSystem: string): ParsedLogLine | null {
  const match = RFC3164_PATTERN.exec(rawLine) ?? ISO_PATTERN.exec(rawLine);

  if (!match?.groups) {
    return null;
  }

  const timestampText = match.groups['timestamp'];
  const message = match.groups['message']?.trim();

  if (!timestampText || !message) {
    return null;
  }

  const eventTime = parseTimestamp(timestampText);

  if (!eventTime) {
    return null;
  }

  const { destinationIp, sourceIp } = extractIps(message);

  return {
    destinationIp,
    eventTime,
    message,
    rawLine,
    sourceIp,
    sourceSystem,
  };
}

function makePlaceholderHostname(ipAddress: string): string {
  return `unknown-${ipAddress.replace(/\./g, '-')}`;
}

async function ensureAsset(
  connection: PoolConnection,
  assetCache: Map<string, number>,
  ipAddress: string,
  sourceSystem: string
): Promise<number> {
  const cachedId = assetCache.get(ipAddress);

  if (cachedId) {
    return cachedId;
  }

  const [rows] = await connection.query<AssetRow[]>(
    `SELECT AssetID
     FROM Asset
     WHERE IP_Address = ?
     ORDER BY AssetID ASC
     LIMIT 1`,
    [ipAddress]
  );

  if (rows.length > 0) {
    assetCache.set(ipAddress, rows[0].AssetID);
    return rows[0].AssetID;
  }

  const [insertResult] = await connection.query<ResultSetHeader>(
    `INSERT INTO Asset (Hostname, IP_Address, Source)
     VALUES (?, ?, ?)`,
    [makePlaceholderHostname(ipAddress), ipAddress, `${sourceSystem} log ingestion`]
  );

  assetCache.set(ipAddress, insertResult.insertId);
  return insertResult.insertId;
}

function makeIncidentTitle(parsed: ParsedLogLine): string {
  const source = parsed.sourceIp ?? 'unknown-source';
  const destination = parsed.destinationIp ?? 'unknown-destination';
  return `${parsed.sourceSystem} log ${source} -> ${destination}`;
}

function makeIncidentDescription(parsed: ParsedLogLine): string {
  return [
    `Source system: ${parsed.sourceSystem}`,
    `Event time: ${formatDateTime(parsed.eventTime)}`,
    `Source IP: ${parsed.sourceIp ?? 'Unknown'}`,
    `Destination IP: ${parsed.destinationIp ?? 'Unknown'}`,
    `Message: ${parsed.message}`,
    `Raw line: ${parsed.rawLine}`,
  ].join('\n');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

async function ingestParsedLine(
  connection: PoolConnection,
  assetCache: Map<string, number>,
  parsed: ParsedLogLine
): Promise<void> {
  await connection.beginTransaction();

  try {
    const sourceAssetId = parsed.sourceIp
      ? await ensureAsset(connection, assetCache, parsed.sourceIp, parsed.sourceSystem)
      : null;
    const destinationAssetId = parsed.destinationIp
      ? await ensureAsset(connection, assetCache, parsed.destinationIp, parsed.sourceSystem)
      : null;

    const [logEventResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO LogEvent (
         EventTime,
         SourceIP,
         DestinationIP,
         Message,
         RawLine,
         SourceSystem,
         SourceAssetID,
         DestinationAssetID
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formatDateTime(parsed.eventTime),
        parsed.sourceIp,
        parsed.destinationIp,
        parsed.message,
        parsed.rawLine,
        parsed.sourceSystem,
        sourceAssetId,
        destinationAssetId,
      ]
    );

    const [incidentResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO Incident (Title, Description, Status, Severity)
       VALUES (?, ?, 'Open', 'Medium')`,
      [makeIncidentTitle(parsed), makeIncidentDescription(parsed)]
    );

    if (sourceAssetId) {
      await connection.query(
        `INSERT IGNORE INTO Incident_Asset_Affects (IncidentID, AssetID)
         VALUES (?, ?)`,
        [incidentResult.insertId, sourceAssetId]
      );
    }

    if (destinationAssetId && destinationAssetId !== sourceAssetId) {
      await connection.query(
        `INSERT IGNORE INTO Incident_Asset_Affects (IncidentID, AssetID)
         VALUES (?, ?)`,
        [incidentResult.insertId, destinationAssetId]
      );
    }

    await connection.query(
      `INSERT INTO Incident_LogEvent_Contains (IncidentID, LogEventID)
       VALUES (?, ?)`,
      [incidentResult.insertId, logEventResult.insertId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function loadInputLines(options: CliOptions): Promise<string[]> {
  if (options.isSsh) {
    return await readLinesOverSsh(options);
  }

  return await readLinesFromFile(String(options.filePath));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const sourceSystem = inferSourceSystem(options);
  const rawLines = await loadInputLines(options);
  const lines = options.limit ? rawLines.slice(0, options.limit) : rawLines;

  console.log(`[logParser] Loaded ${lines.length} non-empty log lines from ${options.isSsh ? 'SSH' : 'file'} input.`);

  const parsedLines = lines.map((line) => parseLogLine(line, sourceSystem));
  const connection = await pool.getConnection();
  const assetCache = new Map<string, number>();

  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let index = 0; index < parsedLines.length; index += 1) {
      const parsed = parsedLines[index];

      if (!parsed) {
        skipped += 1;
        console.warn(`[logParser] Skipped line ${index + 1}: unable to parse timestamp/message.`);
        continue;
      }

      if (options.dryRun) {
        console.log(
          `[dry-run] ${formatDateTime(parsed.eventTime)} | ${parsed.sourceIp ?? 'Unknown'} -> ${
            parsed.destinationIp ?? 'Unknown'
          } | ${parsed.message}`
        );
        ingested += 1;
        continue;
      }

      try {
        await ingestParsedLine(connection, assetCache, parsed);
        ingested += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[logParser] Failed to ingest line ${index + 1}: ${message}`);
      }
    }
  } finally {
    connection.release();
    await pool.end();
  }

  console.log(`[logParser] Completed. Ingested: ${ingested}, Skipped: ${skipped}, Failed: ${failed}.`);
}

main().catch((error) => {
  console.error(`[logParser] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
