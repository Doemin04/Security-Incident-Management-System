import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';

interface Asset extends RowDataPacket {
  AssetID:    number;
  Hostname:   string;
  IP_Address: string;
  Source:     string;
}

// POST /api/assets
export async function createAsset(req: Request, res: Response): Promise<void> {
  const { Hostname, IP_Address, Source } = req.body as Partial<Asset>;

  if (!Hostname || !IP_Address || !Source) {
    res.status(400).json({ error: 'Hostname, IP_Address, and Source are required.' });
    return;
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO Asset (Hostname, IP_Address, Source) VALUES (?, ?, ?)`,
      [Hostname, IP_Address, Source]
    );
    res.status(201).json({ message: 'Asset created.', AssetID: result.insertId });
  } catch (err) {
    console.error('createAsset:', err);
    res.status(500).json({ error: 'Failed to create asset.' });
  }
}

// GET /api/assets
export async function getAllAssets(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<Asset[]>(
      `SELECT AssetID, Hostname, IP_Address, Source FROM Asset ORDER BY AssetID ASC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('getAllAssets:', err);
    res.status(500).json({ error: 'Failed to fetch assets.' });
  }
}

// GET /api/assets/:id
export async function getAssetById(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'Asset ID must be a number.' }); return; }

  try {
    const [rows] = await pool.query<Asset[]>(
      `SELECT AssetID, Hostname, IP_Address, Source FROM Asset WHERE AssetID = ?`,
      [id]
    );
    if (rows.length === 0) { res.status(404).json({ error: `Asset ${id} not found.` }); return; }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('getAssetById:', err);
    res.status(500).json({ error: 'Failed to fetch asset.' });
  }
}

// PUT /api/assets/:id
export async function updateAsset(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'Asset ID must be a number.' }); return; }

  const { Hostname, IP_Address, Source } = req.body as Partial<Asset>;
  if (!Hostname && !IP_Address && !Source) {
    res.status(400).json({ error: 'Provide at least one field to update (Hostname, IP_Address, Source).' });
    return;
  }

  const fields: string[]  = [];
  const values: unknown[] = [];
  if (Hostname)   { fields.push('Hostname = ?');   values.push(Hostname); }
  if (IP_Address) { fields.push('IP_Address = ?'); values.push(IP_Address); }
  if (Source)     { fields.push('Source = ?');     values.push(Source); }
  values.push(id);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE Asset SET ${fields.join(', ')} WHERE AssetID = ?`,
      values
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: `Asset ${id} not found.` }); return; }
    res.status(200).json({ message: `Asset ${id} updated.` });
  } catch (err) {
    console.error('updateAsset:', err);
    res.status(500).json({ error: 'Failed to update asset.' });
  }
}

// DELETE /api/assets/:id
export async function deleteAsset(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ error: 'Asset ID must be a number.' }); return; }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM Asset WHERE AssetID = ?`, [id]
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: `Asset ${id} not found.` }); return; }
    res.status(200).json({ message: `Asset ${id} deleted.` });
  } catch (err) {
    console.error('deleteAsset:', err);
    res.status(500).json({ error: 'Failed to delete asset.' });
  }
}
