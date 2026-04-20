import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { optionalAuth } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// API routes
app.use('/auth', authRouter);
app.use('/sessions', optionalAuth, sessionsRouter);

// Static files — PWA frontend (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback: non-API routes serve index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/auth') || req.path.startsWith('/sessions')) {
    return res.status(404).json({ error: 'not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[server error]', err.message);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`Neuroflow listening on port ${PORT}`);
});
