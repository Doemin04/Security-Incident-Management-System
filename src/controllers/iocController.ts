import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';

interface IOC extends RowDataPacket {
  IOCID: number;
  Type:  'IP' | 'Domain' | 'Hash' | 'URL' | 'Email';
  Value: string;
}

const VALID_TYPES = ['IP', 'Domain', 'Hash', 'URL', 'Email'];

// POST /api/iocs
export async function createIOC(req: Request, res: Response): Promise<void> {
  const { Type, Value } = req.body as Partial<IOC>;

  if (!Type || !Value) {
    res.status(400).json({ error: 'Type and Value are required.' });
    return;
  }
  if (!VALID_TYPES.includes(Type)) {
    res.status(400).json({ error: `Type must be one of: ${VALID_TYPES.join(', ')}` });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO IndicatorOfCompromise (Type, Value) VALUES (?, ?)`,
      [Type, Value]
    );
    res.status(201).json({ message: 'IoC created.', IOCID: result.insertId });
  } catch (err) {
    console.error('createIOC:', err);
    res.status(500).json({ error: 'Failed to create IoC.' });
  }
}

// GET /api/iocs
export async function getAllIOCs(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<IOC[]>(
      `SELECT IOCID, Type, Value FROM IndicatorOfCompromise ORDER BY IOCID ASC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('getAllIOCs:', err);
    res.status(500).json({ error: 'Failed to fetch IoCs.' });
  }
}

// GET /api/iocs/:id
export async function getIOCById(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'IoC ID must be a number.' }); return; }

  try {
    const [rows] = await pool.query<IOC[]>(
      `SELECT IOCID, Type, Value FROM IndicatorOfCompromise WHERE IOCID = ?`,
      [id]
    );
    if (rows.length === 0) { res.status(404).json({ error: `IoC ${id} not found.` }); return; }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('getIOCById:', err);
    res.status(500).json({ error: 'Failed to fetch IoC.' });
  }
}

// PUT /api/iocs/:id
export async function updateIOC(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'IoC ID must be a number.' }); return; }

  const { Type, Value } = req.body as Partial<IOC>;
  if (!Type && !Value) {
    res.status(400).json({ error: 'Provide at least one field to update (Type, Value).' });
    return;
  }
  if (Type && !VALID_TYPES.includes(Type)) {
    res.status(400).json({ error: `Type must be one of: ${VALID_TYPES.join(', ')}` });
    return;
  }

  const fields: string[]  = [];
  const values: unknown[] = [];
  if (Type)  { fields.push('Type = ?');  values.push(Type); }
  if (Value) { fields.push('Value = ?'); values.push(Value); }
  values.push(id);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE IndicatorOfCompromise SET ${fields.join(', ')} WHERE IOCID = ?`,
      values
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: `IoC ${id} not found.` }); return; }
    res.status(200).json({ message: `IoC ${id} updated.` });
  } catch (err) {
    console.error('updateIOC:', err);
    res.status(500).json({ error: 'Failed to update IoC.' });
  }
}

// DELETE /api/iocs/:id
export async function deleteIOC(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'IoC ID must be a number.' }); return; }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM IndicatorOfCompromise WHERE IOCID = ?`, [id]
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: `IoC ${id} not found.` }); return; }
    res.status(200).json({ message: `IoC ${id} deleted.` });
  } catch (err) {
    console.error('deleteIOC:', err);
    res.status(500).json({ error: 'Failed to delete IoC.' });
  }
}
