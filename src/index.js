import express from 'express';
import cors from 'cors';
import { optionalAuth } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Restrict in prod
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// Mount routes — sessions router uses optionalAuth to detect anon vs auth
app.use('/auth', authRouter);
app.use('/sessions', optionalAuth, sessionsRouter);

// 404
app.use((_, res) => res.status(404).json({ error: 'not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('[server error]', err.message);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`Neuroflow API listening on port ${PORT}`);
});
