import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type AuthenticatedRequest = Request & { userId: string };
type AuthMode = 'dev' | 'jwt';

const authMode = (process.env.AUTH_MODE || 'dev') as AuthMode;
const jwtAudience = process.env.AUTH_AUDIENCE;
const jwtIssuer = process.env.AUTH_ISSUER;
const jwtSecret = process.env.AUTH_JWT_SECRET;
const jwksUri = process.env.AUTH_JWKS_URI;

export function getUserId(req: Request) {
  return (req as Request & { userId?: string }).userId || 'dev-user';
}

export function getAuthSummary() {
  return {
    mode: authMode,
    hasJwtAudience: Boolean(jwtAudience),
    hasJwtIssuer: Boolean(jwtIssuer),
    hasJwtSecret: Boolean(jwtSecret),
    hasJwksUri: Boolean(jwksUri),
  };
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  if (authMode === 'dev') {
    const userId = req.header('x-user-id') || 'dev-user';
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    (req as AuthenticatedRequest).userId = userId;
    next();
    return;
  }

  try {
    const authorization = req.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }

    const key = jwksUri
      ? createRemoteJWKSet(new URL(jwksUri))
      : new TextEncoder().encode(jwtSecret || '');

    const verification = await jwtVerify(token, key as never, {
      audience: jwtAudience,
      issuer: jwtIssuer,
    });

    const userId = typeof verification.payload.sub === 'string' ? verification.payload.sub : null;
    if (!userId) {
      res.status(401).json({ error: 'Token missing subject' });
      return;
    }

    (req as AuthenticatedRequest).userId = userId;
    next();
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Unauthorized' });
  }
}
