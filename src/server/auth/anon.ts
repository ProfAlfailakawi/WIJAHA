import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { can, type AuthActor } from './rbac.ts';

export const ANON_COOKIE_NAME = 'wijaha_anon';
const ANON_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

function signAnonId(anonId: string, secret: string): string {
  const mac = crypto.createHmac('sha256', secret).update(anonId, 'utf8').digest('hex');
  return `${anonId}.${mac}`;
}

export function verifySignedAnonToken(rawCookie: string | undefined, secret: string): string | null {
  if (!rawCookie || typeof rawCookie !== 'string') return null;
  const dotIdx = rawCookie.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const anonId = rawCookie.slice(0, dotIdx);
  const providedHex = rawCookie.slice(dotIdx + 1);
  if (!anonId.startsWith('anon_') || !/^[0-9a-fA-F]{64}$/.test(providedHex)) {
    return null;
  }
  const expectedHex = crypto.createHmac('sha256', secret).update(anonId, 'utf8').digest('hex');
  const a = Buffer.from(providedHex.toLowerCase(), 'hex');
  const b = Buffer.from(expectedHex.toLowerCase(), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  return anonId;
}

export function readVerifiedAnonId(req: Request, secret: string): string | null {
  const raw = req.cookies?.[ANON_COOKIE_NAME] as string | undefined;
  return verifySignedAnonToken(raw, secret);
}

export function resolveOrCreateAnonId(
  req: Request,
  res: Response,
  secret: string,
  isProduction: boolean,
): string {
  const existing = readVerifiedAnonId(req, secret);
  if (existing) return existing;

  const freshAnonId = `anon_${crypto.randomUUID()}`;
  const signed = signAnonId(freshAnonId, secret);
  res.cookie(ANON_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: ANON_MAX_AGE_MS,
    path: '/',
  });
  return freshAnonId;
}

export function canAccessResultRecord(
  actor: AuthActor | null,
  verifiedAnonId: string | null,
  row: {
    userUid: string | null;
    anonId?: string | null;
    orgId: string | null;
  },
  mode: 'read' | 'mutate',
): boolean {
  if (actor) {
    if (row.userUid && row.userUid === actor.uid) {
      if (!row.orgId || row.orgId === actor.activeOrgId) {
        return true;
      }
    }
    if (row.orgId) {
      if (mode === 'read' && can(actor, 'project:read', { orgId: row.orgId })) {
        return true;
      }
      if (mode === 'mutate' && can(actor, 'project:write', { orgId: row.orgId })) {
        return true;
      }
    }
  }

  // Anonymous result ownership via signed HttpOnly cookie (also permits post-signup save/export in same browser)
  if (!row.userUid && row.anonId && verifiedAnonId && row.anonId === verifiedAnonId) {
    return true;
  }

  return false;
}

export function canAccessSimulationRun(
  actor: AuthActor | null,
  verifiedAnonId: string | null,
  run: {
    userUid: string | null;
    anonId?: string | null;
  },
): boolean {
  if (run.userUid) {
    return Boolean(actor && actor.uid === run.userUid);
  }
  if (run.anonId && verifiedAnonId && run.anonId === verifiedAnonId) {
    return true;
  }
  return false;
}

