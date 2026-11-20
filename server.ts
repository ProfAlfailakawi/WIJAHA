import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import { previewCookieBridge } from './src/server/preview-cookie-bridge.ts';
import * as dotenv from 'dotenv';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import {
  analyticsEvents,
  auditLogs,
  authSessions,
  billingCheckoutSessions,
  competencyScores,
  evalCases,
  evalRuns,
  expertSuggestionEvents,
  experts,
  exportsLog,
  feedback,
  invitations,
  invoices,
  knowledgeRules,
  knowledgeRuleVersions,
  magicAttempts,
  magicLinks,
  memberships,
  orgs,
  plans,
  projects,
  projectVersions,
  queries,
  results,
  revenueLedger,
  revenueSplitRules,
  scenarios,
  serviceRequests,
  services,
  shares,
  simulationRuns,
  simulationSteps,
  sources,
  subscriptions,
  users,
} from './src/db/schema.ts';
import {
  analyzeIntentAndContextPure,
  applyNaturalProjectUpdatePure,
  auditVisitPlanPure,
  executeWijahaPipeline,
} from './src/server/ai/pipeline.ts';
import { getAiProviderStatus } from './src/server/ai/provider.ts';
import { understandQuery } from './src/server/ai/understanding.ts';
import {
  canAccessResultRecord,
  canAccessSimulationRun,
  readVerifiedAnonId,
  resolveOrCreateAnonId,
} from './src/server/auth/anon.ts';
import {
  can,
  decryptField,
  encryptField,
  hashIp,
  hashToken,
  resolveExpertOwnerTag,
} from './src/server/auth/rbac.ts';
import {
  buildOtpAuthUri,
  generateTotpSecret,
  verifyTotpCode,
} from './src/server/auth/totp.ts';
import { loadAndValidateEnv } from './src/server/config/env.ts';
import { createEmailProvider } from './src/server/email/provider.ts';
import {
  canTransitionRuleStatus,
  RuleStatusSchema,
} from './src/server/knowledge/lifecycle.ts';
import { checkSharedRateLimit } from './src/server/security/rate-limit.ts';
import {
  applySecurityHeadersMiddleware,
  injectNonceIntoHtml,
} from './src/server/security/headers.ts';
import {
  attachActorMiddleware,
  createSessionCookie,
  getOrCreateUserWithWorkspace,
  requireAuthenticated,
  SESSION_COOKIE_NAME,
  type AuthenticatedRequest,
} from './src/server/auth/session.ts';
import {
  getMonthlyUsage,
  getOrgEntitlements,
  nextMonthResetLabel,
  processBillingWebhook,
  refundMonthlyQuota,
  reserveMonthlyQuota,
} from './src/server/billing/entitlements.ts';
import { createBillingProvider } from './src/server/billing/provider.ts';
import {
  generateProjectDocx,
  generateProjectPdfOrHtml,
} from './src/server/export/exporter.ts';
import {
  detectSimilarRules,
  retrieveHybridRules,
  embedAndStoreRule,
  scoreRulesPure,
} from './src/server/knowledge/retrieval.ts';
import {
  buildSimulationReportPure,
  evaluateFreeTextStepPure,
} from './src/server/simulation/engine.ts';
import { computeDeterministicEmbedding, normalizeArabic } from './src/shared/arabic.ts';
import {
  CheckPlanInputSchema,
  ProjectCreateInputSchema,
  ProjectNaturalUpdateSchema,
  ProjectPatchInputSchema,
  QueryInputSchema,
  ServiceRequestInputSchema,
  type CompetencyCode,
  type Locale,
  type ScenarioNode,
  type ScenarioRubric,
  type SimulationReport,
  type WijahaResult,
} from './src/shared/types.ts';

dotenv.config();

const PORT = 3000;

function sendApiError(res: Response, status: number, code: string, messageKey: string, extra?: Record<string, unknown>) {
  res.status(status).json({
    error: {
      code,
      message_key: messageKey,
      ref: crypto.randomUUID().slice(0, 8),
      ...extra,
    },
  });
}

async function logAudit(
  actorUid: string,
  action: string,
  targetType: string,
  targetId: string,
  orgId?: string | null,
  req?: Request,
  meta: Record<string, unknown> = {},
) {
  try {
    await db.insert(auditLogs).values({
      actorUid,
      action,
      targetType,
      targetId,
      orgId: orgId ?? null,
      ipHash: hashIp(req?.ip),
      meta,
    });
  } catch (err) {
    console.warn('Audit log write warning:', err);
  }
}

async function logAnalytics(
  eventName: string,
  locale: string,
  orgId?: string | null,
  durationMs?: number,
  meta: Record<string, unknown> = {},
) {
  try {
    await db.insert(analyticsEvents).values({
      eventName,
      locale,
      orgId: orgId ?? null,
      durationMs,
      meta,
    });
  } catch {
    // Non-blocking telemetry
  }
}

