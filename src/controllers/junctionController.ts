import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';

// ------------------------------------------------------------------ //
// Generic helpers
// ------------------------------------------------------------------ //

async function parentExists(table: string, pkCol: string, id: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM \`${table}\` WHERE \`${pkCol}\` = ? LIMIT 1`, [id]
  );
  return rows.length > 0;
}

// ------------------------------------------------------------------ //
// Incident_Asset_Affects
// POST   /api/incidents/:id/assets/:assetId
// DELETE /api/incidents/:id/assets/:assetId
// GET    /api/incidents/:id/assets
// ------------------------------------------------------------------ //

export async function linkAsset(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  const assetId    = Number(req.params['assetId']);
  if (isNaN(incidentId) || isNaN(assetId)) {
    res.status(400).json({ error: 'Incident ID and Asset ID must be numbers.' }); return;
  }
  try {
    if (!await parentExists('Incident', 'IncidentID', incidentId)) {
      res.status(404).json({ error: `Incident ${incidentId} not found.` }); return;
    }
    if (!await parentExists('Asset', 'AssetID', assetId)) {
      res.status(404).json({ error: `Asset ${assetId} not found.` }); return;
    }
    await pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO Incident_Asset_Affects (IncidentID, AssetID) VALUES (?, ?)`,
      [incidentId, assetId]
    );
    res.status(201).json({ message: `Asset ${assetId} linked to Incident ${incidentId}.` });
  } catch (err) {
    console.error('linkAsset:', err);
    res.status(500).json({ error: 'Failed to link asset.' });
  }
}

export async function unlinkAsset(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  const assetId    = Number(req.params['assetId']);
  if (isNaN(incidentId) || isNaN(assetId)) {
    res.status(400).json({ error: 'Incident ID and Asset ID must be numbers.' }); return;
  }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM Incident_Asset_Affects WHERE IncidentID = ? AND AssetID = ?`,
      [incidentId, assetId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: `Link between Incident ${incidentId} and Asset ${assetId} not found.` }); return;
    }
    res.status(200).json({ message: `Asset ${assetId} unlinked from Incident ${incidentId}.` });
  } catch (err) {
    console.error('unlinkAsset:', err);
    res.status(500).json({ error: 'Failed to unlink asset.' });
  }
}

export async function getIncidentAssets(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  if (isNaN(incidentId)) { res.status(400).json({ error: 'Incident ID must be a number.' }); return; }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.AssetID, a.Hostname, a.IP_Address, a.Source
       FROM Asset a
       JOIN Incident_Asset_Affects iaa ON a.AssetID = iaa.AssetID
       WHERE iaa.IncidentID = ?`,
      [incidentId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('getIncidentAssets:', err);
    res.status(500).json({ error: 'Failed to fetch assets for incident.' });
  }
}

// ------------------------------------------------------------------ //
// Incident_IOC_Contains
// POST   /api/incidents/:id/iocs/:iocId
// DELETE /api/incidents/:id/iocs/:iocId
// GET    /api/incidents/:id/iocs
// ------------------------------------------------------------------ //

export async function linkIOC(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  const iocId      = Number(req.params['iocId']);
  if (isNaN(incidentId) || isNaN(iocId)) {
    res.status(400).json({ error: 'Incident ID and IoC ID must be numbers.' }); return;
  }
  try {
    if (!await parentExists('Incident', 'IncidentID', incidentId)) {
      res.status(404).json({ error: `Incident ${incidentId} not found.` }); return;
    }
    if (!await parentExists('IndicatorOfCompromise', 'IOCID', iocId)) {
      res.status(404).json({ error: `IoC ${iocId} not found.` }); return;
    }
    await pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO Incident_IOC_Contains (IncidentID, IOCID) VALUES (?, ?)`,
      [incidentId, iocId]
    );
    res.status(201).json({ message: `IoC ${iocId} linked to Incident ${incidentId}.` });
  } catch (err) {
    console.error('linkIOC:', err);
    res.status(500).json({ error: 'Failed to link IoC.' });
  }
}

