import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getUserProfileById } from '../server/factoryMemoryLogic.ts';
import type { UserProfile } from '../src/types/rose.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_SECRET;
}

export interface SignedSessionPayload {
  userId: string;
  companyId: string;
  iat: number;
  exp: number;
}

export function issueSessionToken(user: UserProfile, ttlMs = 8 * 60 * 60 * 1000): string {
  const payload: SignedSessionPayload = {
    userId: user.userId,
    companyId: user.companyId,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): UserProfile | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedSessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    const profile = getUserProfileById(parsed.userId);
    if (!profile || profile.companyId !== parsed.companyId) {
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const user = verifySessionToken(token);
  if (!user) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Valid Factory Memory OS session token required.',
    });
    return;
  }
  req.user = user;
  next();
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, RateBucket>();
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = req.user?.userId ?? req.ip ?? 'anonymous';
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || now > existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (existing.count >= maxRequests) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: `Too many requests. Please retry in ${retryAfterSec} seconds.`,
      });
      return;
    }
    existing.count += 1;
    next();
  };
}