export async function buildExpressApp() {
  const appEnv = loadAndValidateEnv();
  const emailProvider = createEmailProvider(appEnv);
  const billingProvider = createBillingProvider(appEnv);
  const app = express();
  // Public previews can hide the admin/reviewer demo accounts (DEMO_ALLOW_PRIVILEGED=false).
  const demoPrivilegedEnabled = process.env.DEMO_ALLOW_PRIVILEGED !== 'false';
  const PRIVILEGED_DEMO_EMAILS = ['admin@wijaha.demo', 'yousef@wijaha.demo'];
  app.set('trust proxy', 1);
  if (process.env.COOKIE_BRIDGE === 'true') {
    app.use(previewCookieBridge());
  }

  // Signed Billing Webhook MUST read raw bytes BEFORE express.json() (A3)
  app.post(
    '/api/billing/webhook',
    express.raw({ type: 'application/json', limit: '512kb' }),
    async (req: Request, res: Response) => {
      try {
        const rawBody = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(typeof req.body === 'string' ? req.body : '', 'utf8');

        if (rawBody.length === 0 || !billingProvider.verifyWebhook(rawBody, req.headers)) {
          sendApiError(res, 400, 'INVALID_WEBHOOK_SIGNATURE', 'errors.badRequest');
          return;
        }

        const verified = billingProvider.parseEvent(rawBody);
        if (verified.eventType === 'ignored') {
          res.json({ ok: true, ignored: true });
          return;
        }

        const conditions = [];
        if (verified.checkoutSessionId) {
          conditions.push(eq(billingCheckoutSessions.id, verified.checkoutSessionId));
        }
        if (verified.providerSessionId) {
          conditions.push(eq(billingCheckoutSessions.providerSessionId, verified.providerSessionId));
        }
        if (conditions.length === 0) {
          sendApiError(res, 400, 'MISSING_CHECKOUT_REFERENCE', 'errors.badRequest');
          return;
        }

        const sessionRows = await db
          .select()
          .from(billingCheckoutSessions)
          .where(conditions.length === 1 ? conditions[0] : or(...conditions))
          .limit(1);

        if (sessionRows.length === 0) {
          sendApiError(res, 400, 'UNKNOWN_CHECKOUT_SESSION', 'errors.badRequest');
          return;
        }

        const checkoutRow = sessionRows[0];
        const out = await processBillingWebhook({
          eventId: verified.eventId,
          provider: billingProvider.name,
          eventType:
            checkoutRow.kind === 'service' ? 'service.paid' : 'subscription.activated',
          orgId: checkoutRow.orgId,
          userUid: checkoutRow.userUid,
          targetId: checkoutRow.targetId,
          billingCycle: checkoutRow.billingCycle === 'annual' ? 'annual' : 'monthly',
          amountKwd: checkoutRow.amountKwd,
          serviceRequestId: checkoutRow.serviceRequestId,
          serviceOwner: (checkoutRow.serviceOwner as 'yousef' | 'ahmad' | 'joint' | null) ?? undefined,
          checkoutSessionId: checkoutRow.id,
        });

        await logAudit(
          checkoutRow.userUid,
          'billing.webhook_processed',
          checkoutRow.kind,
          checkoutRow.targetId,
          checkoutRow.orgId,
          req,
        );

        res.json(out);
      } catch (error) {
        console.error('POST /api/billing/webhook failed:', error);
        sendApiError(res, 400, 'WEBHOOK_INVALID', 'errors.badRequest');
      }
    },
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Security Headers & strict CSP with per-request nonce (Section 21.6 / C10)
  app.use(applySecurityHeadersMiddleware(appEnv));

  app.use('/api', attachActorMiddleware);

  // -------------------------------------------------------------------------
  // 1. Auth, Session, Account & Multi-Tenant Org Endpoints
  // -------------------------------------------------------------------------

  app.get('/api/config', (_req, res) => {
    res.json({
      demoLoginEnabled: appEnv.demoLoginEnabled,
      demoPrivilegedEnabled: demoPrivilegedEnabled,
      aiMode: getAiProviderStatus().mode,
    });
  });

  app.get('/api/auth/me', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor;
      if (!actor) {
        res.json({
          authenticated: false,
          actor: null,
          aiMode: getAiProviderStatus().mode,
          demoLoginEnabled: appEnv.demoLoginEnabled,
      demoPrivilegedEnabled: demoPrivilegedEnabled,
        });
        return;
      }

      const [entitlements, usedResults, orgRows, recentProjs, userRows] = await Promise.all([
        getOrgEntitlements(actor.activeOrgId),
        getMonthlyUsage(actor.activeOrgId, 'results_generated'),
        db.select().from(orgs).where(eq(orgs.id, actor.activeOrgId)).limit(1),
        db
          .select()
          .from(projects)
          .where(and(eq(projects.orgId, actor.activeOrgId), isNull(projects.deletedAt)))
          .orderBy(desc(projects.updatedAt))
          .limit(3),
        db.select().from(users).where(eq(users.uid, actor.uid)).limit(1),
      ]);

      res.json({
        authenticated: true,
        actor,
        preferences: {
          locale: userRows[0]?.locale || 'ar',
          theme: userRows[0]?.theme || 'light',
          expertSuggestionsEnabled: userRows[0]?.expertSuggestionsEnabled ?? true,
        },
        org: orgRows[0] || null,
        entitlements,
        usage: {
          resultsUsed: usedResults,
          resultsLimit: entitlements.resultsPerMonth,
        },
        recentProjects: recentProjs.map((p) => ({ id: p.id, title: p.title })),
        aiMode: getAiProviderStatus().mode,
        demoLoginEnabled: appEnv.demoLoginEnabled,
      demoPrivilegedEnabled: demoPrivilegedEnabled,
      });
    } catch (error) {
      console.error('/api/auth/me failed:', error);
      sendApiError(res, 500, 'AUTH_ME_ERROR', 'home.networkError');
    }
  });

  app.post('/api/auth/firebase-sync', async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.actor) {
        sendApiError(res, 401, 'INVALID_TOKEN', 'auth.dialogTitle');
        return;
      }
      await createSessionCookie(res, req.actor.uid, req.actor.activeOrgId);
      await logAnalytics('signup_completed', 'ar', req.actor.activeOrgId, undefined, {
        method: 'google_firebase',
      });
      res.json({ ok: true, actor: req.actor });
    } catch (error) {
      console.error('/api/auth/firebase-sync failed:', error);
      sendApiError(res, 500, 'SYNC_FAILED', 'home.networkError');
    }
  });

  app.post('/api/auth/magic-link', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendApiError(res, 400, 'INVALID_EMAIL', 'errors.invalidEmail');
        return;
      }

      const ipHashVal = hashIp(req.ip);
      const [ipAllowed, emailAllowed] = await Promise.all([
        checkSharedRateLimit(`magic_req_ip:${ipHashVal}`, 10, 15 * 60_000),
        checkSharedRateLimit(`magic_req_email:${hashToken(email)}`, 3, 15 * 60_000),
      ]);

      if (!ipAllowed || !emailAllowed) {
        sendApiError(res, 429, 'RATE_LIMIT', 'errors.rateLimited');
        return;
      }

      // Invalidate all prior unused codes for this email before issuing a new one (A2)
      const now = new Date();
      await db
        .update(magicLinks)
        .set({ invalidatedAt: now })
        .where(
          and(
            eq(magicLinks.email, email),
            isNull(magicLinks.consumedAt),
            isNull(magicLinks.invalidatedAt),
          ),
        );

      const code = String(crypto.randomInt(100000, 1000000));
      const id = `ml_${crypto.randomUUID()}`;
      await db.insert(magicLinks).values({
        id,
        email,
        codeHash: hashToken(code),
        expiresAt: new Date(now.getTime() + 15 * 60_000),
      });

      await emailProvider.sendMagicCodeEmail({
        to: email,
        code,
        locale: req.body?.locale === 'en' ? 'en' : 'ar',
      });

      const responseBody: Record<string, unknown> = {
        ok: true,
        message_key: 'errors.magicNeutralSent',
        message: 'إذا كان البريد صحيحاً فسيصلك رمز',
      };
      if (appEnv.EMAIL_PROVIDER === 'console' && !appEnv.isProduction) {
        responseBody.devPreviewCode = code;
      }
      res.json(responseBody);
    } catch {
      sendApiError(res, 500, 'MAGIC_ERROR', 'errors.internalError');
    }
  });

  app.post('/api/auth/magic-verify', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const code = String(req.body?.code || '').trim();
      const ipHashVal = hashIp(req.ip);

      if (!email || !/^\d{6}$/.test(code)) {
        sendApiError(res, 400, 'INVALID_CODE', 'errors.invalidMagicCode');
        return;
      }

      const ipAllowed = await checkSharedRateLimit(`magic_verify_ip:${ipHashVal}`, 20, 15 * 60_000);
      if (!ipAllowed) {
        sendApiError(res, 429, 'RATE_LIMIT', 'errors.rateLimited');
        return;
      }

      const windowStart = new Date(Date.now() - 15 * 60_000);
      const recentFailed = await db
        .select()
        .from(magicAttempts)
        .where(
          and(
            eq(magicAttempts.email, email),
            eq(magicAttempts.succeeded, false),
            gt(magicAttempts.attemptedAt, windowStart),
          ),
        );

      if (recentFailed.length >= 5) {
        await db
          .update(magicLinks)
          .set({ invalidatedAt: new Date() })
          .where(and(eq(magicLinks.email, email), isNull(magicLinks.consumedAt)));
        sendApiError(res, 429, 'TOO_MANY_ATTEMPTS', 'errors.invalidMagicCode');
        return;
      }

      const activeCodes = await db
        .select()
        .from(magicLinks)
        .where(
          and(
            eq(magicLinks.email, email),
            gt(magicLinks.expiresAt, new Date()),
            isNull(magicLinks.consumedAt),
            isNull(magicLinks.invalidatedAt),
          ),
        )
        .orderBy(desc(magicLinks.createdAt))
        .limit(5);

      const candidateBuf = Buffer.from(hashToken(code), 'hex');
      let matchedRow: (typeof activeCodes)[number] | null = null;
      for (const row of activeCodes) {
        const storedBuf = Buffer.from(row.codeHash, 'hex');
        if (
          storedBuf.length === candidateBuf.length &&
          crypto.timingSafeEqual(storedBuf, candidateBuf)
        ) {
          matchedRow = row;
        }
      }

      if (!matchedRow) {
        await db.insert(magicAttempts).values({
          email,
          ipHash: ipHashVal,
          succeeded: false,
        });
        if (recentFailed.length + 1 >= 5) {
          await db
            .update(magicLinks)
            .set({ invalidatedAt: new Date() })
            .where(and(eq(magicLinks.email, email), isNull(magicLinks.consumedAt)));
        }
        sendApiError(res, 400, 'INVALID_CODE', 'errors.invalidMagicCode');
        return;
      }

      await db
        .update(magicLinks)
        .set({ consumedAt: new Date() })
        .where(eq(magicLinks.id, matchedRow.id));

      await db.insert(magicAttempts).values({
        email,
        ipHash: ipHashVal,
        succeeded: true,
      });

      const uid = `magic:${hashToken(email).slice(0, 16)}`;
      const synced = await getOrCreateUserWithWorkspace(uid, email);
      await createSessionCookie(res, synced.user.uid, synced.activeOrgId);
      res.json({ ok: true });
    } catch {
      sendApiError(res, 500, 'VERIFY_ERROR', 'errors.internalError');
    }
  });

  if (appEnv.demoLoginEnabled) {
    app.post('/api/auth/demo-login', async (req, res) => {
      try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const allowedDemoEmails = [
          'admin@wijaha.demo',
          'yousef@wijaha.demo',
          'sara@org-alpha.demo',
          'fahad@org-beta.demo',
          'noura@individual.demo',
        ];
        if (!allowedDemoEmails.includes(email)) {
          sendApiError(res, 403, 'NOT_DEMO_ACCOUNT', 'auth.dialogTitle');
          return;
        }
        if (!demoPrivilegedEnabled && PRIVILEGED_DEMO_EMAILS.includes(email)) {
          sendApiError(res, 403, 'PRIVILEGED_DEMO_DISABLED', 'auth.dialogTitle');
          return;
        }

        const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (userRows.length === 0) {
          sendApiError(res, 404, 'USER_NOT_FOUND', 'auth.dialogTitle');
          return;
        }
        const u = userRows[0];
        const memRows = await db
          .select()
          .from(memberships)
          .where(eq(memberships.userUid, u.uid))
          .limit(1);

        const activeOrgId = memRows[0]?.orgId || `personal_${u.uid}`;
        await createSessionCookie(res, u.uid, activeOrgId);
        await logAudit(u.uid, 'auth.demo_login', 'user', u.uid, activeOrgId, req);
        res.json({ ok: true });
      } catch (error) {
        console.error('/api/auth/demo-login failed:', error);
        sendApiError(res, 500, 'DEMO_LOGIN_ERROR', 'home.networkError');
      }
    });
  }

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const rawCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
        SESSION_COOKIE_NAME
      ];
      if (rawCookie) {
        await db.delete(authSessions).where(eq(authSessions.id, hashToken(rawCookie)));
      }
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.json({ ok: true });
    } catch {
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.json({ ok: true });
    }
  });

  app.post(
    '/api/auth/mfa/setup',
    requireAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actor = req.actor!;
        const secret = generateTotpSecret();
        const encrypted = encryptField(secret);
        await db
          .update(users)
          .set({
            mfaSecretEncrypted: encrypted,
            updatedAt: new Date(),
          })
          .where(eq(users.uid, actor.uid));

        const otpauthUri = buildOtpAuthUri({
          secret,
          accountEmail: actor.email,
          issuer: 'WIJAHA',
        });
        await logAudit(actor.uid, 'auth.mfa_setup', 'user', actor.uid, actor.activeOrgId, req);
        res.json({ ok: true, secret, otpauthUri });
      } catch (error) {
        console.error('POST /api/auth/mfa/setup failed:', error);
        sendApiError(res, 500, 'MFA_SETUP_ERROR', 'errors.internalError');
      }
    },
  );

  app.post(
    '/api/auth/mfa/verify',
    requireAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actor = req.actor!;
        const code = String(req.body?.code || '').trim();
        const userRows = await db
          .select()
          .from(users)
          .where(eq(users.uid, actor.uid))
          .limit(1);
        const secretEncrypted = userRows[0]?.mfaSecretEncrypted;
        if (!secretEncrypted) {
          sendApiError(res, 400, 'MFA_NOT_INITIALIZED', 'errors.validationError');
          return;
        }
        const secret = decryptField(secretEncrypted);
        if (!secret || !verifyTotpCode(secret, code)) {
          sendApiError(res, 400, 'INVALID_MFA_CODE', 'errors.invalidMagicCode');
          return;
        }

        await db
          .update(users)
          .set({
            mfaEnabled: true,
            mfaVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(users.uid, actor.uid));

        const rawCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
          SESSION_COOKIE_NAME
        ];
        if (rawCookie) {
          await db
            .update(authSessions)
            .set({ mfaVerified: true })
            .where(eq(authSessions.id, hashToken(rawCookie)));
        }

        await logAudit(actor.uid, 'auth.mfa_verified', 'user', actor.uid, actor.activeOrgId, req);
        res.json({ ok: true, mfaVerified: true });
      } catch (error) {
        console.error('POST /api/auth/mfa/verify failed:', error);
        sendApiError(res, 500, 'MFA_VERIFY_ERROR', 'errors.internalError');
      }
    },
  );

  app.patch('/api/account', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (req.body?.locale === 'ar' || req.body?.locale === 'en') {
        updates.locale = req.body.locale;
      }
      if (['light', 'dark', 'system'].includes(req.body?.theme)) {
        updates.theme = req.body.theme;
      }
      if (typeof req.body?.expertSuggestionsEnabled === 'boolean') {
        updates.expertSuggestionsEnabled = req.body.expertSuggestionsEnabled;
      }
      await db.update(users).set(updates).where(eq(users.uid, actor.uid));
      res.json({ ok: true });
    } catch (error) {
      console.error('PATCH /api/account failed:', error);
      sendApiError(res, 500, 'ACCOUNT_UPDATE_ERROR', 'home.networkError');
    }
  });

  app.get('/api/account/export', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const [myProjects, myInvoices, myRuns] = await Promise.all([
        db.select().from(projects).where(eq(projects.orgId, actor.activeOrgId)),
        db.select().from(invoices).where(eq(invoices.orgId, actor.activeOrgId)),
        db.select().from(simulationRuns).where(eq(simulationRuns.userUid, actor.uid)),
      ]);
      await logAudit(actor.uid, 'account.export_data', 'user', actor.uid, actor.activeOrgId, req);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="wijaha-data-${actor.uid.replace(/[^a-z0-9]/gi, '_')}.json"`,
      );
      res.send(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            profile: { email: actor.email, name: actor.name, activeOrgId: actor.activeOrgId },
            projects: myProjects,
            invoices: myInvoices,
            simulationRuns: myRuns,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      console.error('/api/account/export failed:', error);
      sendApiError(res, 500, 'EXPORT_DATA_ERROR', 'home.networkError');
    }
  });

  app.post('/api/account/delete', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      // Prevent accidentally locking demo preview accounts permanently during evaluation, unless real user
      if (!actor.uid.startsWith('demo:')) {
        await db
          .update(users)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.uid, actor.uid));
      }
      await logAudit(actor.uid, 'account.schedule_delete', 'user', actor.uid, actor.activeOrgId, req);
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.json({ ok: true, recoveryDays: 14 });
    } catch (error) {
      console.error('/api/account/delete failed:', error);
      sendApiError(res, 500, 'DELETE_ACCOUNT_ERROR', 'home.networkError');
    }
  });

  app.get('/api/org', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'project:read', { orgId: actor.activeOrgId })) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }
      const [orgRows, memRows, invRows, entitlements] = await Promise.all([
        db.select().from(orgs).where(eq(orgs.id, actor.activeOrgId)).limit(1),
        db
          .select({
            id: memberships.id,
            role: memberships.role,
            userUid: memberships.userUid,
            email: users.email,
            name: users.name,
          })
          .from(memberships)
          .innerJoin(users, eq(memberships.userUid, users.uid))
          .where(eq(memberships.orgId, actor.activeOrgId)),
        db.select().from(invitations).where(eq(invitations.orgId, actor.activeOrgId)),
        getOrgEntitlements(actor.activeOrgId),
      ]);

      const safeInvitations = invRows.map(({ token: _omittedToken, ...rest }) => rest);

      res.json({
        org: orgRows[0] || null,
        members: memRows,
        invitations: safeInvitations,
        seatsLimit: entitlements.seats,
      });
    } catch (error) {
      console.error('GET /api/org failed:', error);
      sendApiError(res, 500, 'ORG_FETCH_ERROR', 'home.networkError');
    }
  });

  app.post('/api/org/invitations', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'org:manage_members', { orgId: actor.activeOrgId })) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }
      const email = String(req.body?.email || '').trim().toLowerCase();
      const role = ['org_admin', 'member', 'viewer'].includes(req.body?.role)
        ? req.body.role
        : 'member';
      if (!email || !email.includes('@')) {
        sendApiError(res, 400, 'INVALID_EMAIL', 'errors.invalidEmail');
        return;
      }

      const entitlements = await getOrgEntitlements(actor.activeOrgId);
      const currentMembers = await db
        .select()
        .from(memberships)
        .where(eq(memberships.orgId, actor.activeOrgId));
      if (currentMembers.length >= entitlements.seats) {
        sendApiError(res, 403, 'SEAT_LIMIT_REACHED', 'errors.seatLimitReached');
        return;
      }

      const invId = `inv_${crypto.randomUUID()}`;
      const token = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000);
      await db.insert(invitations).values({
        id: invId,
        orgId: actor.activeOrgId,
        email,
        role,
        invitedByUid: actor.uid,
        token,
        expiresAt,
      });
      await logAudit(actor.uid, 'org.invite_member', 'invitation', invId, actor.activeOrgId, req, {
        role,
      });
      const inviteUrl = `${appEnv.APP_URL.replace(/\/$/, '')}/invite/${token}`;
      res.status(201).json({ ok: true, id: invId, token, inviteUrl, expiresAt: expiresAt.toISOString() });
    } catch (error) {
      console.error('POST /api/org/invitations failed:', error);
      sendApiError(res, 500, 'ORG_INVITE_ERROR', 'home.networkError');
    }
  });

  app.get('/api/invitations/:token', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) {
        sendApiError(res, 404, 'INVITATION_NOT_FOUND', 'notFound.title');
        return;
      }
      const invRows = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.token, token),
            eq(invitations.status, 'pending'),
            gt(invitations.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (invRows.length === 0) {
        sendApiError(res, 404, 'INVITATION_NOT_FOUND', 'notFound.title');
        return;
      }
      const inv = invRows[0];
      const orgRows = await db.select().from(orgs).where(eq(orgs.id, inv.orgId)).limit(1);
      res.json({
        orgId: inv.orgId,
        orgName: orgRows[0]?.name || inv.orgId,
        emailHint: inv.email.replace(/^(..).*(@.*)$/, '$1***$2'),
        role: inv.role,
        expiresAt: inv.expiresAt,
      });
    } catch (error) {
      console.error('GET /api/invitations/:token failed:', error);
      sendApiError(res, 500, 'INVITATION_GET_ERROR', 'home.networkError');
    }
  });

  app.post(
    '/api/invitations/:token/accept',
    requireAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actor = req.actor!;
        const token = String(req.params.token || '').trim();
        const invRows = await db
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.token, token),
              eq(invitations.status, 'pending'),
              gt(invitations.expiresAt, new Date()),
            ),
          )
          .limit(1);
        if (invRows.length === 0) {
          sendApiError(res, 404, 'INVITATION_INVALID', 'notFound.title');
          return;
        }
        const inv = invRows[0];
        if (actor.email.trim().toLowerCase() !== inv.email.trim().toLowerCase()) {
          sendApiError(res, 403, 'INVITATION_EMAIL_MISMATCH', 'errors.forbidden');
          return;
        }

        const [entitlements, existingMem, currentMembers] = await Promise.all([
          getOrgEntitlements(inv.orgId),
          db
            .select()
            .from(memberships)
            .where(and(eq(memberships.userUid, actor.uid), eq(memberships.orgId, inv.orgId)))
            .limit(1),
          db.select().from(memberships).where(eq(memberships.orgId, inv.orgId)),
        ]);

        if (existingMem.length === 0 && currentMembers.length >= entitlements.seats) {
          sendApiError(res, 403, 'SEAT_LIMIT_REACHED', 'errors.seatLimitReached');
          return;
        }

        const updatedInv = await db
          .update(invitations)
          .set({ status: 'accepted' })
          .where(and(eq(invitations.id, inv.id), eq(invitations.status, 'pending')))
          .returning({ id: invitations.id });

        if (updatedInv.length === 0) {
          sendApiError(res, 404, 'INVITATION_ALREADY_USED', 'notFound.title');
          return;
        }

        if (existingMem.length === 0) {
          await db.insert(memberships).values({
            userUid: actor.uid,
            orgId: inv.orgId,
            role: inv.role,
          });
        } else {
          await db
            .update(memberships)
            .set({ role: inv.role })
            .where(eq(memberships.id, existingMem[0].id));
        }

        await db
          .update(authSessions)
          .set({ activeOrgId: inv.orgId })
          .where(eq(authSessions.userUid, actor.uid));

        await logAudit(actor.uid, 'org.accept_invitation', 'invitation', inv.id, inv.orgId, req, {
          role: inv.role,
        });

        res.json({ ok: true, orgId: inv.orgId, role: inv.role });
      } catch (error) {
        console.error('POST /api/invitations/:token/accept failed:', error);
        sendApiError(res, 500, 'INVITATION_ACCEPT_ERROR', 'home.networkError');
      }
    },
  );

  app.delete(
    '/api/org/members/:uid',
    requireAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actor = req.actor!;
        if (!can(actor, 'org:manage_members', { orgId: actor.activeOrgId })) {
          sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
          return;
        }
        const targetUid = String(req.params.uid || '').trim();
        if (!targetUid) {
          sendApiError(res, 400, 'INVALID_MEMBER_UID', 'errors.badRequest');
          return;
        }
        if (targetUid === actor.uid) {
          sendApiError(res, 400, 'CANNOT_REMOVE_SELF', 'errors.badRequest');
          return;
        }

        const targetMemRows = await db
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.userUid, targetUid),
              eq(memberships.orgId, actor.activeOrgId),
            ),
          )
          .limit(1);

        if (targetMemRows.length === 0) {
          sendApiError(res, 404, 'MEMBER_NOT_FOUND', 'errors.notFound');
          return;
        }

        if (targetMemRows[0].role === 'org_owner' && actor.orgRole !== 'org_owner') {
          sendApiError(res, 403, 'CANNOT_REMOVE_OWNER', 'errors.forbidden');
          return;
        }

        await db
          .delete(memberships)
          .where(
            and(
              eq(memberships.userUid, targetUid),
              eq(memberships.orgId, actor.activeOrgId),
            ),
          );

        await db
          .delete(authSessions)
          .where(
            and(
              eq(authSessions.userUid, targetUid),
              eq(authSessions.activeOrgId, actor.activeOrgId),
            ),
          );

        await logAudit(
          actor.uid,
          'org.remove_member',
          'user',
          targetUid,
          actor.activeOrgId,
          req,
        );

        res.json({ ok: true });
      } catch (error) {
        console.error('DELETE /api/org/members/:uid failed:', error);
        sendApiError(res, 500, 'ORG_REMOVE_MEMBER_ERROR', 'errors.serverError');
      }
    },
  );

  // -------------------------------------------------------------------------
  // 2. Transformative Search & Streaming Pipeline (/api/query, /api/results)
  // -------------------------------------------------------------------------

  app.post('/api/query', async (req: AuthenticatedRequest, res) => {
    const startMs = Date.now();
    let reservedQuotaBucket: string | null = null;
    try {
      const ipKey = `query:${req.actor?.uid || hashIp(req.ip)}`;
      if (!(await checkSharedRateLimit(ipKey, req.actor ? 40 : 25, 60_000))) {
        sendApiError(res, 429, 'RATE_LIMIT', 'errors.rateLimited');
        return;
      }

      const parsedInput = QueryInputSchema.safeParse(req.body);
      if (!parsedInput.success) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'home.charLimit');
        return;
      }
      const { query, locale, clarificationAnswer, overrideContext } = parsedInput.data;

      // Mint or verify signed HttpOnly anon cookie BEFORE SSE headers flush (B2)
      const anonOwnerId = req.actor
        ? null
        : resolveOrCreateAnonId(req, res, appEnv.sessionSecret, appEnv.isProduction);

      // Atomic monthly quota reservation BEFORE running generation (C8)
      if (req.actor) {
        const entitlements = await getOrgEntitlements(req.actor.activeOrgId);
        const reservation = await reserveMonthlyQuota(
          req.actor.activeOrgId,
          'results_generated',
          entitlements.resultsPerMonth,
        );
        if (!reservation.allowed) {
          await logAnalytics('limit_reached', locale, req.actor.activeOrgId);
          sendApiError(res, 429, 'PLAN_LIMIT_REACHED', 'errors.planLimitReached', {
            used: reservation.usedCount,
            limit: entitlements.resultsPerMonth,
            resetDate: nextMonthResetLabel(locale),
          });
          return;
        }
        reservedQuotaBucket = req.actor.activeOrgId;
      } else if (anonOwnerId) {
        const anonBucket = `anon:${anonOwnerId}`;
        const reservation = await reserveMonthlyQuota(anonBucket, 'results_generated', 15);
        if (!reservation.allowed) {
          sendApiError(res, 429, 'PLAN_LIMIT_REACHED', 'errors.planLimitReached', {
            used: reservation.usedCount,
            limit: 15,
            resetDate: nextMonthResetLabel(locale),
          });
          return;
        }
        reservedQuotaBucket = anonBucket;
      }

      const wantsStream = String(req.headers.accept || '').includes('text/event-stream');
      const sendSse = (event: string, data: unknown) => {
        if (wantsStream) {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      };

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
      }

      // Stage 1-2: Understanding intent & entities
      sendSse('stage', { stage: 'understanding' });
      const entities = await understandQuery(query, locale);

      // Stage 4: Hybrid Retrieval
      sendSse('stage', { stage: 'retrieving' });
      const retrievedRules = await retrieveHybridRules({
        query,
        locale,
        intent: entities.intent,
        countryIso: entities.countryIso,
        contextType: entities.venueType,
        topK: 10,
      });

      // Stage 5-6: Structured Generation + Deterministic Verification
      sendSse('stage', { stage: 'generating' });
      const finalResult = await executeWijahaPipeline({
        rawQuery: query,
        locale,
        retrievedRules,
        entities,
        clarificationAnswer,
        overrideContext,
        expertSuggestionsEnabled: req.actor?.expertSuggestionsEnabled ?? true,
      });

      // Stream progressive blocks immediately
      sendSse('context', {
        id: finalResult.id,
        title: finalResult.title,
        context: finalResult.context,
        assumptions: finalResult.assumptions,
        clarification: finalResult.clarification,
      });
      sendSse('summary', { summary: finalResult.summary });
      for (const block of finalResult.blocks) {
        sendSse('block', { block });
      }
      sendSse('trust', {
        trust: finalResult.trust,
        expertSuggestion: finalResult.expertSuggestion,
      });

      // Persist encrypted query & private-by-default verified JSON result (B2)
      const queryId = `qry_${crypto.randomUUID()}`;
      await db.insert(queries).values({
        id: queryId,
        userUid: req.actor?.uid ?? null,
        anonId: anonOwnerId,
        orgId: req.actor?.activeOrgId ?? null,
        textEncrypted: encryptField(query),
        locale,
        intent: finalResult.intent,
        sensitivity: finalResult.trust.sensitivity,
      });

      await db.insert(results).values({
        id: finalResult.id,
        queryId,
        userUid: req.actor?.uid ?? null,
        anonId: anonOwnerId,
        orgId: req.actor?.activeOrgId ?? null,
        payload: finalResult as unknown as Record<string, unknown>,
        ruleIds: finalResult.trust.ruleIds,
        modelMeta: { provider: getAiProviderStatus().mode },
        isPublicShare: false,
      });

      const elapsed = Date.now() - startMs;
      await logAnalytics('result_completed', locale, req.actor?.activeOrgId, elapsed, {
        intent: finalResult.intent,
        sensitivity: finalResult.trust.sensitivity,
      });

      if (wantsStream) {
        sendSse('done', { result: finalResult });
        res.end();
      } else {
        res.json({ result: finalResult });
      }
    } catch (error) {
      if (reservedQuotaBucket) {
        await refundMonthlyQuota(reservedQuotaBucket, 'results_generated');
      }
      console.error('POST /api/query failed:', error);
      if (!res.headersSent) {
        sendApiError(res, 500, 'QUERY_FAILED', 'home.networkError');
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ code: 'QUERY_FAILED' })}\n\n`);
        res.end();
      }
    }
  });

  app.get('/api/results/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const rows = await db
        .select()
        .from(results)
        .where(eq(results.id, String(req.params.id)))
        .limit(1);

      if (rows.length === 0) {
        sendApiError(res, 404, 'RESULT_NOT_FOUND', 'notFound.title');
        return;
      }
      const row = rows[0];
      const verifiedAnonId = readVerifiedAnonId(req, appEnv.sessionSecret);
      if (!canAccessResultRecord(req.actor ?? null, verifiedAnonId, row, 'read')) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }

      res.json({ result: row.payload });
    } catch (error) {
      console.error('GET /api/results/:id failed:', error);
      sendApiError(res, 500, 'RESULT_FETCH_ERROR', 'home.networkError');
    }
  });

  app.post('/api/results/:id/refine', async (req: AuthenticatedRequest, res) => {
    let reservedQuotaBucket: string | null = null;
    try {
      const ipKey = req.actor ? `refine:u:${req.actor.uid}` : `refine:ip:${hashIp(req.ip)}`;
      if (!(await checkSharedRateLimit(ipKey, 30, 60_000))) {
        sendApiError(res, 429, 'RATE_LIMITED', 'errors.rateLimited');
        return;
      }

      const rows = await db
        .select()
        .from(results)
        .where(eq(results.id, String(req.params.id)))
        .limit(1);
      if (rows.length === 0) {
        sendApiError(res, 404, 'RESULT_NOT_FOUND', 'notFound.title');
        return;
      }
      const resultRow = rows[0];
      const verifiedAnonId = readVerifiedAnonId(req, appEnv.sessionSecret);
      if (!canAccessResultRecord(req.actor ?? null, verifiedAnonId, resultRow, 'mutate')) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }

      const currentPayload = resultRow.payload as unknown as WijahaResult;
      const locale: Locale = req.body?.locale === 'en' ? 'en' : currentPayload.locale;

      if (req.actor) {
        const entitlements = await getOrgEntitlements(req.actor.activeOrgId);
        const reservation = await reserveMonthlyQuota(
          req.actor.activeOrgId,
          'results_generated',
          entitlements.resultsPerMonth,
        );
        if (!reservation.allowed) {
          sendApiError(res, 429, 'PLAN_LIMIT_REACHED', 'errors.planLimitReached', {
            used: reservation.usedCount,
            limit: entitlements.resultsPerMonth,
            resetDate: nextMonthResetLabel(locale),
          });
          return;
        }
        reservedQuotaBucket = req.actor.activeOrgId;
      }

      const clarificationAnswer = req.body?.clarificationAnswer
        ? String(req.body.clarificationAnswer)
        : undefined;
      const followupText = req.body?.followupText
        ? String(req.body.followupText)
        : undefined;
      const overrideContext =
        typeof req.body?.overrideContext === 'object' && req.body.overrideContext
          ? (req.body.overrideContext as Record<string, string>)
          : undefined;

      const syntheticQuery = followupText
        ? `${currentPayload.title} — ${followupText}`
        : `${currentPayload.title} ${clarificationAnswer || ''}`;

      const entities = await understandQuery(syntheticQuery, currentPayload.locale ?? 'ar');
      entities.intent = followupText ? entities.intent : currentPayload.intent;
      if (req.body?.elevateToHighSensitivity === true) {
        entities.sensitivity = 'high';
      }

      const retrieved = await retrieveHybridRules({
        query: syntheticQuery,
        locale,
        intent: entities.intent,
        countryIso: entities.countryIso,
        topK: 10,
      });

      const updatedResult = await executeWijahaPipeline({
        rawQuery: syntheticQuery,
        locale,
        retrievedRules: retrieved,
        entities,
        clarificationAnswer: clarificationAnswer || 'answered',
        overrideContext,
        expertSuggestionsEnabled: req.actor?.expertSuggestionsEnabled ?? true,
      });

      updatedResult.id = currentPayload.id;
      await db
        .update(results)
        .set({
          payload: updatedResult as unknown as Record<string, unknown>,
          ruleIds: updatedResult.trust.ruleIds,
          updatedAt: new Date(),
        })
        .where(eq(results.id, currentPayload.id));

      res.json({ result: updatedResult });
    } catch (error) {
      if (reservedQuotaBucket) {
        await refundMonthlyQuota(reservedQuotaBucket, 'results_generated');
      }
      console.error('POST /api/results/:id/refine failed:', error);
      sendApiError(res, 500, 'REFINE_ERROR', 'home.networkError');
    }
  });

  app.post('/api/feedback', async (req: AuthenticatedRequest, res) => {
    try {
      const resultId = String(req.body?.resultId || '');
      const rating = req.body?.rating === 'down' ? 'down' : 'up';
      const comment = req.body?.comment ? String(req.body.comment).slice(0, 1000) : null;
      const reportedError = Boolean(req.body?.reportedError);
      const ruleIds = Array.isArray(req.body?.ruleIds) ? req.body.ruleIds.map(String) : [];

      await db.insert(feedback).values({
        id: `fb_${crypto.randomUUID().slice(0, 10)}`,
        resultId,
        userUid: req.actor?.uid ?? null,
        rating,
        comment,
        reportedError,
        ruleIds,
      });
      await logAnalytics(
        reportedError ? 'error_reported' : 'feedback_given',
        'ar',
        req.actor?.activeOrgId,
        undefined,
        { rating },
      );
      res.json({ ok: true });
    } catch (error) {
      console.error('POST /api/feedback failed:', error);
      sendApiError(res, 500, 'FEEDBACK_ERROR', 'home.networkError');
    }
  });

  // -------------------------------------------------------------------------
  // 3. Projects, Versions, Natural Update, Share & Export
  // -------------------------------------------------------------------------

  app.get('/api/projects', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'project:read', { orgId: actor.activeOrgId })) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }
      const list = await db
        .select()
        .from(projects)
        .where(and(eq(projects.orgId, actor.activeOrgId), isNull(projects.deletedAt)))
        .orderBy(desc(projects.updatedAt));
      res.json({ projects: list });
    } catch (error) {
      console.error('GET /api/projects failed:', error);
      sendApiError(res, 500, 'PROJECTS_LIST_ERROR', 'home.networkError');
    }
  });

  app.post('/api/projects', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'project:write', { orgId: actor.activeOrgId })) {
        sendApiError(res, 403, 'FORBIDDEN', 'projects.title');
        return;
      }

      const parsed = ProjectCreateInputSchema.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'INVALID_INPUT', 'projects.title');
        return;
      }

      const [entitlements, existingProjs, resRows] = await Promise.all([
        getOrgEntitlements(actor.activeOrgId),
        db
          .select()
          .from(projects)
          .where(and(eq(projects.orgId, actor.activeOrgId), isNull(projects.deletedAt))),
        db.select().from(results).where(eq(results.id, parsed.data.resultId)).limit(1),
      ]);

      if (existingProjs.length >= entitlements.projectsMax) {
        sendApiError(res, 403, 'PROJECTS_LIMIT_REACHED', 'pricing.title', {
          used: existingProjs.length,
          limit: entitlements.projectsMax,
        });
        return;
      }

      if (resRows.length === 0) {
        sendApiError(res, 404, 'RESULT_NOT_FOUND', 'notFound.title');
        return;
      }

      const verifiedAnonId = readVerifiedAnonId(req, appEnv.sessionSecret);
      if (!canAccessResultRecord(actor, verifiedAnonId, resRows[0], 'read')) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }

      const payload = resRows[0].payload as unknown as WijahaResult;
      const projectId = `prj_${crypto.randomUUID().slice(0, 12)}`;
      const versionId = `ver_${crypto.randomUUID().slice(0, 12)}`;
      const title = parsed.data.title || payload.title;

      await db.insert(projects).values({
        id: projectId,
        ownerUid: actor.uid,
        orgId: actor.activeOrgId,
        title,
        intent: payload.intent,
        currentVersionId: versionId,
        visibility: 'org',
      });

      await db.insert(projectVersions).values({
        id: versionId,
        projectId,
        versionNumber: 1,
        payload: payload as unknown as Record<string, unknown>,
        changeSummary: payload.locale === 'ar' ? 'الإصدار الأول عند الحفظ' : 'Initial saved version',
        diffSummary: [],
        authorUid: actor.uid,
      });

      await logAnalytics('project_saved', payload.locale, actor.activeOrgId);
      res.status(201).json({ id: projectId });
    } catch (error) {
      console.error('POST /api/projects failed:', error);
      sendApiError(res, 500, 'PROJECT_CREATE_ERROR', 'home.networkError');
    }
  });

  app.get('/api/projects/:id', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const projRows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, String(req.params.id)), isNull(projects.deletedAt)))
        .limit(1);

      if (projRows.length === 0) {
        sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'notFound.title');
        return;
      }
      const proj = projRows[0];

      // Multi-Tenant Defense Layer 1 + 2
      if (!can(actor, 'project:read', { orgId: proj.orgId, ownerUid: proj.ownerUid })) {
        sendApiError(res, 403, 'CROSS_TENANT_DENIED', 'notFound.title');
        return;
      }

      const versions = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.projectId, proj.id))
        .orderBy(desc(projectVersions.versionNumber));

      const currentVersion =
        versions.find((v) => v.id === proj.currentVersionId) ?? versions[0];

      const activeShares = await db
        .select({
          id: shares.id,
          token: shares.token,
          expiresAt: shares.expiresAt,
          createdAt: shares.createdAt,
        })
        .from(shares)
        .where(
          and(
            eq(shares.projectId, proj.id),
            isNull(shares.revokedAt),
            gt(shares.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(shares.createdAt));

      res.json({
        project: proj,
        currentVersion,
        versions,
        shares: activeShares,
      });
    } catch (error) {
      console.error('GET /api/projects/:id failed:', error);
      sendApiError(res, 500, 'PROJECT_GET_ERROR', 'home.networkError');
    }
  });

  app.delete('/api/projects/:id', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const projRows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, String(req.params.id)), isNull(projects.deletedAt)))
        .limit(1);
      if (projRows.length === 0) {
        sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'notFound.title');
        return;
      }
      const proj = projRows[0];
      if (!can(actor, 'project:delete', { orgId: proj.orgId, ownerUid: proj.ownerUid })) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }

      const now = new Date();
      await db.update(projects).set({ deletedAt: now, updatedAt: now }).where(eq(projects.id, proj.id));
      await db
        .update(shares)
        .set({ revokedAt: now })
        .where(and(eq(shares.projectId, proj.id), isNull(shares.revokedAt)));
      await logAudit(actor.uid, 'project.delete', 'project', proj.id, proj.orgId, req);
      res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/projects/:id failed:', error);
      sendApiError(res, 500, 'PROJECT_DELETE_ERROR', 'home.networkError');
    }
  });

  app.patch('/api/projects/:id', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const projRows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, String(req.params.id)), isNull(projects.deletedAt)))
        .limit(1);

      if (projRows.length === 0) {
        sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'notFound.title');
        return;
      }
      const proj = projRows[0];
      if (!can(actor, 'project:write', { orgId: proj.orgId, ownerUid: proj.ownerUid })) {
        sendApiError(res, 403, 'CROSS_TENANT_DENIED', 'notFound.title');
        return;
      }

      const parsed = ProjectPatchInputSchema.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'INVALID_PAYLOAD', 'projects.title');
        return;
      }

      const existingVersions = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.projectId, proj.id))
        .orderBy(desc(projectVersions.versionNumber));

      const nextNum = (existingVersions[0]?.versionNumber ?? 1) + 1;
      const versionId = `ver_${crypto.randomUUID().slice(0, 12)}`;
      const nextTitle = parsed.data.title || parsed.data.payload.title || proj.title;

      await db.insert(projectVersions).values({
        id: versionId,
        projectId: proj.id,
        versionNumber: nextNum,
        payload: parsed.data.payload as unknown as Record<string, unknown>,
        changeSummary: parsed.data.changeSummary,
        diffSummary: [parsed.data.changeSummary],
        authorUid: actor.uid,
      });

      await db
        .update(projects)
        .set({
          title: nextTitle,
          currentVersionId: versionId,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, proj.id));

      res.json({ ok: true, versionId, versionNumber: nextNum });
    } catch (error) {
      console.error('PATCH /api/projects/:id failed:', error);
      sendApiError(res, 500, 'PROJECT_PATCH_ERROR', 'home.networkError');
    }
  });

  app.post('/api/projects/:id/update', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const projRows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, String(req.params.id)), isNull(projects.deletedAt)))
        .limit(1);

      if (projRows.length === 0) {
        sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'notFound.title');
        return;
      }
      const proj = projRows[0];
      if (!can(actor, 'project:write', { orgId: proj.orgId, ownerUid: proj.ownerUid })) {
        sendApiError(res, 403, 'CROSS_TENANT_DENIED', 'notFound.title');
        return;
      }

      const parsed = ProjectNaturalUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'INVALID_INSTRUCTION', 'projects.updatePlanTitle');
        return;
      }

      const existingVersions = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.projectId, proj.id))
        .orderBy(desc(projectVersions.versionNumber));
      const curVer =
        existingVersions.find((v) => v.id === proj.currentVersionId) ?? existingVersions[0];

      const { updated, diffSummary } = applyNaturalProjectUpdatePure(
        curVer.payload as unknown as WijahaResult,
        parsed.data.instruction,
        parsed.data.locale,
      );

      const nextNum = (existingVersions[0]?.versionNumber ?? 1) + 1;
      const versionId = `ver_${crypto.randomUUID().slice(0, 12)}`;

      await db.insert(projectVersions).values({
        id: versionId,
        projectId: proj.id,
        versionNumber: nextNum,
        payload: updated as unknown as Record<string, unknown>,
        changeSummary:
          parsed.data.locale === 'ar'
            ? `تحديث ذكي: ${parsed.data.instruction.slice(0, 70)}`
            : `Plan update: ${parsed.data.instruction.slice(0, 70)}`,
        diffSummary,
        authorUid: actor.uid,
      });

      await db
        .update(projects)
        .set({ currentVersionId: versionId, updatedAt: new Date() })
        .where(eq(projects.id, proj.id));

      res.json({ ok: true, versionId, versionNumber: nextNum, updated, diffSummary });
    } catch (error) {
      console.error('POST /api/projects/:id/update failed:', error);
      sendApiError(res, 500, 'PROJECT_UPDATE_ERROR', 'home.networkError');
    }
  });

  app.post(
    '/api/projects/:id/restore/:versionId',
    requireAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actor = req.actor!;
        const projRows = await db
          .select()
          .from(projects)
          .where(and(eq(projects.id, String(req.params.id)), isNull(projects.deletedAt)))
          .limit(1);
        if (projRows.length === 0) {
          sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'notFound.title');
          return;
        }
        const proj = projRows[0];
        if (!can(actor, 'project:write', { orgId: proj.orgId, ownerUid: proj.ownerUid })) {
          sendApiError(res, 403, 'CROSS_TENANT_DENIED', 'notFound.title');
          return;
        }

        const verRows = await db
          .select()
          .from(projectVersions)
          .where(
            and(
              eq(projectVersions.projectId, proj.id),
              eq(projectVersions.id, String(req.params.versionId)),
            ),
          )
          .limit(1);
        if (verRows.length === 0) {
          sendApiError(res, 404, 'VERSION_NOT_FOUND', 'projects.versions');
          return;
        }

        await db
          .update(projects)
          .set({ currentVersionId: verRows[0].id, updatedAt: new Date() })
          .where(eq(projects.id, proj.id));

        res.json({ ok: true });
      } catch (error) {
        console.error('Restore version failed:', error);
        sendApiError(res, 500, 'RESTORE_ERROR', 'home.networkError');
      }
    },
  );

  app.post(
    '/api/projects/:id/dismiss-expert',
    requireAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actor = req.actor!;
        const projRows = await db
          .select()
          .from(projects)
          .where(and(eq(projects.id, String(req.params.id)), isNull(projects.deletedAt)))
          .limit(1);
        if (projRows.length === 0) {
          sendApiError(res, 404, 'NOT_FOUND', 'notFound.title');
          return;
        }
        const proj = projRows[0];
        if (!can(actor, 'project:write', { orgId: proj.orgId, ownerUid: proj.ownerUid })) {
          sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
          return;
        }
        const trigger = String(req.body?.trigger || 'high_sensitivity');
        const nextList = Array.from(new Set([...proj.dismissedExpertTriggers, trigger]));
        await db
          .update(projects)
          .set({ dismissedExpertTriggers: nextList, updatedAt: new Date() })
          .where(eq(projects.id, proj.id));

        await db.insert(expertSuggestionEvents).values({
          userUid: actor.uid,
          orgId: actor.activeOrgId,
          projectId: proj.id,
          triggerType: trigger,
          eventType: 'dismissed',
        });

        res.json({ ok: true, dismissedExpertTriggers: nextList });
      } catch (error) {
        console.error('Dismiss expert failed:', error);
        sendApiError(res, 500, 'DISMISS_ERROR', 'home.networkError');
      }
    },
  );

  app.post('/api/projects/:id/share', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const projRows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, String(req.params.id)), isNull(projects.deletedAt)))
        .limit(1);
      if (projRows.length === 0) {
        sendApiError(res, 404, 'NOT_FOUND', 'notFound.title');
        return;
      }
      const proj = projRows[0];
      if (!can(actor, 'project:write', { orgId: proj.orgId, ownerUid: proj.ownerUid })) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }

      const rawDays = Number(req.body?.expiresInDays);
      const expiresInDays = Number.isFinite(rawDays)
        ? Math.min(90, Math.max(1, Math.round(rawDays)))
        : 30;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600_000);
      const shareId = `shr_${crypto.randomUUID()}`;
      const token = crypto.randomBytes(16).toString('hex');

      await db.insert(shares).values({
        id: shareId,
        projectId: proj.id,
        orgId: proj.orgId,
        token,
        createdByUid: actor.uid,
        expiresAt,
      });
      await logAudit(actor.uid, 'share.create', 'share', shareId, proj.orgId, req, {
        projectId: proj.id,
        expiresInDays,
      });
      res.json({ id: shareId, token, expiresAt: expiresAt.toISOString() });
    } catch (error) {
      console.error('Share project failed:', error);
      sendApiError(res, 500, 'SHARE_ERROR', 'home.networkError');
    }
  });

  app.delete('/api/shares/:id', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const rows = await db
        .select()
        .from(shares)
        .where(and(eq(shares.id, String(req.params.id)), isNull(shares.revokedAt)))
        .limit(1);
      if (rows.length === 0) {
        sendApiError(res, 404, 'SHARE_NOT_FOUND', 'notFound.title');
        return;
      }
      const sh = rows[0];
      if (!can(actor, 'project:write', { orgId: sh.orgId, ownerUid: sh.createdByUid ?? undefined })) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }
      await db.update(shares).set({ revokedAt: new Date() }).where(eq(shares.id, sh.id));
      await logAudit(actor.uid, 'share.revoke', 'share', sh.id, sh.orgId, req, {
        projectId: sh.projectId,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/shares/:id failed:', error);
      sendApiError(res, 500, 'SHARE_REVOKE_ERROR', 'home.networkError');
    }
  });

  app.get('/api/shares/:token', async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(shares)
        .where(
          and(
            eq(shares.token, String(req.params.token)),
            isNull(shares.revokedAt),
            gt(shares.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (rows.length === 0) {
        sendApiError(res, 404, 'SHARE_EXPIRED', 'notFound.title');
        return;
      }
      const projRows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, rows[0].projectId), isNull(projects.deletedAt)))
        .limit(1);
      if (projRows.length === 0) {
        sendApiError(res, 404, 'NOT_FOUND', 'notFound.title');
        return;
      }
      const verRows = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.id, projRows[0].currentVersionId))
        .limit(1);
      res.json({ result: verRows[0]?.payload });
    } catch (error) {
      console.error('GET /api/shares/:token failed:', error);
      sendApiError(res, 500, 'SHARE_FETCH_ERROR', 'home.networkError');
    }
  });

  // Export endpoint (requires registration per Rule 2: "التسجيل يُطلب عند الحفظ/التصدير فقط")
  app.post('/api/export', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const format = req.body?.format === 'docx' ? 'docx' : 'pdf';
      const projectId = req.body?.projectId ? String(req.body.projectId) : undefined;
      const resultId = req.body?.resultId ? String(req.body.resultId) : undefined;

      let payload: WijahaResult | null = null;
      let versionNumber = 1;

      if (projectId) {
        const projRows = await db
          .select()
          .from(projects)
          .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
          .limit(1);
        if (projRows.length === 0) {
          sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'notFound.title');
          return;
        }
        if (!can(actor, 'project:read', { orgId: projRows[0].orgId, ownerUid: projRows[0].ownerUid })) {
          sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
          return;
        }
        const verRows = await db
          .select()
          .from(projectVersions)
          .where(eq(projectVersions.id, projRows[0].currentVersionId))
          .limit(1);
        payload = (verRows[0]?.payload as unknown as WijahaResult) ?? null;
        versionNumber = verRows[0]?.versionNumber ?? 1;
      } else if (resultId) {
        const resRows = await db.select().from(results).where(eq(results.id, resultId)).limit(1);
        if (resRows.length === 0) {
          sendApiError(res, 404, 'EXPORT_SOURCE_NOT_FOUND', 'notFound.title');
          return;
        }
        const verifiedAnonId = readVerifiedAnonId(req, appEnv.sessionSecret);
        if (!canAccessResultRecord(actor, verifiedAnonId, resRows[0], 'read')) {
          sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
          return;
        }
        payload = (resRows[0]?.payload as unknown as WijahaResult) ?? null;
      }

      if (!payload) {
        sendApiError(res, 404, 'EXPORT_SOURCE_NOT_FOUND', 'notFound.title');
        return;
      }

      const [entitlements, orgRows] = await Promise.all([
        getOrgEntitlements(actor.activeOrgId),
        db.select().from(orgs).where(eq(orgs.id, actor.activeOrgId)).limit(1),
      ]);

      const exportLimit = Math.max(30, entitlements.resultsPerMonth * 2);
      const exportReserve = await reserveMonthlyQuota(
        actor.activeOrgId,
        'exports_created',
        exportLimit,
      );
      if (!exportReserve.allowed) {
        sendApiError(res, 429, 'PLAN_LIMIT_REACHED', 'errors.planLimitReached', {
          used: exportReserve.usedCount,
          limit: exportLimit,
        });
        return;
      }

      const orgDisplay = !orgRows[0]?.isPersonal ? orgRows[0]?.name : undefined;

      await db.insert(exportsLog).values({
        id: `exp_${crypto.randomUUID().slice(0, 10)}`,
        projectId: projectId || resultId || 'direct',
        orgId: actor.activeOrgId,
        userUid: actor.uid,
        format,
        watermarked: entitlements.exportsWatermark,
      });
      await logAnalytics('export_created', payload.locale, actor.activeOrgId, undefined, { format });
      await logAudit(actor.uid, `export.${format}`, 'project', projectId || resultId || 'direct', actor.activeOrgId, req);

      if (format === 'docx') {
        const buf = await generateProjectDocx({
          result: payload,
          versionNumber,
          orgName: orgDisplay,
          watermarked: entitlements.exportsWatermark,
        });
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        res.setHeader('Content-Disposition', `attachment; filename="wijaha-plan-v${versionNumber}.docx"`);
        res.send(buf);
        return;
      }

      const pdfOut = await generateProjectPdfOrHtml({
        result: payload,
        versionNumber,
        orgName: orgDisplay,
        watermarked: entitlements.exportsWatermark,
      });
      res.setHeader('Content-Type', pdfOut.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="wijaha-plan-v${versionNumber}.${pdfOut.extension}"`,
      );
      res.send(pdfOut.buffer);
    } catch (error) {
      if (req.actor) {
        await refundMonthlyQuota(req.actor.activeOrgId, 'exports_created');
      }
      console.error('POST /api/export failed:', error);
      sendApiError(res, 500, 'EXPORT_ERROR', 'home.networkError');
    }
  });

  // -------------------------------------------------------------------------
  // 4. "Check My Plan" (/api/check)
  // -------------------------------------------------------------------------

  app.post('/api/check', async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = CheckPlanInputSchema.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'INVALID_PLAN_TEXT', 'check.planLabel');
        return;
      }
      const report = auditVisitPlanPure(
        parsed.data.planText,
        parsed.data.contextNote,
        parsed.data.locale,
      );
      if (req.actor) {
        await reserveMonthlyQuota(req.actor.activeOrgId, 'checks_run', 10_000);
      }
      res.json({ report });
    } catch (error) {
      console.error('POST /api/check failed:', error);
      sendApiError(res, 500, 'CHECK_ERROR', 'home.networkError');
    }
  });

  // -------------------------------------------------------------------------
  // 5. Simulations & Competency Reports (/api/scenarios, /api/simulations)
  // -------------------------------------------------------------------------

  app.get('/api/scenarios', async (_req, res) => {
    try {
      const list = await db.select().from(scenarios);
      res.json({ scenarios: list });
    } catch (error) {
      console.error('GET /api/scenarios failed:', error);
      sendApiError(res, 500, 'SCENARIOS_ERROR', 'home.networkError');
    }
  });

  app.get('/api/scenarios/:id', async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(scenarios)
        .where(eq(scenarios.id, String(req.params.id)))
        .limit(1);
      if (rows.length === 0) {
        sendApiError(res, 404, 'SCENARIO_NOT_FOUND', 'notFound.title');
        return;
      }
      res.json({ scenario: rows[0] });
    } catch (error) {
      console.error('GET /api/scenarios/:id failed:', error);
      sendApiError(res, 500, 'SCENARIO_ERROR', 'home.networkError');
    }
  });

  app.post('/api/simulations', async (req: AuthenticatedRequest, res) => {
    try {
      const scenarioId = String(req.body?.scenarioId || '');
      const locale: Locale = req.body?.locale === 'en' ? 'en' : 'ar';
      const scRows = await db
        .select()
        .from(scenarios)
        .where(eq(scenarios.id, scenarioId))
        .limit(1);
      if (scRows.length === 0) {
        sendApiError(res, 404, 'SCENARIO_NOT_FOUND', 'notFound.title');
        return;
      }

      const nodes = scRows[0].nodes as unknown as ScenarioNode[];
      const anonOwnerId = req.actor
        ? null
        : resolveOrCreateAnonId(req, res, appEnv.sessionSecret, appEnv.isProduction);
      const runId = `run_${crypto.randomUUID()}`;
      await db.insert(simulationRuns).values({
        id: runId,
        userUid: req.actor?.uid ?? null,
        anonId: anonOwnerId,
        orgId: req.actor?.activeOrgId ?? null,
        scenarioId,
        locale,
        status: 'in_progress',
        currentNodeId: nodes[0]?.id || 'n1',
      });

      await logAnalytics('simulation_started', locale, req.actor?.activeOrgId, undefined, {
        scenarioId,
      });
      res.status(201).json({ runId, scenario: scRows[0], currentNodeId: nodes[0]?.id });
    } catch (error) {
      console.error('POST /api/simulations failed:', error);
      sendApiError(res, 500, 'SIM_START_ERROR', 'home.networkError');
    }
  });

  app.post('/api/simulations/:id/step', async (req: AuthenticatedRequest, res) => {
    try {
      const runId = String(req.params.id);
      const runRows = await db
        .select()
        .from(simulationRuns)
        .where(eq(simulationRuns.id, runId))
        .limit(1);
      if (runRows.length === 0) {
        sendApiError(res, 404, 'RUN_NOT_FOUND', 'notFound.title');
        return;
      }
      const run = runRows[0];
      const verifiedAnonId = readVerifiedAnonId(req, appEnv.sessionSecret);
      if (!canAccessSimulationRun(req.actor ?? null, verifiedAnonId, run)) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }

      const scRows = await db
        .select()
        .from(scenarios)
        .where(eq(scenarios.id, run.scenarioId))
        .limit(1);
      const sc = scRows[0];
      const nodes = sc.nodes as unknown as ScenarioNode[];
      const rubric = sc.rubric as unknown as ScenarioRubric;

      const nodeId = String(req.body?.nodeId || run.currentNodeId);
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        sendApiError(res, 400, 'INVALID_NODE', 'practice.title');
        return;
      }

      let stepScores: Record<string, number> = {};
      let feedbackAr = '';
      let feedbackEn = '';
      let ruleIds: string[] = [];
      let nextNodeId = node.next || 'end';
      let rawAnswer = '';

      if (node.kind === 'choice') {
        const optionId = String(req.body?.optionId || '');
        const opt = node.options?.find((o) => o.id === optionId) ?? node.options?.[0];
        if (!opt) {
          sendApiError(res, 400, 'INVALID_OPTION', 'practice.title');
          return;
        }
        stepScores = opt.scores;
        feedbackAr = opt.feedbackAr;
        feedbackEn = opt.feedbackEn;
        ruleIds = opt.ruleIds;
        nextNodeId = opt.next;
        rawAnswer = opt.id;
      } else {
        rawAnswer = String(req.body?.freeText || '').trim().slice(0, 1000);
        if (rawAnswer.length < 2) {
          sendApiError(res, 400, 'EMPTY_ANSWER', 'practice.freeTextLabel');
          return;
        }
        const evalOut = evaluateFreeTextStepPure(
          rawAnswer,
          node.freeTextCriterionId,
          rubric,
          run.locale as Locale,
        );
        stepScores = evalOut.scores;
        feedbackAr = evalOut.feedbackAr;
        feedbackEn = evalOut.feedbackEn;
        ruleIds = evalOut.ruleIds;
      }

      await db.insert(simulationSteps).values({
        id: `stp_${crypto.randomUUID().slice(0, 12)}`,
        runId,
        nodeId: node.id,
        kind: node.kind,
        answerEncrypted: encryptField(rawAnswer),
        scores: stepScores,
        feedbackText: JSON.stringify({ ar: feedbackAr, en: feedbackEn }),
        ruleIds,
      });

      const nextNode = nodes.find((n) => n.id === nextNodeId);
      const isFinished = !nextNode || Boolean(nextNode.isEnd);

      if (!isFinished) {
        await db
          .update(simulationRuns)
          .set({ currentNodeId: nextNode.id })
          .where(eq(simulationRuns.id, runId));
        res.json({
          finished: false,
          nextNodeId: nextNode.id,
          stepFeedback: { ar: feedbackAr, en: feedbackEn, ruleIds },
        });
        return;
      }

      // Compute final report
      const allSteps = await db
        .select()
        .from(simulationSteps)
        .where(eq(simulationSteps.runId, runId));

      const parsedSteps = allSteps.map((st) => {
        let fb = { ar: st.feedbackText, en: st.feedbackText };
        try {
          fb = JSON.parse(st.feedbackText);
        } catch {
          // fallback plain
        }
        return {
          nodeId: st.nodeId,
          scores: st.scores,
          feedbackAr: fb.ar,
          feedbackEn: fb.en,
          ruleIds: st.ruleIds,
        };
      });

      let historyPoints: Array<{ runIndex: number; avgPct: number; at: string }> | undefined;
      let repeatedLowComp: CompetencyCode | null = null;

      if (req.actor) {
        const pastScores = await db
          .select()
          .from(competencyScores)
          .where(eq(competencyScores.userUid, req.actor.uid));
        const lowByComp = new Map<string, number>();
        for (const ps of pastScores) {
          if (ps.score <= 1) {
            lowByComp.set(ps.competency, (lowByComp.get(ps.competency) ?? 0) + 1);
          }
        }
        for (const [comp, cnt] of lowByComp.entries()) {
          if (cnt >= 1) {
            repeatedLowComp = comp as CompetencyCode;
            break;
          }
        }
      }

      const report = buildSimulationReportPure({
        runId,
        scenarioId: sc.id,
        scenarioTitleAr: sc.titleAr,
        scenarioTitleEn: sc.titleEn,
        competencies: sc.competencies,
        nodes,
        steps: parsedSteps,
        repeatedLowCompetency: repeatedLowComp,
        locale: run.locale as Locale,
      });

      for (const cb of report.competencyBreakdown) {
        await db.insert(competencyScores).values({
          userUid: req.actor?.uid ?? null,
          orgId: req.actor?.activeOrgId ?? null,
          competency: cb.competency,
          score: cb.score,
          maxScore: cb.maxScore,
          runId,
        });
      }

      if (req.actor) {
        const completedRuns = await db
          .select()
          .from(simulationRuns)
          .where(and(eq(simulationRuns.userUid, req.actor.uid), eq(simulationRuns.status, 'completed')));
        historyPoints = [
          ...completedRuns.map((cr, idx) => {
            const rp = cr.reportPayload as SimulationReport | null;
            const avg =
              rp?.competencyBreakdown?.length
                ? Math.round(
                    rp.competencyBreakdown.reduce((a, b) => a + b.pct, 0) /
                      rp.competencyBreakdown.length,
                  )
                : 70;
            return {
              runIndex: idx + 1,
              avgPct: avg,
              at: cr.startedAt.toISOString().slice(0, 10),
            };
          }),
          {
            runIndex: completedRuns.length + 1,
            avgPct: Math.round(
              report.competencyBreakdown.reduce((a, b) => a + b.pct, 0) /
                Math.max(1, report.competencyBreakdown.length),
            ),
            at: new Date().toISOString().slice(0, 10),
          },
        ];
        report.historyPoints = historyPoints;
      }

      await db
        .update(simulationRuns)
        .set({
          status: 'completed',
          currentNodeId: 'end',
          reportPayload: report as unknown as Record<string, unknown>,
          finishedAt: new Date(),
        })
        .where(eq(simulationRuns.id, runId));

      await logAnalytics('simulation_completed', run.locale, req.actor?.activeOrgId);
      res.json({
        finished: true,
        runId,
        stepFeedback: { ar: feedbackAr, en: feedbackEn, ruleIds },
        report,
      });
    } catch (error) {
      console.error('POST /api/simulations/:id/step failed:', error);
      sendApiError(res, 500, 'SIM_STEP_ERROR', 'home.networkError');
    }
  });

  app.get('/api/simulations/:id/report', async (req: AuthenticatedRequest, res) => {
    try {
      const rows = await db
        .select()
        .from(simulationRuns)
        .where(eq(simulationRuns.id, String(req.params.id)))
        .limit(1);
      if (rows.length === 0 || !rows[0].reportPayload) {
        sendApiError(res, 404, 'REPORT_NOT_FOUND', 'notFound.title');
        return;
      }
      const verifiedAnonId = readVerifiedAnonId(req, appEnv.sessionSecret);
      if (!canAccessSimulationRun(req.actor ?? null, verifiedAnonId, rows[0])) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }
      res.json({ report: rows[0].reportPayload });
    } catch (error) {
      console.error('GET /api/simulations/:id/report failed:', error);
      sendApiError(res, 500, 'REPORT_ERROR', 'home.networkError');
    }
  });

  // -------------------------------------------------------------------------
  // 6. Experts, Services & Expert Bridge Requests
  // -------------------------------------------------------------------------

  app.get('/api/experts', async (_req, res) => {
    try {
      const [expList, srvList] = await Promise.all([
        db.select().from(experts).where(eq(experts.active, true)),
        db.select().from(services).where(eq(services.active, true)),
      ]);
      res.json({ experts: expList, services: srvList });
    } catch (error) {
      console.error('GET /api/experts failed:', error);
      sendApiError(res, 500, 'EXPERTS_ERROR', 'home.networkError');
    }
  });

  app.get('/api/experts/:slug', async (req, res) => {
    try {
      const expRows = await db
        .select()
        .from(experts)
        .where(eq(experts.slug, String(req.params.slug)))
        .limit(1);
      if (expRows.length === 0) {
        sendApiError(res, 404, 'EXPERT_NOT_FOUND', 'notFound.title');
        return;
      }
      const ex = expRows[0];
      const allSrv = await db.select().from(services).where(eq(services.active, true));
      const matching = allSrv.filter((s) => s.owner === ex.roleTag || s.owner === 'joint');
      res.json({ expert: ex, services: matching });
    } catch (error) {
      console.error('GET /api/experts/:slug failed:', error);
      sendApiError(res, 500, 'EXPERT_DETAIL_ERROR', 'home.networkError');
    }
  });

  app.post(
    '/api/service-requests',
    requireAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const actor = req.actor!;
        if (!(await checkSharedRateLimit(`srvreq:u:${actor.uid}`, 10, 15 * 60_000))) {
          sendApiError(res, 429, 'RATE_LIMITED', 'errors.rateLimited');
          return;
        }

        const parsed = ServiceRequestInputSchema.safeParse(req.body);
        if (!parsed.success) {
          sendApiError(res, 400, 'INVALID_SERVICE_REQUEST', 'errors.badRequest');
          return;
        }

        if (parsed.data.projectId) {
          const projRows = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)))
            .limit(1);
          if (
            projRows.length === 0 ||
            !can(actor, 'project:read', {
              orgId: projRows[0].orgId,
              ownerUid: projRows[0].ownerUid,
            })
          ) {
            sendApiError(res, 403, 'FORBIDDEN_PROJECT', 'errors.forbidden');
            return;
          }
        }

        const srvRows = await db
          .select()
          .from(services)
          .where(eq(services.id, parsed.data.serviceId))
          .limit(1);
        if (srvRows.length === 0) {
          sendApiError(res, 404, 'SERVICE_NOT_FOUND', 'errors.notFound');
          return;
        }
        const srv = srvRows[0];
        const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const reqId = `REQ-${dateStamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const isFixedPriced = srv.pricingType === 'fixed' && Boolean(srv.priceAmountKwd);

        await db.insert(serviceRequests).values({
          id: reqId,
          requesterUid: actor.uid,
          requesterEmail: parsed.data.requesterEmail,
          requesterName: parsed.data.requesterName,
          orgId: actor.activeOrgId,
          serviceId: srv.id,
          projectId: parsed.data.projectId ?? null,
          triggerSource: parsed.data.triggerSource,
          status: 'new',
          contextShared: parsed.data.contextShared,
          clientNotes: parsed.data.clientNotes,
          assignedOwner: srv.owner,
          quotedAmountKwd: srv.priceAmountKwd,
          paid: false,
        });

        await db.insert(expertSuggestionEvents).values({
          userUid: actor.uid,
          orgId: actor.activeOrgId,
          projectId: parsed.data.projectId ?? null,
          triggerType: parsed.data.triggerSource,
          eventType: 'requested',
        });

        await logAudit(
          actor.uid,
          'service_request.created',
          'service_request',
          reqId,
          actor.activeOrgId,
          req,
        );

        if (isFixedPriced && srv.priceAmountKwd) {
          const checkoutSessionId = `chk_${crypto.randomUUID()}`;
          await db.insert(billingCheckoutSessions).values({
            id: checkoutSessionId,
            provider: billingProvider.name,
            providerSessionId: `pending_${checkoutSessionId}`,
            orgId: actor.activeOrgId,
            userUid: actor.uid,
            kind: 'service',
            targetId: srv.id,
            amountKwd: srv.priceAmountKwd,
            serviceRequestId: reqId,
            serviceOwner: srv.owner,
            status: 'pending',
            expiresAt: new Date(Date.now() + 3600_000),
          });

          const created = await billingProvider.createCheckoutSession({
            checkoutSessionId,
            orgId: actor.activeOrgId,
            userUid: actor.uid,
            kind: 'service',
            targetId: srv.id,
            title: srv.titleEn,
            amountKwd: srv.priceAmountKwd,
            successPath: `/experts?request=${encodeURIComponent(reqId)}`,
            cancelPath: `/request/${encodeURIComponent(srv.id)}`,
          });

          await db
            .update(billingCheckoutSessions)
            .set({ providerSessionId: created.providerSessionId })
            .where(eq(billingCheckoutSessions.id, checkoutSessionId));

          res.status(201).json({
            id: reqId,
            paid: false,
            checkoutSessionId,
            providerSessionId: created.providerSessionId,
            checkoutUrl: created.checkoutUrl,
            provider: billingProvider.name,
          });
          return;
        }

        res.status(201).json({ id: reqId, paid: false });
      } catch (error) {
        console.error('POST /api/service-requests failed:', error);
        sendApiError(res, 500, 'SERVICE_REQ_ERROR', 'errors.serverError');
      }
    },
  );

  // -------------------------------------------------------------------------
  // 7. Plans, Checkout, Idempotent Webhook & Invoices
  // -------------------------------------------------------------------------

  app.get('/api/plans', async (_req, res) => {
    try {
      const [planRows, srvRows] = await Promise.all([
        db.select().from(plans),
        db.select().from(services).where(eq(services.active, true)),
      ]);
      const sorted = planRows.sort((a, b) => a.sortOrder - b.sortOrder);
      const enriched = await Promise.all(
        sorted.map(async (p) => ({
          ...p,
          entitlements: await getOrgEntitlementsForPlan(p.id),
        })),
      );
      res.json({ plans: enriched, services: srvRows });
    } catch (error) {
      console.error('GET /api/plans failed:', error);
      sendApiError(res, 500, 'PLANS_ERROR', 'home.networkError');
    }
  });

  async function getOrgEntitlementsForPlan(planId: string) {
    const map: Record<string, Record<string, string>> = {
      free: { results_per_month: '15', projects_max: '1', seats: '1', watermark: 'true' },
      individual: { results_per_month: '150', projects_max: '20', seats: '1', watermark: 'false' },
      pro: { results_per_month: '500', projects_max: '200', seats: '1', watermark: 'false' },
      team: { results_per_month: '2000', projects_max: '1000', seats: '10', watermark: 'false' },
      enterprise: { results_per_month: '10000', projects_max: '5000', seats: '50', watermark: 'false' },
    };
    return map[planId] || map.free;
  }

  app.post('/api/billing/checkout', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'org:manage_billing', { orgId: actor.activeOrgId })) {
        sendApiError(res, 403, 'BILLING_FORBIDDEN', 'errors.forbidden');
        return;
      }

      const planId = String(req.body?.planId || '').trim();
      const billingCycle = req.body?.billingCycle === 'annual' ? 'annual' : 'monthly';
      const planRows = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
      if (planRows.length === 0) {
        sendApiError(res, 404, 'PLAN_NOT_FOUND', 'errors.notFound');
        return;
      }
      const p = planRows[0];
      if (p.isQuote || p.id === 'free') {
        sendApiError(res, 400, 'INVALID_CHECKOUT_PLAN', 'errors.badRequest');
        return;
      }

      const amount = billingCycle === 'annual' ? p.annualPriceKwd : p.monthlyPriceKwd;
      const checkoutSessionId = `chk_${crypto.randomUUID()}`;
      const placeholderProviderSessionId = `pending_${checkoutSessionId}`;

      await db.insert(billingCheckoutSessions).values({
        id: checkoutSessionId,
        provider: billingProvider.name,
        providerSessionId: placeholderProviderSessionId,
        orgId: actor.activeOrgId,
        userUid: actor.uid,
        kind: 'subscription',
        targetId: p.id,
        billingCycle,
        amountKwd: amount,
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600_000),
      });

      const created = await billingProvider.createCheckoutSession({
        checkoutSessionId,
        orgId: actor.activeOrgId,
        userUid: actor.uid,
        kind: 'subscription',
        targetId: p.id,
        title: `WIJAHA ${p.nameEn} (${billingCycle})`,
        amountKwd: amount,
        billingCycle,
        successPath: '/pricing?checkout=success',
        cancelPath: '/pricing?checkout=cancelled',
      });

      await db
        .update(billingCheckoutSessions)
        .set({ providerSessionId: created.providerSessionId })
        .where(eq(billingCheckoutSessions.id, checkoutSessionId));

      await logAudit(
        actor.uid,
        'billing.checkout_created',
        'plan',
        p.id,
        actor.activeOrgId,
        req,
      );

      res.json({
        ok: true,
        sessionId: checkoutSessionId,
        providerSessionId: created.providerSessionId,
        checkoutUrl: created.checkoutUrl,
        provider: billingProvider.name,
      });
    } catch (error) {
      console.error('POST /api/billing/checkout failed:', error);
      sendApiError(res, 500, 'CHECKOUT_ERROR', 'errors.serverError');
    }
  });

  if (!appEnv.isProduction && appEnv.BILLING_PROVIDER === 'mock') {
    app.post(
      '/api/billing/dev-mock-complete',
      requireAuthenticated,
      async (req: AuthenticatedRequest, res) => {
        try {
          const actor = req.actor!;
          const sessionId = String(req.body?.sessionId || '').trim();
          if (!sessionId) {
            sendApiError(res, 400, 'MISSING_SESSION_ID', 'errors.badRequest');
            return;
          }
          const rows = await db
            .select()
            .from(billingCheckoutSessions)
            .where(eq(billingCheckoutSessions.id, sessionId))
            .limit(1);
          if (rows.length === 0) {
            sendApiError(res, 404, 'SESSION_NOT_FOUND', 'errors.notFound');
            return;
          }
          const sessionRow = rows[0];
          if (
            sessionRow.userUid !== actor.uid &&
            !can(actor, 'org:manage_billing', { orgId: sessionRow.orgId })
          ) {
            sendApiError(res, 403, 'BILLING_FORBIDDEN', 'errors.forbidden');
            return;
          }

          const payloadJson = JSON.stringify({
            eventId: `evt_mock_${sessionRow.id}`,
            eventType: 'checkout.completed',
            checkoutSessionId: sessionRow.id,
            providerSessionId: sessionRow.providerSessionId,
          });
          const rawBuf = Buffer.from(payloadJson, 'utf8');
          const sig = billingProvider.signMockWebhookPayload?.(payloadJson) || '';
          if (!billingProvider.verifyWebhook(rawBuf, { 'x-wijaha-mock-signature': sig })) {
            sendApiError(res, 400, 'MOCK_SIGNATURE_FAILED', 'errors.badRequest');
            return;
          }

          const out = await processBillingWebhook({
            eventId: `evt_mock_${sessionRow.id}`,
            provider: billingProvider.name,
            eventType:
              sessionRow.kind === 'service' ? 'service.paid' : 'subscription.activated',
            orgId: sessionRow.orgId,
            userUid: sessionRow.userUid,
            targetId: sessionRow.targetId,
            billingCycle: sessionRow.billingCycle === 'annual' ? 'annual' : 'monthly',
            amountKwd: sessionRow.amountKwd,
            serviceRequestId: sessionRow.serviceRequestId,
            serviceOwner: (sessionRow.serviceOwner as 'yousef' | 'ahmad' | 'joint' | null) ?? undefined,
            checkoutSessionId: sessionRow.id,
          });

          await logAnalytics('checkout_completed', 'ar', sessionRow.orgId, undefined, {
            targetId: sessionRow.targetId,
            kind: sessionRow.kind,
          });
          await logAudit(
            actor.uid,
            'billing.dev_mock_completed',
            sessionRow.kind,
            sessionRow.targetId,
            sessionRow.orgId,
            req,
          );
          res.json({ ok: true, ...out });
        } catch (error) {
          console.error('POST /api/billing/dev-mock-complete failed:', error);
          sendApiError(res, 500, 'MOCK_COMPLETE_ERROR', 'errors.serverError');
        }
      },
    );
  }

  app.post('/api/billing/cancel', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'org:manage_billing', { orgId: actor.activeOrgId })) {
        sendApiError(res, 403, 'BILLING_FORBIDDEN', 'errors.forbidden');
        return;
      }

      const subRows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.orgId, actor.activeOrgId))
        .limit(1);

      await billingProvider.cancelSubscription({
        orgId: actor.activeOrgId,
        providerRef: subRows[0]?.providerRef ?? null,
      });

      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, status: 'cancelled', updatedAt: new Date() })
        .where(eq(subscriptions.orgId, actor.activeOrgId));
      await db
        .update(orgs)
        .set({ planId: 'free', updatedAt: new Date() })
        .where(eq(orgs.id, actor.activeOrgId));

      await logAnalytics('subscription_cancelled', 'ar', actor.activeOrgId);
      await logAudit(
        actor.uid,
        'billing.subscription_cancelled',
        'org',
        actor.activeOrgId,
        actor.activeOrgId,
        req,
      );
      res.json({ ok: true });
    } catch (error) {
      console.error('POST /api/billing/cancel failed:', error);
      sendApiError(res, 500, 'CANCEL_ERROR', 'errors.serverError');
    }
  });

  app.get('/api/billing/invoices', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const list = await db
        .select()
        .from(invoices)
        .where(eq(invoices.orgId, actor.activeOrgId))
        .orderBy(desc(invoices.issuedAt));
      res.json({ invoices: list });
    } catch (error) {
      console.error('GET /api/billing/invoices failed:', error);
      sendApiError(res, 500, 'INVOICES_ERROR', 'home.networkError');
    }
  });

  // -------------------------------------------------------------------------
  // 8. Admin Console Endpoints (/api/admin/* — Strictly RBAC Protected)
  // -------------------------------------------------------------------------

  app.use('/api/admin', (req: AuthenticatedRequest, res, next) => {
    if (!can(req.actor ?? null, 'admin:access')) {
      sendApiError(res, 403, 'ADMIN_FORBIDDEN', 'errors.forbidden');
      return;
    }
    if (appEnv.enforceAdminMfa && !req.actor!.mfaVerified) {
      sendApiError(res, 403, 'MFA_REQUIRED', 'errors.mfaRequired');
      return;
    }
    next();
  });

  app.get('/api/admin/overview', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      const canSeeAllRequests = can(actor, 'admin:requests:all');
      const canSeeOwnRequests = can(actor, 'admin:requests:own');
      const canSeeFinance = can(actor, 'admin:finance');
      const canSeeEvals = can(actor, 'admin:evals');

      const [
        allRules,
        allReqs,
        allFeedback,
        allEvents,
        latestEvals,
        splitRules,
        ledgerRows,
        srcRows,
        expRows,
      ] = await Promise.all([
        db.select().from(knowledgeRules),
        canSeeAllRequests || canSeeOwnRequests
          ? db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt))
          : Promise.resolve([]),
        db.select().from(feedback).orderBy(desc(feedback.createdAt)),
        db.select().from(analyticsEvents),
        canSeeEvals
          ? db.select().from(evalRuns).orderBy(desc(evalRuns.createdAt)).limit(5)
          : Promise.resolve([]),
        canSeeFinance ? db.select().from(revenueSplitRules) : Promise.resolve([]),
        canSeeFinance
          ? db.select().from(revenueLedger).orderBy(desc(revenueLedger.createdAt))
          : Promise.resolve([]),
        db.select().from(sources),
        db.select().from(experts),
      ]);

      let visibleServiceRequests = allReqs;
      if (!canSeeAllRequests) {
        if (canSeeOwnRequests) {
          const ownerTag = resolveExpertOwnerTag(actor);
          visibleServiceRequests = ownerTag
            ? allReqs.filter((r) => r.assignedOwner === ownerTag || r.assignedOwner === 'joint')
            : [];
        } else {
          visibleServiceRequests = [];
        }
      }

      if (visibleServiceRequests.length > 0) {
        await logAudit(
          actor.uid,
          'admin.view_service_requests',
          'service_request',
          'overview',
          null,
          req,
          { visibleCount: visibleServiceRequests.length, role: actor.platformRole },
        );
      }

      const soonCutoff = new Date(Date.now() + 30 * 24 * 3600_000).toISOString().slice(0, 10);
      const expiringSoon = allRules.filter((r) => r.reviewDueAt <= soonCutoff);

      res.json({
        stats: {
          totalRules: allRules.length,
          approvedRules: allRules.filter((r) => r.status === 'approved').length,
          demoRules: allRules.filter((r) => r.status === 'draft_demo').length,
          inReviewRules: allRules.filter((r) => r.status === 'in_review').length,
          expiringWithin30Days: expiringSoon.length,
          openServiceRequests: visibleServiceRequests.filter((r) => r.status !== 'closed').length,
          errorReports: allFeedback.filter((f) => f.reportedError).length,
          completedResultsCount: allEvents.filter((e) => e.eventName === 'result_completed').length,
          estimatedAiCostKwd: Number(
            (allEvents.filter((e) => e.eventName === 'result_completed').length * 0.002).toFixed(3),
          ),
        },
        rules: allRules,
        sources: srcRows,
        experts: expRows,
        serviceRequests: visibleServiceRequests,
        errorReports: allFeedback.filter((f) => f.reportedError),
        evalRuns: latestEvals,
        revenueSplitRules: splitRules,
        revenueLedger: ledgerRows,
      });
    } catch (error) {
      console.error('GET /api/admin/overview failed:', error);
      sendApiError(res, 500, 'ADMIN_OVERVIEW_ERROR', 'home.networkError');
    }
  });

  app.post('/api/admin/rules', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'content:edit')) {
        sendApiError(res, 403, 'FORBIDDEN', 'admin.title');
        return;
      }

      const id = String(req.body?.id || `R-CUSTOM-${Math.floor(1000 + Math.random() * 9000)}`);
      const titleAr = String(req.body?.titleAr || '').trim();
      const titleEn = String(req.body?.titleEn || '').trim();
      const bodyAr = String(req.body?.bodyAr || '').trim();
      const bodyEn = String(req.body?.bodyEn || '').trim();
      if (!titleAr || !titleEn || !bodyAr || !bodyEn) {
        sendApiError(res, 400, 'MISSING_RULE_FIELDS', 'admin.tabs.content');
        return;
      }

      const countries = Array.isArray(req.body?.countries) ? req.body.countries.map(String) : ['GLOBAL'];
      const topics = Array.isArray(req.body?.topics) ? req.body.topics.map(String) : ['general'];
      const contexts = Array.isArray(req.body?.contexts) ? req.body.contexts.map(String) : ['business'];
      const level = ['official', 'customary', 'advisory'].includes(req.body?.level)
        ? req.body.level
        : 'customary';
      const sensitivity = ['low', 'medium', 'high'].includes(req.body?.sensitivity)
        ? req.body.sensitivity
        : 'low';
      const status = req.body?.submitForReview ? 'in_review' : 'draft';

      const conflicts = await detectSimilarRules({
        titleAr,
        bodyAr,
        countries,
        topics,
        excludeId: id,
      });

      const embAr = computeDeterministicEmbedding(`${titleAr} ${bodyAr}`);
      const embEn = computeDeterministicEmbedding(`${titleEn} ${bodyEn}`);
      const normSearch = normalizeArabic(`${titleAr} ${bodyAr} ${titleEn} ${bodyEn}`);

      await db
        .insert(knowledgeRules)
        .values({
          id,
          titleAr,
          titleEn,
          bodyAr,
          bodyEn,
          level,
          topics,
          countries,
          contexts,
          sensitivity,
          sources: [{ sourceId: 'S-DEMO-001', locator: 'إدخال لوحة المحتوى' }],
          status,
          authorUid: actor.uid,
          reviewDueAt: String(req.body?.reviewDueAt || '2027-06-01'),
          version: 1,
          embeddingAr: embAr,
          embeddingEn: embEn,
          normalizedSearchText: normSearch,
        })
        .onConflictDoUpdate({
          target: knowledgeRules.id,
          set: {
            titleAr,
            titleEn,
            bodyAr,
            bodyEn,
            level,
            topics,
            countries,
            contexts,
            sensitivity,
            status,
            embeddingAr: embAr,
            embeddingEn: embEn,
            normalizedSearchText: normSearch,
            updatedAt: new Date(),
          },
        });
      // E2: index the new rule semantically in the background; lexical search still works if this fails.
      void embedAndStoreRule({ id, titleAr, titleEn, bodyAr, bodyEn }).catch((err) =>
        console.warn('embedAndStoreRule failed:', (err as Error).message),
      );

      await db.insert(knowledgeRuleVersions).values({
        ruleId: id,
        version: 1,
        snapshot: { titleAr, titleEn, bodyAr, bodyEn, level, sensitivity, status },
        changedByUid: actor.uid,
        changeNote: 'حفظ من محرر المحتوى ثنائي اللغة',
      });

      await logAudit(actor.uid, 'content.save_rule', 'knowledge_rule', id, null, req);
      res.status(201).json({ ok: true, id, conflicts });
    } catch (error) {
      console.error('POST /api/admin/rules failed:', error);
      sendApiError(res, 500, 'ADMIN_RULE_SAVE_ERROR', 'home.networkError');
    }
  });

  app.patch('/api/admin/rules/:id/status', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'admin:content')) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }
      const ruleId = String(req.params.id);
      const parsedStatus = RuleStatusSchema.safeParse(req.body?.status);
      if (!parsedStatus.success) {
        sendApiError(res, 400, 'INVALID_RULE_STATUS', 'errors.validationError');
        return;
      }
      const nextStatus = parsedStatus.data;
      const reviewNote = String(req.body?.reviewNote || '').slice(0, 1000);

      const rows = await db
        .select()
        .from(knowledgeRules)
        .where(eq(knowledgeRules.id, ruleId))
        .limit(1);
      if (rows.length === 0) {
        sendApiError(res, 404, 'RULE_NOT_FOUND', 'notFound.title');
        return;
      }
      const rule = rows[0];

      if (!canTransitionRuleStatus(rule.status, nextStatus)) {
        sendApiError(res, 400, 'INVALID_RULE_TRANSITION', 'errors.invalidRuleTransition', {
          from: rule.status,
          to: nextStatus,
        });
        return;
      }

      if (nextStatus === 'approved') {
        const neededAction =
          rule.sensitivity === 'high'
            ? 'content:approve_high_sensitivity'
            : 'content:approve_standard';
        if (!can(actor, neededAction)) {
          sendApiError(res, 403, 'SENIOR_REVIEWER_REQUIRED', 'errors.forbidden');
          return;
        }
      }

      await db
        .update(knowledgeRules)
        .set({
          status: nextStatus,
          reviewedBy: nextStatus === 'approved' ? actor.name : rule.reviewedBy,
          reviewedAt:
            nextStatus === 'approved' ? new Date().toISOString().slice(0, 10) : rule.reviewedAt,
          reviewNote,
          version: rule.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeRules.id, ruleId));

      await db.insert(knowledgeRuleVersions).values({
        ruleId,
        version: rule.version + 1,
        snapshot: {
          titleAr: rule.titleAr,
          titleEn: rule.titleEn,
          bodyAr: rule.bodyAr,
          bodyEn: rule.bodyEn,
          level: rule.level,
          sensitivity: rule.sensitivity,
          status: nextStatus,
        },
        changedByUid: actor.uid,
        changeNote: reviewNote || `status: ${rule.status} -> ${nextStatus}`,
      });

      await logAudit(actor.uid, `content.status_${nextStatus}`, 'knowledge_rule', ruleId, null, req);
      res.json({ ok: true, status: nextStatus });
    } catch (error) {
      console.error('PATCH /api/admin/rules/:id/status failed:', error);
      sendApiError(res, 500, 'ADMIN_RULE_STATUS_ERROR', 'home.networkError');
    }
  });

  app.patch('/api/admin/requests/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'admin:requests:own')) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }
      const reqId = String(req.params.id);
      const existingRows = await db
        .select()
        .from(serviceRequests)
        .where(eq(serviceRequests.id, reqId))
        .limit(1);
      if (existingRows.length === 0) {
        sendApiError(res, 404, 'REQUEST_NOT_FOUND', 'notFound.title');
        return;
      }
      if (!can(actor, 'admin:requests:all')) {
        const ownerTag = resolveExpertOwnerTag(actor);
        if (
          !ownerTag ||
          (existingRows[0].assignedOwner !== ownerTag && existingRows[0].assignedOwner !== 'joint')
        ) {
          sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
          return;
        }
      }

      const updates: Partial<typeof serviceRequests.$inferInsert> = { updatedAt: new Date() };
      if (req.body?.status) updates.status = String(req.body.status);
      if (req.body?.internalNotes !== undefined)
        updates.internalNotes = String(req.body.internalNotes);
      if (req.body?.deliveryNotes !== undefined)
        updates.deliveryNotes = String(req.body.deliveryNotes);
      if (req.body?.quotedAmountKwd !== undefined)
        updates.quotedAmountKwd = Number(req.body.quotedAmountKwd);

      await db.update(serviceRequests).set(updates).where(eq(serviceRequests.id, reqId));
      await logAudit(actor.uid, 'crm.update_request', 'service_request', reqId, null, req);
      res.json({ ok: true });
    } catch (error) {
      console.error('PATCH /api/admin/requests/:id failed:', error);
      sendApiError(res, 500, 'CRM_UPDATE_ERROR', 'home.networkError');
    }
  });

  app.patch('/api/admin/experts/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (actor.platformRole !== 'platform_admin' && actor.platformRole !== 'expert' && actor.platformRole !== 'senior_reviewer') {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }
      const expertId = String(req.params.id || '').trim();
      const avatarUrl = String(req.body?.avatarUrl ?? '').trim();
      if (
        avatarUrl !== '' &&
        !avatarUrl.startsWith('https://') &&
        !avatarUrl.startsWith('/assets/')
      ) {
        sendApiError(res, 400, 'INVALID_AVATAR_URL', 'errors.badRequest');
        return;
      }

      const expRows = await db.select().from(experts).where(eq(experts.id, expertId)).limit(1);
      if (expRows.length === 0) {
        sendApiError(res, 404, 'EXPERT_NOT_FOUND', 'errors.notFound');
        return;
      }

      if (actor.platformRole === 'expert') {
        const emailLower = actor.email.toLowerCase();
        const roleTag = expRows[0].roleTag;
        if (!emailLower.includes(roleTag) && !actor.uid.includes(roleTag)) {
          sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
          return;
        }
      }

      await db.update(experts).set({ avatarUrl }).where(eq(experts.id, expertId));
      await logAudit(actor.uid, 'expert.update_avatar', 'expert', expertId, null, req);
      res.json({ ok: true, avatarUrl });
    } catch (error) {
      console.error('PATCH /api/admin/experts/:id failed:', error);
      sendApiError(res, 500, 'EXPERT_AVATAR_ERROR', 'errors.serverError');
    }
  });

  app.patch('/api/admin/revenue-splits', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'revenue:configure')) {
        sendApiError(res, 403, 'FORBIDDEN', 'admin.tabs.analytics');
        return;
      }
      const ownerType = String(req.body?.ownerType || 'yousef');
      const platformSharePct =
        req.body?.platformSharePct === null || req.body?.platformSharePct === ''
          ? null
          : Number(req.body.platformSharePct);
      const yousefSharePct =
        req.body?.yousefSharePct === null || req.body?.yousefSharePct === ''
          ? null
          : Number(req.body.yousefSharePct);
      const ahmadSharePct =
        req.body?.ahmadSharePct === null || req.body?.ahmadSharePct === ''
          ? null
          : Number(req.body.ahmadSharePct);

      await db
        .update(revenueSplitRules)
        .set({
          platformSharePct,
          yousefSharePct,
          ahmadSharePct,
          notes: String(req.body?.notes || ''),
          updatedAt: new Date(),
        })
        .where(eq(revenueSplitRules.ownerType, ownerType));

      await logAudit(actor.uid, 'revenue.update_split', 'revenue_split', ownerType, null, req);
      res.json({ ok: true });
    } catch (error) {
      console.error('PATCH /api/admin/revenue-splits failed:', error);
      sendApiError(res, 500, 'REVENUE_SPLIT_ERROR', 'home.networkError');
    }
  });

  app.post('/api/admin/evals/run', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'admin:evals')) {
        sendApiError(res, 403, 'FORBIDDEN', 'errors.forbidden');
        return;
      }

      const evalRateAllowed = await checkSharedRateLimit(
        `admin_evals_run:${actor.uid}`,
        3,
        15 * 60_000,
      );
      if (!evalRateAllowed) {
        sendApiError(res, 429, 'RATE_LIMITED', 'errors.rateLimited');
        return;
      }

      const costCheck = await db.execute(
        `SELECT COALESCE(SUM(estimated_cost_kwd), 0) AS total FROM ai_calls WHERE created_at >= CURRENT_DATE`,
      );
      const todayCostKwd = Number((costCheck.rows[0] as { total?: string | number })?.total || 0);
      if (todayCostKwd >= appEnv.AI_DAILY_PLATFORM_CAP_KWD) {
        sendApiError(res, 429, 'COST_CAP_REACHED', 'errors.costCapReached');
        return;
      }

      const [cases, rules] = await Promise.all([
        db.select().from(evalCases),
        db.select().from(knowledgeRules),
      ]);

      let intentHits = 0;
      let recallHits = 0;
      let recallTotal = 0;
      let schemaHits = 0;
      let highSensTotal = 0;
      let highSensHits = 0;
      let hallucinatedRulesCount = 0;

      const validIdSet = new Set(rules.map((r) => r.id));

      for (const c of cases) {
        const entities = await understandQuery(c.queryText, (c.locale as 'ar' | 'en') ?? 'ar');
        if (entities.intent === c.expectedIntent) intentHits += 1;

        const retrieved = scoreRulesPure(rules, {
          query: c.queryText,
          locale: c.locale as Locale,
          intent: entities.intent,
          countryIso: entities.countryIso,
          topK: 10,
        });

        if (c.expectedRuleIds.length > 0) {
          recallTotal += 1;
          const retSet = new Set(retrieved.map((r) => r.id));
          if (c.expectedRuleIds.some((id) => retSet.has(id))) {
            recallHits += 1;
          }
        }

        const out = await executeWijahaPipeline({
          rawQuery: c.queryText,
          locale: c.locale as Locale,
          retrievedRules: retrieved,
          entities,
        });

        schemaHits += 1;
        for (const rId of out.trust.ruleIds) {
          if (!validIdSet.has(rId)) hallucinatedRulesCount += 1;
        }

        if (c.expectedSensitivity === 'high') {
          highSensTotal += 1;
          if (out.blocks.some((b) => b.type === 'expert_review')) {
            highSensHits += 1;
          }
        }
      }

      const total = Math.max(1, cases.length);
      const runRecord = {
        id: `eval_${crypto.randomUUID().slice(0, 10)}`,
        providerUsed: getAiProviderStatus().mode,
        totalCases: cases.length,
        intentAccuracyPct: Math.round((intentHits / total) * 100),
        recallPct: Math.round((recallHits / Math.max(1, recallTotal)) * 100),
        schemaPassPct: Math.round((schemaHits / total) * 100),
        highSensitivityPassPct: Math.round((highSensHits / Math.max(1, highSensTotal)) * 100),
        hallucinatedRulesCount,
        summaryJson: { ranAt: new Date().toISOString() },
      };

      await db.insert(evalRuns).values(runRecord);
      await logAudit(actor.uid, 'admin.run_evals', 'eval_run', runRecord.id, null, req);
      res.json({ evalRun: runRecord });
    } catch (error) {
      console.error('POST /api/admin/evals/run failed:', error);
      sendApiError(res, 500, 'EVAL_RUN_ERROR', 'home.networkError');
    }
  });

  return app;
}

async function startServer() {
  const app = await buildExpressApp();

  if (process.env.NODE_ENV !== 'production' && process.env.SERVE_STATIC !== 'true') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        const html = fs.readFileSync(indexFile, 'utf8');
        const nonce = String(res.locals.cspNonce || '');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(injectNonceIntoHtml(html, nonce));
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WIJAHA Modular Monolith listening on http://0.0.0.0:${PORT}`);
  });
}

// Start listener when invoked directly as server entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}