export async function unlinkIOC(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  const iocId      = Number(req.params['iocId']);
  if (isNaN(incidentId) || isNaN(iocId)) {
    res.status(400).json({ error: 'Incident ID and IoC ID must be numbers.' }); return;
  }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM Incident_IOC_Contains WHERE IncidentID = ? AND IOCID = ?`,
      [incidentId, iocId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: `Link between Incident ${incidentId} and IoC ${iocId} not found.` }); return;
    }
    res.status(200).json({ message: `IoC ${iocId} unlinked from Incident ${incidentId}.` });
  } catch (err) {
    console.error('unlinkIOC:', err);
    res.status(500).json({ error: 'Failed to unlink IoC.' });
  }
}

export async function getIncidentIOCs(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  if (isNaN(incidentId)) { res.status(400).json({ error: 'Incident ID must be a number.' }); return; }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ioc.IOCID, ioc.Type, ioc.Value
       FROM IndicatorOfCompromise ioc
       JOIN Incident_IOC_Contains iic ON ioc.IOCID = iic.IOCID
       WHERE iic.IncidentID = ?`,
      [incidentId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('getIncidentIOCs:', err);
    res.status(500).json({ error: 'Failed to fetch IoCs for incident.' });
  }
}

// ------------------------------------------------------------------ //
// Incident_Analyst_Assigned
// POST   /api/incidents/:id/analysts/:analystId
// DELETE /api/incidents/:id/analysts/:analystId
// GET    /api/incidents/:id/analysts
// ------------------------------------------------------------------ //

export async function assignAnalyst(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  const analystId  = Number(req.params['analystId']);
  if (isNaN(incidentId) || isNaN(analystId)) {
    res.status(400).json({ error: 'Incident ID and Analyst ID must be numbers.' }); return;
  }
  try {
    if (!await parentExists('Incident', 'IncidentID', incidentId)) {
      res.status(404).json({ error: `Incident ${incidentId} not found.` }); return;
    }
    if (!await parentExists('Analyst', 'AnalystID', analystId)) {
      res.status(404).json({ error: `Analyst ${analystId} not found.` }); return;
    }
    await pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO Incident_Analyst_Assigned (IncidentID, AnalystID) VALUES (?, ?)`,
      [incidentId, analystId]
    );
    res.status(201).json({ message: `Analyst ${analystId} assigned to Incident ${incidentId}.` });
  } catch (err) {
    console.error('assignAnalyst:', err);
    res.status(500).json({ error: 'Failed to assign analyst.' });
  }
}

export async function unassignAnalyst(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  const analystId  = Number(req.params['analystId']);
  if (isNaN(incidentId) || isNaN(analystId)) {
    res.status(400).json({ error: 'Incident ID and Analyst ID must be numbers.' }); return;
  }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM Incident_Analyst_Assigned WHERE IncidentID = ? AND AnalystID = ?`,
      [incidentId, analystId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: `Analyst ${analystId} is not assigned to Incident ${incidentId}.` }); return;
    }
    res.status(200).json({ message: `Analyst ${analystId} unassigned from Incident ${incidentId}.` });
  } catch (err) {
    console.error('unassignAnalyst:', err);
    res.status(500).json({ error: 'Failed to unassign analyst.' });
  }
}

export async function getIncidentAnalysts(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  if (isNaN(incidentId)) { res.status(400).json({ error: 'Incident ID must be a number.' }); return; }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.AnalystID, a.Name, a.Role, a.Email
       FROM Analyst a
       JOIN Incident_Analyst_Assigned iaa ON a.AnalystID = iaa.AnalystID
       WHERE iaa.IncidentID = ?`,
      [incidentId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('getIncidentAnalysts:', err);
    res.status(500).json({ error: 'Failed to fetch analysts for incident.' });
  }
}
