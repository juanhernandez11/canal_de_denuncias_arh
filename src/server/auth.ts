import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { AdminUser } from '../types/admin.ts';

const JWT_SECRET: string = process.env.JWT_SECRET || 'dev-secret-arh-change-me';
const TOKEN_TTL = '12h';

export const COOKIE_NAME = 'admin_token';

export interface TokenPayload {
  username: string;
}

export function signToken(user: AdminUser): string {
  const payload: TokenPayload = { username: user.username };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof (decoded as TokenPayload).username === 'string'
    ) {
      return { username: (decoded as TokenPayload).username };
    }
    return null;
  } catch {
    return null;
  }
}

// Extend Express Request with the authenticated user.
export interface AuthedRequest extends Request {
  admin?: AdminUser;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  const token = cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
    return;
  }
  req.admin = { username: payload.username };
  next();
}
