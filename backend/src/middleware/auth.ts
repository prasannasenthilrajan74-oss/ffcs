import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AdminTokenPayload {
  email: string;
  role: 'admin';
  iat: number;
  exp: number;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.adminToken;

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
