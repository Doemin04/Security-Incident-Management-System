import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

interface LogEventRow extends RowDataPacket {
  LogEventID: number;
  EventTime: string;
  SourceIP: string | null;
  DestinationIP: string | null;
  Message: string;
  RawLine: string;
  SourceSystem: string;
  SourceAssetID: number | null;
  DestinationAssetID: number | null;
  Ingested_At: string;
  RelatedIncidentID: number | null;
}

interface CreateIncidentRequest {
  Title: string;
  Description: string;
  Severity: 'Low' | 'Medium' | 'High' | 'Critical';
  extractedIPs: {
    sourceIPs: string[];
    destinationIPs: string[];
  };
}

/**
 * GET /logs
 * List all unrelated logs (not linked to any incident)
 */
router.get('/logs', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<LogEventRow[]>(
      `SELECT l.LogEventID, l.EventTime, l.SourceIP, l.DestinationIP, l.Message, 
              l.RawLine, l.SourceSystem, l.SourceAssetID, l.DestinationAssetID, l.Ingested_At
       FROM LogEvent l
       WHERE l.LogEventID NOT IN (
         SELECT DISTINCT LogEventID FROM Incident_LogEvent_Contains
       )
       ORDER BY l.EventTime DESC
       LIMIT 100`
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error('[logRoutes] Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
});

/**
 * GET /logs/:logEventID
 * Get a single log event
 */
router.get('/logs/:logEventID', async (req: Request, res: Response) => {
  const { logEventID } = req.params;

  try {
    const [rows] = await pool.query<LogEventRow[]>(
      `SELECT * FROM LogEvent WHERE LogEventID = ? LIMIT 1`,
      [logEventID]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Log event not found.' });
      return;
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('[logRoutes] Error fetching log:', error);
    res.status(500).json({ error: 'Failed to fetch log.' });
  }
});

/**
 * POST /logs/:logEventID/create-incident
 * Create an incident from a log event
 */
router.post('/logs/:logEventID/create-incident', async (req: Request, res: Response) => {
  const { logEventID } = req.params;
  const { Title, Description, Severity, extractedIPs } = req.body as CreateIncidentRequest;

  if (!Title || !Description || !Severity) {
    res.status(400).json({ error: 'Title, Description, and Severity are required.' });
    return;
  }

  const connection = await pool.getConnection();

  try {
    // Create the incident
    const [incidentResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO Incident (Title, Description, Status, Severity, Created_At)
       VALUES (?, ?, 'Open', ?, CURRENT_TIMESTAMP)`,
      [Title, Description, Severity]
    );

    const incidentID = incidentResult.insertId;

    // Link the log to the incident
    await connection.query(
      `INSERT INTO Incident_LogEvent_Contains (IncidentID, LogEventID)
       VALUES (?, ?)`,
      [incidentID, logEventID]
    );

    // Add extracted IPs as assets and link to incident
    if (extractedIPs) {
      const ips = new Set<string>();
      if (extractedIPs.sourceIPs) extractedIPs.sourceIPs.forEach((ip: string) => ips.add(ip));
      if (extractedIPs.destinationIPs) extractedIPs.destinationIPs.forEach((ip: string) => ips.add(ip));

      for (const ip of ips) {
        // Check if asset already exists
        const [existing] = await connection.query<any[]>(
          `SELECT AssetID FROM Asset WHERE IP_Address = ? LIMIT 1`,
          [ip]
        );

        let assetID: number;
        if (existing.length > 0) {
          assetID = existing[0].AssetID;
        } else {
          const [assetResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Asset (Hostname, IP_Address, Source)
             VALUES (?, ?, 'Log Import')`,
            [`unknown-${ip.replace(/\./g, '-')}`, ip]
          );
          assetID = assetResult.insertId;
        }

        // Link asset to incident
        await connection.query(
          `INSERT IGNORE INTO Incident_Asset_Affects (IncidentID, AssetID)
           VALUES (?, ?)`,
          [incidentID, assetID]
        );
      }
    }

    res.status(201).json({
      message: 'Incident created from log.',
      IncidentID: incidentID,
      LogEventID: logEventID,
    });
  } catch (error) {
    console.error('[logRoutes] Error creating incident from log:', error);
    res.status(500).json({ error: 'Failed to create incident from log.' });
  } finally {
    connection.release();
  }
});

/**
 * DELETE /logs/:logEventID
 * Delete a log event
 */
router.delete('/logs/:logEventID', async (req: Request, res: Response) => {
  const { logEventID } = req.params;

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM LogEvent WHERE LogEventID = ?`,
      [logEventID]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Log event not found.' });
      return;
    }

    res.status(200).json({ message: 'Log event deleted.' });
  } catch (error) {
    console.error('[logRoutes] Error deleting log:', error);
    res.status(500).json({ error: 'Failed to delete log.' });
  }
});

export default router;
