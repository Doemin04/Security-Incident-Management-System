import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import incidentRoutes from './routes/incidentRoutes';
import assetRoutes    from './routes/assetRoutes';
import iocRoutes      from './routes/iocRoutes';
import noteRoutes     from './routes/noteRoutes';
import analystRoutes  from './routes/analystRoutes';
import junctionRoutes from './routes/junctionRoutes';
import correlationRoutes from './routes/correlationRoutes';
import logImportRoutes from './routes/logImportRoutes';
import logRoutes from './routes/logRoutes';

dotenv.config();

const app  = express();
const PORT = process.env.PORT ?? 3000;

// --- CORS (least privilege) ---
// Only the origin declared in FRONTEND_ORIGIN is whitelisted.
// All other origins are rejected by the browser.
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN;

if (!ALLOWED_ORIGIN) {
  console.warn('[CORS] WARNING: FRONTEND_ORIGIN is not set in .env — all cross-origin requests will be blocked.');
}

app.use(cors({
  origin: ALLOWED_ORIGIN ?? false,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// --- Routes ---
app.use('/api/incidents',                    incidentRoutes);
app.use('/api/incidents/:id/notes',          noteRoutes);
app.use('/api/incidents/:id',                junctionRoutes);
app.use('/api/assets',                       assetRoutes);
app.use('/api/iocs',                         iocRoutes);
app.use('/api/analysts',                     analystRoutes);
app.use('/api/correlation',                  correlationRoutes);
app.use('/api/log-import',                    logImportRoutes);
app.use('/api',                              logRoutes);

// --- 404 fallback ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`SIMS API running on http://localhost:${PORT}`);
});
