import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import db, { STMT } from '../db.js';

const router = Router();
const FREE_DAILY_LIMIT = 3;

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// POST /sessions
router.post('/', (req, res) => {
  const { frequency, duration, color, deviceId } = req.body || {};

  if (!frequency || !duration || !color) {
    return res.status(400).json({ error: 'frequency, duration, and color are required' });
  }
  if (![6, 10, 20, 40].includes(Number(frequency))) {
    return res.status(400).json({ error: 'frequency must be 6, 10, 20, or 40' });
  }

  const sessionId = crypto.randomUUID();

  if (req.userId) {
    // Authenticated user — always allowed (plan enforcement can be added later)
    try {
      // sessionId is for the client response; DB generates its own id
      STMT.createSession.run(req.userId, frequency, duration, color);
    } catch(err) {
      console.error('[sessions] createSession error:', err.message);
      return res.status(500).json({ error: 'db error', detail: err.message });
    }
    return res.status(201).json({ id: sessionId });
  }

  // Anonymous user — enforce daily free limit
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId required for anonymous sessions' });
  }

  // Ensure anon row exists
  db.prepare('INSERT OR IGNORE INTO anon_users (device_id) VALUES (?)').run(deviceId);

  const anon = STMT.getAnon.get(deviceId);
  const today = todayStr();
  const usedToday = anon.last_session_date === today ? anon.daily_sessions_used : 0;

  if (usedToday >= FREE_DAILY_LIMIT) {
    return res.status(429).json({
      error: 'daily free limit reached',
      limit: FREE_DAILY_LIMIT,
    });
  }

  STMT.createSession.run(`anon:${deviceId}`, frequency, duration, color);

  // Increment or reset daily counter
  if (anon.last_session_date === today) {
    db.prepare('UPDATE anon_users SET daily_sessions_used = daily_sessions_used + 1 WHERE device_id = ?').run(deviceId);
  } else {
    db.prepare('UPDATE anon_users SET daily_sessions_used = 1, last_session_date = ? WHERE device_id = ?').run(today, deviceId);
  }

  return res.status(201).json({ id: sessionId, anonymous: true });
});

// GET /sessions  — authenticated only
router.get('/', (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'authentication required' });
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const sessions = STMT.getUserSessions.all(req.userId, limit);
  return res.json({ sessions });
});

// GET /sessions/stats  — authenticated only
router.get('/stats', (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'authentication required' });
  const uid = req.userId;

  // Total sessions + total minutes
  const total = STMT.getSessionCount.get(uid)?.count || 0;
  const totalMinutesRow = db.prepare(
    'SELECT COALESCE(SUM(duration),0) as mins FROM sessions WHERE user_id = ?'
  ).get(uid);
  const totalMinutes = totalMinutesRow.mins;

  // Today
  const today = todayStr();
  const todayStart = Math.floor(new Date(today + 'T00:00:00').getTime() / 1000);
  const todayRow = db.prepare(
    'SELECT COUNT(*) as count, COALESCE(SUM(duration),0) as mins FROM sessions WHERE user_id = ? AND started_at >= ?'
  ).get(uid, todayStart);
  const todaySessions = todayRow.count;
  const todayMinutes = todayRow.mins;

  // Streak: count consecutive days with at least 1 session, starting from today
  const dayRows = db.prepare(
    "SELECT DISTINCT substr(date(started_at, 'unixepoch'), 1, 10) as day FROM sessions WHERE user_id = ? ORDER BY day DESC"
  ).all(uid);
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < dayRows.length; i++) {
    const expected = new Date(now);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (dayRows[i].day === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  // Frequency breakdown
  const freqRows = db.prepare(
    'SELECT frequency, COUNT(*) as count, COALESCE(SUM(duration),0) as mins FROM sessions WHERE user_id = ? GROUP BY frequency ORDER BY count DESC'
  ).all(uid);

  // Weekly activity: last 12 weeks (84 days), sessions per day
  const twelveWeeksAgo = Math.floor(Date.now() / 1000) - 84 * 86400;
  const dailyRows = db.prepare(
    "SELECT substr(date(started_at, 'unixepoch'), 1, 10) as day, COUNT(*) as count FROM sessions WHERE user_id = ? AND started_at >= ? GROUP BY day ORDER BY day"
  ).all(uid, twelveWeeksAgo);

  // Recent sessions (last 10)
  const recent = db.prepare(
    'SELECT frequency, duration, color, started_at, completed_at, aborted FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 10'
  ).all(uid);

  // Longest session ever
  const longestRow = db.prepare(
    'SELECT MAX(duration) as longest FROM sessions WHERE user_id = ?'
  ).get(uid);

  return res.json({
    total,
    totalMinutes,
    todaySessions,
    todayMinutes,
    streak,
    longestSession: longestRow.longest || 0,
    frequencyBreakdown: freqRows,
    weeklyActivity: dailyRows,
    recentSessions: recent,
  });
});

export default router;
