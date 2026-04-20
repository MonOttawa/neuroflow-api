import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function signToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Middleware: requires valid JWT
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no token' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'invalid token' });

  req.userId = decoded.userId || decoded.sub;
  req.userPlan = decoded.plan || 'free';
  next();
}

// Middleware: optional auth — sets req.userId if valid token present
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.userId   = decoded.userId || decoded.sub;
      req.userPlan = decoded.plan || 'free';
    }
  }
  next();
}
