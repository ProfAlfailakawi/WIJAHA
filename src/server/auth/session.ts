import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { authSessions, memberships, orgs, users } from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { hashToken, type AuthActor, type OrgRole, type PlatformRole } from './rbac.ts';

export const SESSION_COOKIE_NAME = 'wijaha_session';

export interface AuthenticatedRequest extends Request {
  actor?: AuthActor | null;
}

export async function getOrCreateUserWithWorkspace(
  uid: string,
  email: string,
  displayName?: string,
): Promise<{ user: typeof users.$inferSelect; activeOrgId: string; orgRole: OrgRole }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const fallbackName = displayName?.trim() || cleanEmail.split('@')[0] || 'مستخدم وجاهة';

    const upserted = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        name: fallbackName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          updatedAt: new Date(),
        },
      })
      .returning();

    const userRecord = upserted[0];

    const existingMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userUid, userRecord.uid));

    if (existingMemberships.length > 0) {
      return {
        user: userRecord,
        activeOrgId: existingMemberships[0].orgId,
        orgRole: existingMemberships[0].role as OrgRole,
      };
    }

    const personalOrgId = `personal_${userRecord.uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await db
      .insert(orgs)
      .values({
        id: personalOrgId,
        name: `المساحة الشخصية — ${userRecord.name}`,
        nameEn: `Personal Workspace — ${userRecord.name}`,
        planId: 'free',
        isPersonal: true,
      })
      .onConflictDoNothing();

    await db.insert(memberships).values({
      userUid: userRecord.uid,
      orgId: personalOrgId,
      role: 'org_owner',
    });

    return {
      user: userRecord,
      activeOrgId: personalOrgId,
      orgRole: 'org_owner',
    };
  } catch (error) {
    console.error('getOrCreateUserWithWorkspace failed:', error);
    throw new Error('Authentication profile synchronization failed.', { cause: error });
  }
}

export async function createSessionCookie(
  res: Response,
  userUid: string,
  activeOrgId: string,
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const sessionId = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  await db.insert(authSessions).values({
    id: sessionId,
    userUid,
    activeOrgId,
    expiresAt,
  });

  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600 * 1000,
  });

  return rawToken;
}

export async function resolveActorFromRequest(req: Request): Promise<AuthActor | null> {
  try {
    // 1. Check Firebase Bearer token first if provided
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.slice(7).trim();
      if (idToken) {
        const decoded = await adminAuth.verifyIdToken(idToken);
        const synced = await getOrCreateUserWithWorkspace(
          decoded.uid,
          decoded.email || `${decoded.uid}@firebase.user`,
          decoded.name,
        );
        if (synced.user.deletedAt) return null;
        return {
          uid: synced.user.uid,
          email: synced.user.email,
          name: synced.user.name,
          platformRole: synced.user.platformRole as PlatformRole,
          activeOrgId: synced.activeOrgId,
          orgRole: synced.orgRole,
          expertSuggestionsEnabled: synced.user.expertSuggestionsEnabled,
          mfaVerified: synced.user.mfaVerified,
        };
      }
    }

    // 2. Check HttpOnly session cookie
    const rawCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
      SESSION_COOKIE_NAME
    ];
    if (!rawCookie) return null;

    const sessionId = hashToken(rawCookie);
    const sessionRows = await db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.id, sessionId), gt(authSessions.expiresAt, new Date())))
      .limit(1);

    if (sessionRows.length === 0) return null;
    const sess = sessionRows[0];

    const userRows = await db
      .select()
      .from(users)
      .where(and(eq(users.uid, sess.userUid), isNull(users.deletedAt)))
      .limit(1);
    if (userRows.length === 0) return null;
    const u = userRows[0];

    const memRows = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userUid, u.uid), eq(memberships.orgId, sess.activeOrgId)))
      .limit(1);

    const orgRole: OrgRole = (memRows[0]?.role as OrgRole) || 'member';

    return {
      uid: u.uid,
      email: u.email,
      name: u.name,
      platformRole: u.platformRole as PlatformRole,
      activeOrgId: sess.activeOrgId,
      orgRole,
      expertSuggestionsEnabled: u.expertSuggestionsEnabled,
      mfaVerified: u.mfaVerified,
    };
  } catch (error) {
    console.error('resolveActorFromRequest error:', error);
    return null;
  }
}

export async function attachActorMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.actor = await resolveActorFromRequest(req);
  next();
}

export function requireAuthenticated(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.actor) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message_key: 'auth.dialogTitle',
        ref: crypto.randomUUID().slice(0, 8),
      },
    });
    return;
  }
  next();
}
