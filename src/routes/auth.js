import { Router } from 'express';
import bcrypt from 'bcrypt';
import { signToken, verifyToken } from '../middleware/auth.js';
import { STMT } from '../db.js';

const router = Router();
const SALT_ROUNDS = 12;

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const existing = STMT.getUserByEmail.get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'email already registered' });

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    STMT.createUser.run(id, email.toLowerCase().trim(), passwordHash, displayName || null);
  } catch {
    return res.status(500).json({ error: 'could not create user' });
  }

  const token = signToken({ sub: id, email, plan: 'free' });
  res.status(201).json({ token, user: { id, email, plan: 'free', displayName } });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = STMT.getUserByEmail.get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  if (!user.password_hash) return res.status(401).json({ error: 'this account uses a different sign-in method' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'invalid credentials' });

  const token = signToken({ sub: user.id, email: user.email, plan: user.plan });
  res.json({ token, user: { id: user.id, email: user.email, plan: user.plan, displayName: user.display_name } });
});

// GET /auth/me
router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no token' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'invalid token' });

  const user = STMT.getUserById.get(decoded.sub);
  if (!user) return res.status(404).json({ error: 'user not found' });

  res.json({ id: user.id, email: user.email, plan: user.plan, displayName: user.display_name });
});

export default router;
