import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AdminTokenPayload {
  email: string;
  role: 'admin';
  iat: number;
  exp: number;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  let token = req.cookies?.adminToken;

  // Support Authorization: Bearer <token> (essential for cross-domain Vercel <-> Render)
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Support token query parameter (useful for window.open file/CSV downloads)
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as AdminTokenPayload;
    if (payload.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
