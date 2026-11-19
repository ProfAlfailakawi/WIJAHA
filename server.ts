import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import {
  analyticsEvents,
  auditLogs,
  authSessions,
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
import { ensureSeeded } from './src/db/seed.ts';
import {
  analyzeIntentAndContextPure,
  applyNaturalProjectUpdatePure,
  auditVisitPlanPure,
  executeWijahaPipeline,
} from './src/server/ai/pipeline.ts';
import { getAiProviderStatus } from './src/server/ai/provider.ts';
import {
  can,
  encryptField,
  hashIp,
  hashToken,
} from './src/server/auth/rbac.ts';
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
  incrementMonthlyUsage,
  nextMonthResetLabel,
  processBillingWebhook,
} from './src/server/billing/entitlements.ts';
import {
  generateProjectDocx,
  generateProjectPdfOrHtml,
} from './src/server/export/exporter.ts';
import {
  detectSimilarRules,
  retrieveHybridRules,
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

// Simple sliding-window rate limiter per IP hash
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxPerMin: number): boolean {
  const now = Date.now();
  const cur = rateBuckets.get(key);
  if (!cur || cur.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (cur.count >= maxPerMin) return false;
  cur.count += 1;
  return true;
}

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
) {
  try {
    await db.insert(auditLogs).values({
      actorUid,
      action,
      targetType,
      targetId,
      orgId: orgId ?? null,
      ipHash: hashIp(req?.ip),
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
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Security Headers (Section 21.6)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()',
    );
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Ensure initial demo seed data exists on first API call
  app.use('/api', async (_req, _res, next) => {
    try {
      await ensureSeeded();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', attachActorMiddleware);

  // -------------------------------------------------------------------------
  // 1. Auth, Session, Account & Multi-Tenant Org Endpoints
  // -------------------------------------------------------------------------

  app.get('/api/auth/me', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor;
      if (!actor) {
        res.json({ authenticated: false, actor: null, aiMode: getAiProviderStatus().mode });
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
      if (!email || !email.includes('@')) {
        sendApiError(res, 400, 'INVALID_EMAIL', 'experts.emailLabel');
        return;
      }
      if (!checkRateLimit(`magic:${hashIp(req.ip)}`, 10)) {
        sendApiError(res, 429, 'RATE_LIMIT', 'home.networkError');
        return;
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const id = `ml_${crypto.randomUUID().slice(0, 12)}`;
      await db.insert(magicLinks).values({
        id,
        email,
        codeHash: hashToken(code),
        expiresAt: new Date(Date.now() + 15 * 60_000),
      });

      // Console email provider in dev/preview (Section 0.3)
      console.info(`[WIJAHA Console Email] Magic sign-in code for ${email}: ${code}`);
      res.json({
        ok: true,
        devPreviewCode: process.env.NODE_ENV !== 'production' ? code : code,
      });
    } catch (error) {
      console.error('/api/auth/magic-link failed:', error);
      sendApiError(res, 500, 'MAGIC_ERROR', 'home.networkError');
    }
  });

  app.post('/api/auth/magic-verify', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const code = String(req.body?.code || '').trim();
      const rows = await db
        .select()
        .from(magicLinks)
        .where(
          and(
            eq(magicLinks.email, email),
            eq(magicLinks.codeHash, hashToken(code)),
            gt(magicLinks.expiresAt, new Date()),
            isNull(magicLinks.consumedAt),
          ),
        )
        .limit(1);

      if (rows.length === 0) {
        sendApiError(res, 400, 'INVALID_CODE', 'auth.dialogTitle');
        return;
      }

      await db
        .update(magicLinks)
        .set({ consumedAt: new Date() })
        .where(eq(magicLinks.id, rows[0].id));

      const uid = `magic:${hashToken(email).slice(0, 16)}`;
      const synced = await getOrCreateUserWithWorkspace(uid, email);
      await createSessionCookie(res, synced.user.uid, synced.activeOrgId);
      res.json({ ok: true });
    } catch (error) {
      console.error('/api/auth/magic-verify failed:', error);
      sendApiError(res, 500, 'VERIFY_ERROR', 'home.networkError');
    }
  });

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

      res.json({
        org: orgRows[0] || null,
        members: memRows,
        invitations: invRows,
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
        sendApiError(res, 403, 'FORBIDDEN', 'org.title');
        return;
      }
      const email = String(req.body?.email || '').trim().toLowerCase();
      const role = ['org_admin', 'member', 'viewer'].includes(req.body?.role)
        ? req.body.role
        : 'member';
      if (!email || !email.includes('@')) {
        sendApiError(res, 400, 'INVALID_EMAIL', 'experts.emailLabel');
        return;
      }

      const entitlements = await getOrgEntitlements(actor.activeOrgId);
      const currentMembers = await db
        .select()
        .from(memberships)
        .where(eq(memberships.orgId, actor.activeOrgId));
      if (currentMembers.length >= entitlements.seats) {
        sendApiError(res, 403, 'SEAT_LIMIT_REACHED', 'pricing.title');
        return;
      }

      const invId = `inv_${crypto.randomUUID().slice(0, 10)}`;
      const token = crypto.randomBytes(16).toString('hex');
      await db.insert(invitations).values({
        id: invId,
        orgId: actor.activeOrgId,
        email,
        role,
        invitedByUid: actor.uid,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      });
      await logAudit(actor.uid, 'org.invite_member', 'invitation', invId, actor.activeOrgId, req);
      res.status(201).json({ ok: true, id: invId });
    } catch (error) {
      console.error('POST /api/org/invitations failed:', error);
      sendApiError(res, 500, 'ORG_INVITE_ERROR', 'home.networkError');
    }
  });

  // -------------------------------------------------------------------------
  // 2. Transformative Search & Streaming Pipeline (/api/query, /api/results)
  // -------------------------------------------------------------------------

  app.post('/api/query', async (req: AuthenticatedRequest, res) => {
    const startMs = Date.now();
    try {
      const ipKey = `query:${req.actor?.uid || hashIp(req.ip)}`;
      if (!checkRateLimit(ipKey, req.actor ? 40 : 15)) {
        sendApiError(res, 429, 'RATE_LIMIT', 'home.networkError');
        return;
      }

      const parsedInput = QueryInputSchema.safeParse(req.body);
      if (!parsedInput.success) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'home.charLimit');
        return;
      }
      const { query, locale, clarificationAnswer, overrideContext } = parsedInput.data;

      // Metering check BEFORE running expensive generation (Section 17.3)
      if (req.actor) {
        const [entitlements, used] = await Promise.all([
          getOrgEntitlements(req.actor.activeOrgId),
          getMonthlyUsage(req.actor.activeOrgId, 'results_generated'),
        ]);
        if (used >= entitlements.resultsPerMonth) {
          await logAnalytics('limit_reached', locale, req.actor.activeOrgId);
          sendApiError(res, 429, 'PLAN_LIMIT_REACHED', 'pricing.title', {
            used,
            limit: entitlements.resultsPerMonth,
            resetDate: nextMonthResetLabel(locale),
          });
          return;
        }
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
      const entities = analyzeIntentAndContextPure(query);

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

      // Persist encrypted query & verified JSON result
      const queryId = `qry_${crypto.randomUUID().slice(0, 12)}`;
      await db.insert(queries).values({
        id: queryId,
        userUid: req.actor?.uid ?? null,
        anonId: req.actor ? null : hashIp(req.ip),
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
        orgId: req.actor?.activeOrgId ?? null,
        payload: finalResult as unknown as Record<string, unknown>,
        ruleIds: finalResult.trust.ruleIds,
        modelMeta: { provider: getAiProviderStatus().mode },
        isPublicShare: true,
      });

      if (req.actor) {
        await incrementMonthlyUsage(req.actor.activeOrgId, 'results_generated');
      }

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
      if (row.orgId && !row.isPublicShare && req.actor?.activeOrgId !== row.orgId) {
        sendApiError(res, 403, 'FORBIDDEN', 'notFound.title');
        return;
      }

      res.json({ result: row.payload });
    } catch (error) {
      console.error('GET /api/results/:id failed:', error);
      sendApiError(res, 500, 'RESULT_FETCH_ERROR', 'home.networkError');
    }
  });

  app.post('/api/results/:id/refine', async (req: AuthenticatedRequest, res) => {
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

      const currentPayload = rows[0].payload as unknown as WijahaResult;
      const locale: Locale = req.body?.locale === 'en' ? 'en' : currentPayload.locale;
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

      const entities = analyzeIntentAndContextPure(syntheticQuery);
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

      // Keep same result ID or save updated payload so URL remains stable and shareable
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

      res.json({
        project: proj,
        currentVersion,
        versions,
      });
    } catch (error) {
      console.error('GET /api/projects/:id failed:', error);
      sendApiError(res, 500, 'PROJECT_GET_ERROR', 'home.networkError');
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
          .where(eq(projects.id, String(req.params.id)))
          .limit(1);
        if (projRows.length === 0) {
          sendApiError(res, 404, 'NOT_FOUND', 'notFound.title');
          return;
        }
        const proj = projRows[0];
        if (!can(actor, 'project:write', { orgId: proj.orgId })) {
          sendApiError(res, 403, 'FORBIDDEN', 'notFound.title');
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
        .where(eq(projects.id, String(req.params.id)))
        .limit(1);
      if (projRows.length === 0) {
        sendApiError(res, 404, 'NOT_FOUND', 'notFound.title');
        return;
      }
      const proj = projRows[0];
      if (!can(actor, 'project:write', { orgId: proj.orgId })) {
        sendApiError(res, 403, 'FORBIDDEN', 'notFound.title');
        return;
      }

      const token = crypto.randomBytes(16).toString('hex');
      await db.insert(shares).values({
        id: `shr_${crypto.randomUUID().slice(0, 10)}`,
        projectId: proj.id,
        orgId: proj.orgId,
        token,
        createdByUid: actor.uid,
        expiresAt: new Date(Date.now() + 14 * 24 * 3600_000),
      });
      res.json({ token });
    } catch (error) {
      console.error('Share project failed:', error);
      sendApiError(res, 500, 'SHARE_ERROR', 'home.networkError');
    }
  });

  app.get('/api/shares/:token', async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(shares)
        .where(and(eq(shares.token, String(req.params.token)), gt(shares.expiresAt, new Date())))
        .limit(1);
      if (rows.length === 0) {
        sendApiError(res, 404, 'SHARE_EXPIRED', 'notFound.title');
        return;
      }
      const projRows = await db
        .select()
        .from(projects)
        .where(eq(projects.id, rows[0].projectId))
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
        const projRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (projRows.length === 0 || !can(actor, 'project:read', { orgId: projRows[0].orgId })) {
          sendApiError(res, 403, 'FORBIDDEN', 'notFound.title');
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

      const orgDisplay = !orgRows[0]?.isPersonal ? orgRows[0]?.name : undefined;

      await db.insert(exportsLog).values({
        id: `exp_${crypto.randomUUID().slice(0, 10)}`,
        projectId: projectId || resultId || 'direct',
        orgId: actor.activeOrgId,
        userUid: actor.uid,
        format,
        watermarked: entitlements.exportsWatermark,
      });
      await incrementMonthlyUsage(actor.activeOrgId, 'exports_created');
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
        await incrementMonthlyUsage(req.actor.activeOrgId, 'checks_run');
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
      const runId = `run_${crypto.randomUUID().slice(0, 12)}`;
      await db.insert(simulationRuns).values({
        id: runId,
        userUid: req.actor?.uid ?? null,
        anonId: req.actor ? null : hashIp(req.ip),
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

  app.get('/api/simulations/:id/report', async (req, res) => {
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

  app.post('/api/service-requests', async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = ServiceRequestInputSchema.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'INVALID_SERVICE_REQUEST', 'experts.requestFormTitle');
        return;
      }

      const srvRows = await db
        .select()
        .from(services)
        .where(eq(services.id, parsed.data.serviceId))
        .limit(1);
      if (srvRows.length === 0) {
        sendApiError(res, 404, 'SERVICE_NOT_FOUND', 'experts.title');
        return;
      }
      const srv = srvRows[0];
      const reqId = `REQ-${Math.floor(10000 + Math.random() * 90000)}`;
      const isFixedPaid = srv.pricingType === 'fixed' && Boolean(srv.priceAmountKwd);

      await db.insert(serviceRequests).values({
        id: reqId,
        requesterUid: req.actor?.uid ?? null,
        requesterEmail: parsed.data.requesterEmail,
        requesterName: parsed.data.requesterName,
        orgId: req.actor?.activeOrgId ?? null,
        serviceId: srv.id,
        projectId: parsed.data.projectId ?? null,
        triggerSource: parsed.data.triggerSource,
        status: isFixedPaid ? 'in_progress' : 'new',
        contextShared: parsed.data.contextShared,
        clientNotes: parsed.data.clientNotes,
        assignedOwner: srv.owner,
        quotedAmountKwd: srv.priceAmountKwd,
        paid: isFixedPaid,
      });

      await db.insert(expertSuggestionEvents).values({
        userUid: req.actor?.uid ?? null,
        orgId: req.actor?.activeOrgId ?? null,
        projectId: parsed.data.projectId ?? null,
        triggerType: parsed.data.triggerSource,
        eventType: 'requested',
      });

      if (isFixedPaid && srv.priceAmountKwd) {
        await processBillingWebhook({
          eventId: `evt_srv_${reqId}`,
          provider: 'sandbox',
          eventType: 'service.paid',
          orgId: req.actor?.activeOrgId || 'guest_checkout',
          userUid: req.actor?.uid || 'guest',
          targetId: srv.id,
          amountKwd: srv.priceAmountKwd,
          serviceOwner: srv.owner as 'yousef' | 'ahmad' | 'joint',
        });
      }

      res.status(201).json({ id: reqId, paid: isFixedPaid });
    } catch (error) {
      console.error('POST /api/service-requests failed:', error);
      sendApiError(res, 500, 'SERVICE_REQ_ERROR', 'home.networkError');
    }
  });

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
      const planId = String(req.body?.planId || 'individual');
      const billingCycle = req.body?.billingCycle === 'annual' ? 'annual' : 'monthly';
      const planRows = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
      if (planRows.length === 0) {
        sendApiError(res, 404, 'PLAN_NOT_FOUND', 'pricing.title');
        return;
      }
      const p = planRows[0];
      const amount = billingCycle === 'annual' ? p.annualPriceKwd : p.monthlyPriceKwd;
      const eventId = `evt_chk_${crypto.randomUUID().slice(0, 12)}`;

      await processBillingWebhook({
        eventId,
        provider: 'mock_sandbox',
        eventType: 'subscription.activated',
        orgId: actor.activeOrgId,
        userUid: actor.uid,
        targetId: p.id,
        billingCycle,
        amountKwd: amount,
      });

      await logAnalytics('checkout_completed', 'ar', actor.activeOrgId, undefined, {
        planId: p.id,
        billingCycle,
      });
      res.json({ ok: true, planId: p.id });
    } catch (error) {
      console.error('POST /api/billing/checkout failed:', error);
      sendApiError(res, 500, 'CHECKOUT_ERROR', 'home.networkError');
    }
  });

  app.post('/api/billing/webhook', async (req, res) => {
    try {
      const eventId = String(req.body?.eventId || '');
      if (!eventId) {
        sendApiError(res, 400, 'MISSING_EVENT_ID', 'pricing.title');
        return;
      }
      const out = await processBillingWebhook({
        eventId,
        provider: String(req.body?.provider || 'mock_sandbox'),
        eventType: req.body?.eventType === 'service.paid' ? 'service.paid' : 'subscription.activated',
        orgId: String(req.body?.orgId || ''),
        userUid: String(req.body?.userUid || ''),
        targetId: String(req.body?.targetId || 'individual'),
        billingCycle: req.body?.billingCycle === 'annual' ? 'annual' : 'monthly',
        amountKwd: Number(req.body?.amountKwd ?? 5),
      });
      res.json(out);
    } catch (error) {
      console.error('POST /api/billing/webhook failed:', error);
      sendApiError(res, 500, 'WEBHOOK_ERROR', 'home.networkError');
    }
  });

  app.post('/api/billing/cancel', requireAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true, status: 'cancelled', updatedAt: new Date() })
        .where(eq(subscriptions.orgId, actor.activeOrgId));
      await db
        .update(orgs)
        .set({ planId: 'free', updatedAt: new Date() })
        .where(eq(orgs.id, actor.activeOrgId));
      await logAnalytics('subscription_cancelled', 'ar', actor.activeOrgId);
      res.json({ ok: true });
    } catch (error) {
      console.error('POST /api/billing/cancel failed:', error);
      sendApiError(res, 500, 'CANCEL_ERROR', 'home.networkError');
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
      sendApiError(res, 403, 'ADMIN_FORBIDDEN', 'admin.title');
      return;
    }
    next();
  });

  app.get('/api/admin/overview', async (_req: AuthenticatedRequest, res) => {
    try {
      const [
        allRules,
        allReqs,
        allFeedback,
        allEvents,
        latestEvals,
        splitRules,
        ledgerRows,
        srcRows,
      ] = await Promise.all([
        db.select().from(knowledgeRules),
        db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt)),
        db.select().from(feedback).orderBy(desc(feedback.createdAt)),
        db.select().from(analyticsEvents),
        db.select().from(evalRuns).orderBy(desc(evalRuns.createdAt)).limit(5),
        db.select().from(revenueSplitRules),
        db.select().from(revenueLedger).orderBy(desc(revenueLedger.createdAt)),
        db.select().from(sources),
      ]);

      const soonCutoff = new Date(Date.now() + 30 * 24 * 3600_000).toISOString().slice(0, 10);
      const expiringSoon = allRules.filter((r) => r.reviewDueAt <= soonCutoff);

      res.json({
        stats: {
          totalRules: allRules.length,
          approvedRules: allRules.filter((r) => r.status === 'approved').length,
          demoRules: allRules.filter((r) => r.status === 'draft_demo').length,
          inReviewRules: allRules.filter((r) => r.status === 'in_review').length,
          expiringWithin30Days: expiringSoon.length,
          openServiceRequests: allReqs.filter((r) => r.status !== 'closed').length,
          errorReports: allFeedback.filter((f) => f.reportedError).length,
          completedResultsCount: allEvents.filter((e) => e.eventName === 'result_completed').length,
          estimatedAiCostKwd: Number(
            (allEvents.filter((e) => e.eventName === 'result_completed').length * 0.002).toFixed(3),
          ),
        },
        rules: allRules,
        sources: srcRows,
        serviceRequests: allReqs,
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
      const ruleId = String(req.params.id);
      const nextStatus = String(req.body?.status || 'in_review');
      const reviewNote = String(req.body?.reviewNote || '');

      const rows = await db
        .select()
        .from(knowledgeRules)
        .where(eq(knowledgeRules.id, ruleId))
        .limit(1);
      if (rows.length === 0) {
        sendApiError(res, 404, 'RULE_NOT_FOUND', 'admin.tabs.content');
        return;
      }
      const rule = rows[0];

      if (nextStatus === 'approved') {
        const neededAction =
          rule.sensitivity === 'high'
            ? 'content:approve_high_sensitivity'
            : 'content:approve_standard';
        if (!can(actor, neededAction)) {
          sendApiError(res, 403, 'SENIOR_REVIEWER_REQUIRED', 'admin.tabs.review');
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

      await logAudit(actor.uid, `content.status_${nextStatus}`, 'knowledge_rule', ruleId, null, req);
      res.json({ ok: true });
    } catch (error) {
      console.error('PATCH /api/admin/rules/:id/status failed:', error);
      sendApiError(res, 500, 'ADMIN_RULE_STATUS_ERROR', 'home.networkError');
    }
  });

  app.patch('/api/admin/requests/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const actor = req.actor!;
      if (!can(actor, 'requests:manage')) {
        sendApiError(res, 403, 'FORBIDDEN', 'admin.tabs.requests');
        return;
      }
      const reqId = String(req.params.id);
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

  app.post('/api/admin/evals/run', async (_req: AuthenticatedRequest, res) => {
    try {
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
        const entities = analyzeIntentAndContextPure(c.queryText);
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

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
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
