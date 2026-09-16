import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db';
import { Department } from './models/Department';
import { syncFFCSRoster } from './services/ffcsRoster';
import applicationsRouter from './routes/applications';
import departmentsRouter from './routes/departments';
import adminRouter from './routes/admin';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

// ── Body / cookie parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/applications', applicationsRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/admin', adminRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(async () => {
  try {
    // Migrate legacy "Projects" department name to "Artistic" if present
    await Department.collection.updateOne(
      { name: 'Projects' },
      { $set: { name: 'Artistic' } }
    );
    await syncFFCSRoster();
  } catch (err) {
    console.error('[Startup] Failed to sync FFCS roster / migrate:', err);
  }

  app.listen(PORT, () => {
    console.log(`VITSION backend running on port ${PORT}`);
  });
});

export default app;
