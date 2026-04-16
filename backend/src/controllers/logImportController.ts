import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import pool from '../config/db';

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

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
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
    [makePlaceholderHostname(ipAddress), ipAddress, `${sourceSystem} log import`]
  );

  assetCache.set(ipAddress, insertResult.insertId);
  return insertResult.insertId;
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

    await connection.query<ResultSetHeader>(
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

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export async function importLogs(req: Request, res: Response): Promise<void> {
  const { logText, sourceSystem, limit } = req.body as {
    logText?: string;
    sourceSystem?: string;
    limit?: number;
  };

  if (!logText || typeof logText !== 'string' || !logText.trim()) {
    res.status(400).json({ error: 'Provide logText in the request body.' });
    return;
  }

  const lines = logText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsedLimit = typeof limit === 'number' ? limit : undefined;
  const maxLines = typeof parsedLimit === 'number' && Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : lines.length;
  const sourceLabel = typeof sourceSystem === 'string' && sourceSystem.trim() ? sourceSystem.trim() : 'Frontend Import';

  const parsedLines = lines.slice(0, maxLines).map((rawLine) => parseLogLine(rawLine, sourceLabel));
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
        continue;
      }

      try {
        await ingestParsedLine(connection, assetCache, parsed);
        ingested += 1;
      } catch (error) {
        failed += 1;
        console.error('[logImport] Failed to ingest line', index + 1, error);
      }
    }
  } finally {
    connection.release();
  }

  res.status(200).json({
    message: 'Log import completed.',
    totalLines: lines.length,
    ingested,
    skipped,
    failed,
  });
}
