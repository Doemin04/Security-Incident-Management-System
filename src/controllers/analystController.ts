import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';

interface Analyst extends RowDataPacket {
  AnalystID: number;
  Name:      string;
  Role:      string;
  Email:     string;
}

// POST /api/analysts
export async function createAnalyst(req: Request, res: Response): Promise<void> {
  const { Name, Role, Email } = req.body as Partial<Analyst>;
  if (!Name || !Role || !Email) {
    res.status(400).json({ error: 'Name, Role, and Email are required.' });
    return;
  }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO Analyst (Name, Role, Email) VALUES (?, ?, ?)`,
      [Name, Role, Email]
    );
    res.status(201).json({ message: 'Analyst created.', AnalystID: result.insertId });
  } catch (err) {
    console.error('createAnalyst:', err);
    res.status(500).json({ error: 'Failed to create analyst.' });
  }
}

// GET /api/analysts
export async function getAllAnalysts(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<Analyst[]>(
      `SELECT AnalystID, Name, Role, Email FROM Analyst ORDER BY AnalystID ASC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('getAllAnalysts:', err);
    res.status(500).json({ error: 'Failed to fetch analysts.' });
  }
}

// GET /api/analysts/:id
export async function getAnalystById(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'Analyst ID must be a number.' }); return; }
  try {
    const [rows] = await pool.query<Analyst[]>(
      `SELECT AnalystID, Name, Role, Email FROM Analyst WHERE AnalystID = ?`, [id]
    );
    if (rows.length === 0) { res.status(404).json({ error: `Analyst ${id} not found.` }); return; }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('getAnalystById:', err);
    res.status(500).json({ error: 'Failed to fetch analyst.' });
  }
}

// PUT /api/analysts/:id
export async function updateAnalyst(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'Analyst ID must be a number.' }); return; }

  const { Name, Role, Email } = req.body as Partial<Analyst>;
  if (!Name && !Role && !Email) {
    res.status(400).json({ error: 'Provide at least one field to update (Name, Role, Email).' });
    return;
  }

  const fields: string[]  = [];
  const values: unknown[] = [];
  if (Name)  { fields.push('Name = ?');  values.push(Name); }
  if (Role)  { fields.push('Role = ?');  values.push(Role); }
  if (Email) { fields.push('Email = ?'); values.push(Email); }
  values.push(id);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE Analyst SET ${fields.join(', ')} WHERE AnalystID = ?`, values
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: `Analyst ${id} not found.` }); return; }
    res.status(200).json({ message: `Analyst ${id} updated.` });
  } catch (err) {
    console.error('updateAnalyst:', err);
    res.status(500).json({ error: 'Failed to update analyst.' });
  }
}

// DELETE /api/analysts/:id
export async function deleteAnalyst(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'Analyst ID must be a number.' }); return; }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM Analyst WHERE AnalystID = ?`, [id]
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: `Analyst ${id} not found.` }); return; }
    res.status(200).json({ message: `Analyst ${id} deleted.` });
  } catch (err) {
    console.error('deleteAnalyst:', err);
    res.status(500).json({ error: 'Failed to delete analyst.' });
  }
}
