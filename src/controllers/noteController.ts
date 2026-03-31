import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';

interface Note extends RowDataPacket {
  IncidentID: number;
  NoteID:     number;
  Content:    string;
  Time:       Date;
}

// POST /api/incidents/:id/notes
export async function createNote(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  if (isNaN(incidentId)) { res.status(400).json({ error: 'Incident ID must be a number.' }); return; }

  const { Content } = req.body as Partial<Note>;
  if (!Content) { res.status(400).json({ error: 'Content is required.' }); return; }

  try {
    // Verify the parent incident exists before inserting the weak entity
    const [incident] = await pool.query<RowDataPacket[]>(
      `SELECT IncidentID FROM Incident WHERE IncidentID = ?`, [incidentId]
    );
    if (incident.length === 0) {
      res.status(404).json({ error: `Incident ${incidentId} not found.` });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO Note (IncidentID, Content) VALUES (?, ?)`,
      [incidentId, Content]
    );
    res.status(201).json({ message: 'Note added.', NoteID: result.insertId });
  } catch (err) {
    console.error('createNote:', err);
    res.status(500).json({ error: 'Failed to create note.' });
  }
}

// GET /api/incidents/:id/notes
export async function getNotesByIncident(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  if (isNaN(incidentId)) { res.status(400).json({ error: 'Incident ID must be a number.' }); return; }

  try {
    const [rows] = await pool.query<Note[]>(
      `SELECT NoteID, Content, Time FROM Note WHERE IncidentID = ? ORDER BY Time ASC`,
      [incidentId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('getNotesByIncident:', err);
    res.status(500).json({ error: 'Failed to fetch notes.' });
  }
}

// DELETE /api/incidents/:id/notes/:noteId
export async function deleteNote(req: Request, res: Response): Promise<void> {
  const incidentId = Number(req.params['id']);
  const noteId     = Number(req.params['noteId']);

  if (isNaN(incidentId) || isNaN(noteId)) {
    res.status(400).json({ error: 'Incident ID and Note ID must be numbers.' });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM Note WHERE IncidentID = ? AND NoteID = ?`,
      [incidentId, noteId]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: `Note ${noteId} on Incident ${incidentId} not found.` });
      return;
    }
    res.status(200).json({ message: `Note ${noteId} deleted.` });
  } catch (err) {
    console.error('deleteNote:', err);
    res.status(500).json({ error: 'Failed to delete note.' });
  }
}
