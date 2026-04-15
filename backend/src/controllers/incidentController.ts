import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';

// ------------------------------------------------------------------ //
// Types
// ------------------------------------------------------------------ //

interface Incident extends RowDataPacket {
  IncidentID:  number;
  Title:       string;
  Description: string;
  Status:      'Open' | 'In Progress' | 'Closed' | 'False Positive';
  Severity:    'Low' | 'Medium' | 'High' | 'Critical';
  Created_At:  Date;
  Closed_At:   Date | null;
  TTR:         number | null;
}

// ------------------------------------------------------------------ //
// POST /api/incidents
// ------------------------------------------------------------------ //
export async function createIncident(req: Request, res: Response): Promise<void> {
  const { Title, Description, Status, Severity } = req.body as Partial<Incident>;

  if (!Title || !Description) {
    res.status(400).json({ error: 'Title and Description are required.' });
    return;
  }

  const validStatuses   = ['Open', 'In Progress', 'Closed', 'False Positive'];
  const validSeverities = ['Low', 'Medium', 'High', 'Critical'];

  if (Status && !validStatuses.includes(Status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    return;
  }
  if (Severity && !validSeverities.includes(Severity)) {
    res.status(400).json({ error: `Severity must be one of: ${validSeverities.join(', ')}` });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO Incident (Title, Description, Status, Severity)
       VALUES (?, ?, ?, ?)`,
      [Title, Description, Status ?? 'Open', Severity ?? 'Medium']
    );

    res.status(201).json({
      message:    'Incident created.',
      IncidentID: result.insertId,
    });
  } catch (err) {
    console.error('createIncident:', err);
    res.status(500).json({ error: 'Failed to create incident.' });
  }
}

// ------------------------------------------------------------------ //
// GET /api/incidents
// ------------------------------------------------------------------ //
export async function getAllIncidents(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<Incident[]>(
      `SELECT IncidentID, Title, Description, Status, Severity, Created_At, Closed_At, TTR
       FROM Incident
       ORDER BY Created_At DESC`
    );

    res.status(200).json(rows);
  } catch (err) {
    console.error('getAllIncidents:', err);
    res.status(500).json({ error: 'Failed to fetch incidents.' });
  }
}

// ------------------------------------------------------------------ //
// GET /api/incidents/:id
// ------------------------------------------------------------------ //
export async function getIncidentById(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Incident ID must be a number.' });
    return;
  }

  try {
    const [rows] = await pool.query<Incident[]>(
      `SELECT IncidentID, Title, Description, Status, Severity, Created_At, Closed_At, TTR
       FROM Incident
       WHERE IncidentID = ?`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: `Incident ${id} not found.` });
      return;
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('getIncidentById:', err);
    res.status(500).json({ error: 'Failed to fetch incident.' });
  }
}

// ------------------------------------------------------------------ //
// PUT /api/incidents/:id
// ------------------------------------------------------------------ //
export async function updateIncidentStatus(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Incident ID must be a number.' });
    return;
  }

  const { Status, Severity, Title, Description } = req.body as Partial<Incident>;

  if (!Status && !Severity && !Title && !Description) {
    res.status(400).json({ error: 'Provide at least one field to update (Status, Severity, Title, Description).' });
    return;
  }

  const validStatuses   = ['Open', 'In Progress', 'Closed', 'False Positive'];
  const validSeverities = ['Low', 'Medium', 'High', 'Critical'];

  if (Status && !validStatuses.includes(Status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    return;
  }
  if (Severity && !validSeverities.includes(Severity)) {
    res.status(400).json({ error: `Severity must be one of: ${validSeverities.join(', ')}` });
    return;
  }

  // Build SET clause dynamically from only the fields sent
  const fields: string[]  = [];
  const values: unknown[] = [];

  if (Title)       { fields.push('Title = ?');       values.push(Title); }
  if (Description) { fields.push('Description = ?'); values.push(Description); }
  if (Severity)    { fields.push('Severity = ?');    values.push(Severity); }
  if (Status) {
    fields.push('Status = ?');
    values.push(Status);
    if (Status === 'Closed' || Status === 'False Positive') {
      // Stamp close time and calculate resolution time
      fields.push('Closed_At = NOW()');
      fields.push('TTR = TIMESTAMPDIFF(MINUTE, Created_At, NOW())');
    } else {
      // Re-opening: clear both fields so they don't show stale data
      fields.push('Closed_At = NULL');
      fields.push('TTR = NULL');
    }
  }

  values.push(id);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE Incident SET ${fields.join(', ')} WHERE IncidentID = ?`,
      values
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: `Incident ${id} not found.` });
      return;
    }

    res.status(200).json({ message: `Incident ${id} updated.` });
  } catch (err) {
    console.error('updateIncidentStatus:', err);
    res.status(500).json({ error: 'Failed to update incident.' });
  }
}

// ------------------------------------------------------------------ //
// DELETE /api/incidents/:id
// ------------------------------------------------------------------ //
export async function deleteIncident(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Incident ID must be a number.' });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM Incident WHERE IncidentID = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: `Incident ${id} not found.` });
      return;
    }

    res.status(200).json({ message: `Incident ${id} deleted.` });
  } catch (err) {
    console.error('deleteIncident:', err);
    res.status(500).json({ error: 'Failed to delete incident.' });
  }
}
