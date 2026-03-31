import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import incidentRoutes from './routes/incidentRoutes';
import assetRoutes    from './routes/assetRoutes';
import iocRoutes      from './routes/iocRoutes';
import noteRoutes     from './routes/noteRoutes';

dotenv.config();

const app  = express();
const PORT = process.env.PORT ?? 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api/incidents',           incidentRoutes);
app.use('/api/incidents/:id/notes', noteRoutes);
app.use('/api/assets',              assetRoutes);
app.use('/api/iocs',                iocRoutes);

// --- 404 fallback ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`SIMS API running on http://localhost:${PORT}`);
});
