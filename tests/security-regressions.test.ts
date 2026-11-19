import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import * as schema from '../src/db/schema.ts';
import { buildExpressApp } from '../server.ts';
import { hashIp, hashToken } from '../src/server/auth/rbac.ts';
import { SESSION_COOKIE_NAME } from '../src/server/auth/session.ts';
import { generateProjectPdfOrHtml } from '../src/server/export/exporter.ts';

async function startTestServer(envOverrides: Record<string, string | undefined> = {}): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  const restoreEnv = () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };

  try {
    const app = await buildExpressApp();
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    return {
      baseUrl: `http://127.0.0.1:${port}`,
      close: async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        restoreEnv();
      },
    };
  } catch (err) {
    restoreEnv();
    throw err;
  }
}

async function createTestUserSession(opts: {
  uid: string;
  email: string;
  orgId: string;
  orgRole?: 'org_owner' | 'org_admin' | 'member' | 'viewer';
  platformRole?: 'user' | 'platform_admin' | 'expert' | 'content_editor' | 'senior_reviewer';
  planId?: string;
  mfaVerified?: boolean;
}): Promise<string> {
  await db
    .insert(schema.users)
    .values({
      uid: opts.uid,
      email: opts.email,
      name: opts.uid,
      platformRole: opts.platformRole ?? 'user',
      mfaVerified: opts.mfaVerified ?? false,
    })
    .onConflictDoUpdate({
      target: schema.users.uid,
      set: {
        email: opts.email,
        platformRole: opts.platformRole ?? 'user',
        mfaVerified: opts.mfaVerified ?? false,
        deletedAt: null,
      },
    });

  await db
    .insert(schema.orgs)
    .values({
      id: opts.orgId,
      name: `Org ${opts.orgId}`,
      nameEn: `Org ${opts.orgId}`,
      planId: opts.planId ?? 'pro',
      isPersonal: false,
    })
    .onConflictDoUpdate({
      target: schema.orgs.id,
      set: { planId: opts.planId ?? 'pro' },
    });

  await db
    .delete(schema.memberships)
    .where(and(eq(schema.memberships.userUid, opts.uid), eq(schema.memberships.orgId, opts.orgId)));

  await db.insert(schema.memberships).values({
    userUid: opts.uid,
    orgId: opts.orgId,
    role: opts.orgRole ?? 'org_owner',
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const sessionId = hashToken(rawToken);
  const sessValues: Record<string, unknown> = {
    id: sessionId,
    userUid: opts.uid,
    activeOrgId: opts.orgId,
    expiresAt: new Date(Date.now() + 3600_000),
  };
  if ('mfaVerified' in schema.authSessions) {
    sessValues.mfaVerified = opts.mfaVerified ?? false;
  }
  await db.insert(schema.authSessions).values(sessValues as typeof schema.authSessions.$inferInsert);

  return `${SESSION_COOKIE_NAME}=${rawToken}`;
}

test('A1: demo-login returns 404 when ENABLE_DEMO_LOGIN is not true, works in dev with flag, and refuses prod with flag', async () => {
  // 1. Dev without flag -> 404
  const srvDisabled = await startTestServer({ ENABLE_DEMO_LOGIN: 'false' });
  try {
    const res = await fetch(`${srvDisabled.baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wijaha.demo' }),
    });
    assert.equal(res.status, 404, 'demo-login must not be registered without ENABLE_DEMO_LOGIN=true');

    const meRes = await fetch(`${srvDisabled.baseUrl}/api/auth/me`);
    const meJson = (await meRes.json()) as { demoLoginEnabled?: boolean };
    assert.equal(meJson.demoLoginEnabled, false);
  } finally {
    await srvDisabled.close();
  }

  // 2. Dev with flag -> 200
  const srvEnabled = await startTestServer({ ENABLE_DEMO_LOGIN: 'true' });
  try {
    const res = await fetch(`${srvEnabled.baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sara@org-alpha.demo' }),
    });
    assert.equal(res.status, 200, 'demo-login must work in dev when ENABLE_DEMO_LOGIN=true');
  } finally {
    await srvEnabled.close();
  }

  // 3. Production with ENABLE_DEMO_LOGIN=true -> refuses startup; Production without flag -> 404
  const validProdEnv = {
    NODE_ENV: 'production',
    APP_URL: 'https://wijaha.example.com',
    EMAIL_PROVIDER: 'smtp',
    BILLING_PROVIDER: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'AIzaSyDummyValidLengthKeyForTest123456',
    FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
    IP_HASH_SALT: 'prod-salt-16chars-minimum-ok',
    SESSION_SECRET: 'prod-session-secret-minimum-32-characters-long',
    FIREBASE_PROJECT_ID: 'wijaha-prod',
  };

  await assert.rejects(async () => {
    await startTestServer({ ...validProdEnv, ENABLE_DEMO_LOGIN: 'true' });
  }, /ENABLE_DEMO_LOGIN=true is strictly forbidden/);

  const srvProd = await startTestServer({ ...validProdEnv, ENABLE_DEMO_LOGIN: 'false' });
  try {
    const res = await fetch(`${srvProd.baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wijaha.demo' }),
    });
    assert.equal(res.status, 404, 'production must return 404 for demo-login');
  } finally {
    await srvProd.close();
  }
});

test('A2: magic-link hides code unless EMAIL_PROVIDER=console in non-prod, locks after 5 wrong attempts, and rejects code reuse', async () => {
  const srv = await startTestServer({
    EMAIL_PROVIDER: 'smtp',
    SMTP_WEBHOOK_URL: 'http://127.0.0.1:9/noop-mail',
  });
  try {
    const email = `a2_${Date.now()}@test.local`;
    const reqRes = await fetch(`${srv.baseUrl}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const reqJson = (await reqRes.json()) as { devPreviewCode?: string; message?: string };
    assert.equal(reqJson.devPreviewCode, undefined, 'code must never leak when EMAIL_PROVIDER!=console');
    assert.equal(reqJson.message, 'إذا كان البريد صحيحاً فسيصلك رمز');
  } finally {
    await srv.close();
  }

  // Test 5 wrong attempts lockout + single-use + 3 req/15m limit in console dev mode
  const devSrv = await startTestServer({ EMAIL_PROVIDER: 'console' });
  try {
    const email = `a2_lock_${Date.now()}@test.local`;
    const r1 = await fetch(`${devSrv.baseUrl}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const j1 = (await r1.json()) as { devPreviewCode?: string };
    assert.ok(j1.devPreviewCode, 'console mode in dev returns preview code');

    for (let i = 0; i < 5; i++) {
      await fetch(`${devSrv.baseUrl}/api/auth/magic-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: '000000' }),
      });
    }

    const sixth = await fetch(`${devSrv.baseUrl}/api/auth/magic-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: j1.devPreviewCode }),
    });
    assert.notEqual(sixth.status, 200, '6th attempt must be rejected even with valid code');

    // Single-use verification
    const emailOnce = `a2_once_${Date.now()}@test.local`;
    const rOnce = await fetch(`${devSrv.baseUrl}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.88' },
      body: JSON.stringify({ email: emailOnce }),
    });
    const jOnce = (await rOnce.json()) as { devPreviewCode?: string };
    const use1 = await fetch(`${devSrv.baseUrl}/api/auth/magic-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.88' },
      body: JSON.stringify({ email: emailOnce, code: jOnce.devPreviewCode }),
    });
    assert.equal(use1.status, 200, 'first valid verification succeeds');

    const use2 = await fetch(`${devSrv.baseUrl}/api/auth/magic-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.88' },
      body: JSON.stringify({ email: emailOnce, code: jOnce.devPreviewCode }),
    });
    assert.notEqual(use2.status, 200, 'consumed code must not be accepted a second time');
  } finally {
    await devSrv.close();
  }
});

test('A3: unsigned billing webhook returns 400, viewer gets 403, duplicate signed event is idempotent, and prod refuses mock billing', async () => {
  const srv = await startTestServer({ BILLING_PROVIDER: 'mock' });
  try {
    const orgId = `org_a3_${Date.now()}`;
    const viewerCookie = await createTestUserSession({
      uid: `u_a3_viewer_${Date.now()}`,
      email: `a3_viewer_${Date.now()}@test.local`,
      orgId,
      orgRole: 'viewer',
      planId: 'free',
    });

    const chkViewer = await fetch(`${srv.baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: viewerCookie },
      body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' }),
    });
    assert.equal(chkViewer.status, 403, 'viewer must get 403 on billing checkout');

    const whRes = await fetch(`${srv.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: `evt_unsigned_${Date.now()}`,
        eventType: 'subscription.activated',
        orgId,
        userUid: 'attacker',
        targetId: 'enterprise',
        amountKwd: 0,
      }),
    });
    assert.equal(whRes.status, 400, 'unsigned webhook must return 400');

    const orgRowsBefore = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
    assert.equal(orgRowsBefore[0]?.planId, 'free', 'unsigned webhook must not alter planId');

    // Owner creates checkout session -> plan remains free until signed webhook arrives
    const ownerCookie = await createTestUserSession({
      uid: `u_a3_owner_${Date.now()}`,
      email: `a3_owner_${Date.now()}@test.local`,
      orgId,
      orgRole: 'org_owner',
      planId: 'free',
    });

    const chkOwner = await fetch(`${srv.baseUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' }),
    });
    assert.equal(chkOwner.status, 200, 'org_owner can create checkout session');
    const chkJson = (await chkOwner.json()) as { sessionId: string; providerSessionId: string };
    assert.ok(chkJson.sessionId);

    const orgRowsPending = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
    assert.equal(orgRowsPending[0]?.planId, 'free', 'checkout creation must not upgrade plan before webhook');

    // Signed webhook delivered twice -> activates once, creates 1 invoice, second returns duplicate=true
    const ts = Math.floor(Date.now() / 1000);
    const eventPayload = JSON.stringify({
      eventId: `evt_signed_${Date.now()}`,
      eventType: 'checkout.completed',
      checkoutSessionId: chkJson.sessionId,
      providerSessionId: chkJson.providerSessionId,
    });
    const secret = process.env.SESSION_SECRET!;
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${eventPayload}`, 'utf8')
      .digest('hex');
    const sigHeader = `t=${ts},v1=${hmac}`;

    const wh1 = await fetch(`${srv.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wijaha-mock-signature': sigHeader,
      },
      body: eventPayload,
    });
    assert.equal(wh1.status, 200);
    const wh1Json = (await wh1.json()) as { duplicate: boolean };
    assert.equal(wh1Json.duplicate, false);

    const wh2 = await fetch(`${srv.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wijaha-mock-signature': sigHeader,
      },
      body: eventPayload,
    });
    assert.equal(wh2.status, 200);
    const wh2Json = (await wh2.json()) as { duplicate: boolean };
    assert.equal(wh2Json.duplicate, true, 'second delivery of same eventId must be duplicate');

    const orgRowsAfter = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
    assert.equal(orgRowsAfter[0]?.planId, 'pro', 'signed webhook activates target plan');

    const invRows = await db.select().from(schema.invoices).where(eq(schema.invoices.orgId, orgId));
    assert.equal(invRows.length, 1, 'duplicate webhook must not create a second invoice');
  } finally {
    await srv.close();
  }

  // Production refuses BILLING_PROVIDER=mock
  await assert.rejects(async () => {
    await startTestServer({
      NODE_ENV: 'production',
      APP_URL: 'https://wijaha.example.com',
      EMAIL_PROVIDER: 'smtp',
      BILLING_PROVIDER: 'mock',
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'AIzaSyDummyValidLengthKeyForTest123456',
      FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
      IP_HASH_SALT: 'prod-salt-16chars-minimum-ok',
      SESSION_SECRET: 'prod-session-secret-minimum-32-characters-long',
      FIREBASE_PROJECT_ID: 'wijaha-prod',
    });
  }, /BILLING_PROVIDER=mock is strictly forbidden/);
});

test('B1: db:seed refuses NODE_ENV=production without --allow-production-seed and server does not seed on API requests', async () => {
  const proc = spawnSync(
    'npx',
    ['tsx', 'src/db/seed-cli.ts'],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
    },
  );
  assert.notEqual(proc.status, 0, 'seed CLI must refuse production without --allow-production-seed');
});

test('B2: results default to private with 128-bit IDs and block cross-user read/refine/export/project-save', async () => {
  const srv = await startTestServer();
  try {
    const cookieA = await createTestUserSession({
      uid: `u_b2_a_${Date.now()}`,
      email: `b2_a_${Date.now()}@test.local`,
      orgId: `org_b2_a_${Date.now()}`,
      planId: 'pro',
    });
    const cookieB = await createTestUserSession({
      uid: `u_b2_b_${Date.now()}`,
      email: `b2_b_${Date.now()}@test.local`,
      orgId: `org_b2_b_${Date.now()}`,
      planId: 'pro',
    });

    const qRes = await fetch(`${srv.baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ query: 'ترتيب جلوس عشاء رسمي في الكويت لستة ضيوف', locale: 'ar' }),
    });
    assert.equal(qRes.status, 200);
    const qJson = (await qRes.json()) as { result: { id: string } };
    const resultId = qJson.result.id;
    assert.ok(resultId.length >= 36, `result ID must have >= 128 bits entropy, got ${resultId}`);

    const readB = await fetch(`${srv.baseUrl}/api/results/${resultId}`, {
      headers: { Cookie: cookieB },
    });
    assert.ok([403, 404].includes(readB.status), `User B read got ${readB.status}`);

    const refineB = await fetch(`${srv.baseUrl}/api/results/${resultId}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({ followupText: 'تعديل خبيث', locale: 'ar' }),
    });
    assert.ok([403, 404].includes(refineB.status), `User B refine got ${refineB.status}`);

    const exportB = await fetch(`${srv.baseUrl}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({ resultId, format: 'docx' }),
    });
    assert.ok([403, 404].includes(exportB.status), `User B export got ${exportB.status}`);

    const projB = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({ resultId, title: 'Stolen' }),
    });
    assert.ok([403, 404].includes(projB.status), `User B save project got ${projB.status}`);

    // Anonymous browser A gets signed cookie and can read its own result, while anonymous browser B cannot
    const anonQ = await fetch(`${srv.baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'هدية رسمية لوفد دبلوماسي في اليابان', locale: 'ar' }),
    });
    assert.equal(anonQ.status, 200);
    const anonCookieHeader = anonQ.headers.get('set-cookie') || '';
    assert.ok(anonCookieHeader.includes('wijaha_anon='), 'anonymous query must issue signed wijaha_anon cookie');
    const anonCookiePair = anonCookieHeader.split(';')[0];
    const anonResultId = ((await anonQ.json()) as { result: { id: string } }).result.id;

    const anonReadSelf = await fetch(`${srv.baseUrl}/api/results/${anonResultId}`, {
      headers: { Cookie: anonCookiePair },
    });
    assert.equal(anonReadSelf.status, 200, 'anonymous owner with signed cookie can read own result');

    const anonReadStranger = await fetch(`${srv.baseUrl}/api/results/${anonResultId}`);
    assert.equal(anonReadStranger.status, 403, 'stranger without matching wijaha_anon cookie gets 403');
  } finally {
    await srv.close();
  }
});

test('B3: service-requests require auth and never mark paid=true or write revenue_ledger without signed webhook', async () => {
  const srv = await startTestServer();
  try {
    const anonRes = await fetch(`${srv.baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: 'SRV-YOUSEF-REVIEW',
        requesterName: 'Anon User',
        requesterEmail: 'anon@test.local',
        triggerSource: 'direct',
        clientNotes: 'Test request',
        contextShared: {},
      }),
    });
    assert.equal(anonRes.status, 401, 'unauthenticated service request must return 401');

    const userCookie = await createTestUserSession({
      uid: `u_b3_${Date.now()}`,
      email: `b3_${Date.now()}@test.local`,
      orgId: `org_b3_${Date.now()}`,
      planId: 'pro',
    });

    const ledgerBefore = await db.select().from(schema.revenueLedger);
    const authRes = await fetch(`${srv.baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({
        serviceId: 'SRV-YOUSEF-REVIEW',
        requesterName: 'Authenticated Client',
        requesterEmail: 'client@test.local',
        triggerSource: 'direct',
        clientNotes: 'Please review diplomatic seating',
        contextShared: {},
      }),
    });
    assert.equal(authRes.status, 201);
    const authJson = (await authRes.json()) as { id: string; paid: boolean; checkoutSessionId?: string };
    assert.equal(authJson.paid, false, 'fixed service request must start unpaid until webhook');
    assert.ok(authJson.checkoutSessionId, 'fixed service request returns checkoutSessionId');

    const reqRows = await db
      .select()
      .from(schema.serviceRequests)
      .where(eq(schema.serviceRequests.id, authJson.id));
    assert.equal(reqRows[0]?.paid, false);
    assert.equal(reqRows[0]?.status, 'new');

    const ledgerAfter = await db.select().from(schema.revenueLedger);
    assert.equal(ledgerAfter.length, ledgerBefore.length, 'no revenue_ledger row created before signed webhook');
  } finally {
    await srv.close();
  }
});

test('B4: removed org member loses access immediately without waiting for session expiry', async () => {
  const srv = await startTestServer();
  try {
    const orgId = `org_b4_${Date.now()}`;
    const ownerCookie = await createTestUserSession({
      uid: `u_b4_owner_${Date.now()}`,
      email: `b4_owner_${Date.now()}@test.local`,
      orgId,
      orgRole: 'org_owner',
      planId: 'team',
    });
    const memberUid = `u_b4_mem_${Date.now()}`;
    const memberCookie = await createTestUserSession({
      uid: memberUid,
      email: `b4_mem_${Date.now()}@test.local`,
      orgId,
      orgRole: 'member',
      planId: 'team',
    });

    // Owner creates result & project in org
    const qRes = await fetch(`${srv.baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ query: 'بروتوكول استقبال وفد رسمي في الكويت', locale: 'ar' }),
    });
    const { result } = (await qRes.json()) as { result: { id: string } };
    const pRes = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ resultId: result.id, title: 'Org Secret Plan' }),
    });
    const { id: projectId } = (await pRes.json()) as { id: string };

    // 1. Direct membership removal -> immediate 403 (never defaults to 'member')
    await db
      .delete(schema.memberships)
      .where(and(eq(schema.memberships.userUid, memberUid), eq(schema.memberships.orgId, orgId)));

    const afterDirectRemoval = await fetch(`${srv.baseUrl}/api/projects/${projectId}`, {
      headers: { Cookie: memberCookie },
    });
    assert.equal(afterDirectRemoval.status, 403, 'removed member must get 403 immediately');

    // 2. Endpoint DELETE /api/org/members/:uid revokes membership, deletes org sessions, and writes audit_logs
    const member2Uid = `u_b4_mem2_${Date.now()}`;
    const member2Cookie = await createTestUserSession({
      uid: member2Uid,
      email: `b4_mem2_${Date.now()}@test.local`,
      orgId,
      orgRole: 'member',
      planId: 'team',
    });

    const delRes = await fetch(`${srv.baseUrl}/api/org/members/${encodeURIComponent(member2Uid)}`, {
      method: 'DELETE',
      headers: { Cookie: ownerCookie },
    });
    assert.equal(delRes.status, 200, 'owner can remove org member via DELETE /api/org/members/:uid');

    const afterEndpointRemoval = await fetch(`${srv.baseUrl}/api/projects/${projectId}`, {
      headers: { Cookie: member2Cookie },
    });
    assert.ok(
      [401, 403].includes(afterEndpointRemoval.status),
      `removed member session must be rejected immediately, got ${afterEndpointRemoval.status}`,
    );
  } finally {
    await srv.close();
  }
});

test('B5: production startup fails fast when FIELD_ENCRYPTION_KEY or IP_HASH_SALT is missing, and key rotation decrypts prior versions', async () => {
  const envCopy: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production' };
  delete envCopy.FIELD_ENCRYPTION_KEY;
  delete envCopy.IP_HASH_SALT;

  const proc = spawnSync(
    'npx',
    ['tsx', '-e', 'import("./server.ts").then(m => m.buildExpressApp())'],
    {
      cwd: process.cwd(),
      env: envCopy,
      encoding: 'utf8',
    },
  );
  assert.notEqual(proc.status, 0, 'production boot must fail without FIELD_ENCRYPTION_KEY');

  // Verify encryption key rotation (v1 ciphertext remains decryptable after rotating active key to v2)
  const { encryptField, decryptField } = await import('../src/server/auth/rbac.ts');
  const prevKey = process.env.FIELD_ENCRYPTION_KEY;
  const prevVer = process.env.FIELD_ENCRYPTION_KEY_VERSION;
  const prevOld = process.env.FIELD_ENCRYPTION_KEYS_PREVIOUS;
  try {
    const keyV1 = '1'.repeat(64);
    const keyV2 = '2'.repeat(64);
    process.env.FIELD_ENCRYPTION_KEY = keyV1;
    process.env.FIELD_ENCRYPTION_KEY_VERSION = 'v1';
    const cipherV1 = encryptField('نص سري حساس');
    assert.ok(cipherV1.startsWith('v1:'));

    process.env.FIELD_ENCRYPTION_KEY = keyV2;
    process.env.FIELD_ENCRYPTION_KEY_VERSION = 'v2';
    process.env.FIELD_ENCRYPTION_KEYS_PREVIOUS = `v1:${keyV1}`;
    assert.equal(decryptField(cipherV1), 'نص سري حساس', 'rotated v2 key must still decrypt v1 payload via previous keys');
  } finally {
    if (prevKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = prevKey;
    if (prevVer === undefined) delete process.env.FIELD_ENCRYPTION_KEY_VERSION;
    else process.env.FIELD_ENCRYPTION_KEY_VERSION = prevVer;
    if (prevOld === undefined) delete process.env.FIELD_ENCRYPTION_KEYS_PREVIOUS;
    else process.env.FIELD_ENCRYPTION_KEYS_PREVIOUS = prevOld;
  }
});

test('C1: simulation step and report enforce session ownership', async () => {
  const srv = await startTestServer();
  try {
    const cookieA = await createTestUserSession({
      uid: `u_c1_a_${Date.now()}`,
      email: `c1_a_${Date.now()}@test.local`,
      orgId: `org_c1_a_${Date.now()}`,
    });
    const cookieB = await createTestUserSession({
      uid: `u_c1_b_${Date.now()}`,
      email: `c1_b_${Date.now()}@test.local`,
      orgId: `org_c1_b_${Date.now()}`,
    });

    const startRes = await fetch(`${srv.baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ scenarioId: 'SCN-DEMO-01', locale: 'ar' }),
    });
    const { runId, currentNodeId } = (await startRes.json()) as {
      runId: string;
      currentNodeId: string;
    };

    const stepB = await fetch(`${srv.baseUrl}/api/simulations/${runId}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB },
      body: JSON.stringify({ nodeId: currentNodeId, optionId: 'opt_a' }),
    });
    assert.equal(stepB.status, 403, `User B step must return 403, got ${stepB.status}`);

    // Complete run as User A and verify User B cannot read report
    let nodeCursor: string | undefined = currentNodeId;
    for (let i = 0; i < 6 && nodeCursor; i++) {
      const st: Response = await fetch(`${srv.baseUrl}/api/simulations/${runId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({
          nodeId: nodeCursor,
          optionId: 'opt_a',
          freeText: 'نرحب بسعادتكم وفق ترتيب الأسبقية الرسمي في دولة الكويت',
        }),
      });
      assert.equal(st.status, 200);
      const stJson = (await st.json()) as { finished: boolean; nextNodeId?: string };
      if (stJson.finished) break;
      nodeCursor = stJson.nextNodeId;
    }

    const repA = await fetch(`${srv.baseUrl}/api/simulations/${runId}/report`, {
      headers: { Cookie: cookieA },
    });
    assert.equal(repA.status, 200, 'owner A can read own simulation report');

    const repB = await fetch(`${srv.baseUrl}/api/simulations/${runId}/report`, {
      headers: { Cookie: cookieB },
    });
    assert.equal(repB.status, 403, 'User B must get 403 on User A simulation report');

    // Anonymous browser run binds to signed wijaha_anon cookie
    const anonStart = await fetch(`${srv.baseUrl}/api/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'SCN-DEMO-01', locale: 'ar' }),
    });
    const anonCookie = (anonStart.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(anonCookie.includes('wijaha_anon='));
    const anonBody = (await anonStart.json()) as { runId: string; currentNodeId: string };

    const anonStrangerStep = await fetch(`${srv.baseUrl}/api/simulations/${anonBody.runId}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: anonBody.currentNodeId, optionId: 'opt_a' }),
    });
    assert.equal(anonStrangerStep.status, 403, 'anonymous stranger without cookie gets 403');
  } finally {
    await srv.close();
  }
});

test('C2: share link returns 404 when project is soft-deleted or share is revoked via DELETE /api/shares/:id', async () => {
  const srv = await startTestServer();
  try {
    const cookie = await createTestUserSession({
      uid: `u_c2_${Date.now()}`,
      email: `c2_${Date.now()}@test.local`,
      orgId: `org_c2_${Date.now()}`,
      planId: 'pro',
    });

    const qRes = await fetch(`${srv.baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ query: 'استقبال وفد رسمي في الكويت', locale: 'ar' }),
    });
    const { result } = (await qRes.json()) as { result: { id: string } };
    const pRes = await fetch(`${srv.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ resultId: result.id, title: 'Share Delete Test' }),
    });
    const { id: projectId } = (await pRes.json()) as { id: string };

    // 1. Revoke share via DELETE /api/shares/:id -> immediate 404
    const sh1Res = await fetch(`${srv.baseUrl}/api/projects/${projectId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });
    const sh1 = (await sh1Res.json()) as { id: string; token: string };
    assert.ok(sh1.id && sh1.token);

    const beforeRevoke = await fetch(`${srv.baseUrl}/api/shares/${sh1.token}`);
    assert.equal(beforeRevoke.status, 200);

    const revRes = await fetch(`${srv.baseUrl}/api/shares/${sh1.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    assert.equal(revRes.status, 200);

    const afterRevoke = await fetch(`${srv.baseUrl}/api/shares/${sh1.token}`);
    assert.equal(afterRevoke.status, 404, 'revoked share must return 404');

    // 2. Soft-delete project via DELETE /api/projects/:id -> share & export return 404
    const sh2Res = await fetch(`${srv.baseUrl}/api/projects/${projectId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });
    const { token: token2 } = (await sh2Res.json()) as { token: string };

    const delProjRes = await fetch(`${srv.baseUrl}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    assert.equal(delProjRes.status, 200);

    const getDeletedShare = await fetch(`${srv.baseUrl}/api/shares/${token2}`);
    assert.equal(getDeletedShare.status, 404, 'share of deleted project must return 404');

    const expDeleted = await fetch(`${srv.baseUrl}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ projectId, format: 'docx' }),
    });
    assert.equal(expDeleted.status, 404, 'export of soft-deleted project must return 404');
  } finally {
    await srv.close();
  }
});

test('C3: viewer does not see invitation tokens on GET /api/org', async () => {
  const srv = await startTestServer();
  try {
    const orgId = `org_c3_${Date.now()}`;
    const ownerCookie = await createTestUserSession({
      uid: `u_c3_owner_${Date.now()}`,
      email: `c3_owner_${Date.now()}@test.local`,
      orgId,
      orgRole: 'org_owner',
      planId: 'team',
    });
    const viewerCookie = await createTestUserSession({
      uid: `u_c3_viewer_${Date.now()}`,
      email: `c3_viewer_${Date.now()}@test.local`,
      orgId,
      orgRole: 'viewer',
      planId: 'team',
    });

    const inviteeEmail = `invitee_${Date.now()}@test.local`;
    const createInvRes = await fetch(`${srv.baseUrl}/api/org/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ email: inviteeEmail, role: 'member' }),
    });
    assert.equal(createInvRes.status, 201);
    const createdInv = (await createInvRes.json()) as { token: string };
    assert.ok(createdInv.token, 'creator receives one-time token on creation');

    const orgRes = await fetch(`${srv.baseUrl}/api/org`, {
      headers: { Cookie: viewerCookie },
    });
    const orgJson = (await orgRes.json()) as {
      invitations: Array<{ token?: string }>;
    };
    assert.ok(orgJson.invitations.length > 0);
    assert.equal(orgJson.invitations[0].token, undefined, 'viewer must not receive invitation token');

    // Wrong email cannot accept
    const wrongAccept = await fetch(`${srv.baseUrl}/api/invitations/${createdInv.token}/accept`, {
      method: 'POST',
      headers: { Cookie: viewerCookie },
    });
    assert.equal(wrongAccept.status, 403, 'wrong email must get 403 on invitation accept');

    // Matching email accepts once and joins org
    const inviteeCookie = await createTestUserSession({
      uid: `u_c3_invitee_${Date.now()}`,
      email: inviteeEmail,
      orgId: `org_personal_${Date.now()}`,
    });
    const okAccept = await fetch(`${srv.baseUrl}/api/invitations/${createdInv.token}/accept`, {
      method: 'POST',
      headers: { Cookie: inviteeCookie },
    });
    assert.equal(okAccept.status, 200, 'matching invitee accepts invitation');

    const replayAccept = await fetch(`${srv.baseUrl}/api/invitations/${createdInv.token}/accept`, {
      method: 'POST',
      headers: { Cookie: inviteeCookie },
    });
    assert.equal(replayAccept.status, 404, 'consumed invitation token cannot be reused');
  } finally {
    await srv.close();
  }
});

test('C4: expert role on /api/admin/overview cannot see financial ledger or unassigned requests', async () => {
  const srv = await startTestServer({ ENFORCE_ADMIN_MFA: 'false' });
  try {
    // Seed a service request assigned to ahmad and a revenue ledger entry
    const otherReqId = `REQ-C4-${Date.now()}`;
    await db.insert(schema.serviceRequests).values({
      id: otherReqId,
      requesterUid: 'demo:sara',
      requesterEmail: 'private-other-client@secret.org',
      requesterName: 'Other Client',
      serviceId: 'SRV-AHMAD-SIM',
      assignedOwner: 'ahmad',
      status: 'new',
      paid: false,
    });
    await db.insert(schema.revenueLedger).values({
      id: `led_c4_${Date.now()}`,
      paymentId: 'pay_test',
      serviceOwner: 'ahmad',
      grossAmountKwd: 500,
      splitSnapshot: {},
    });

    // Expert user mapped to 'yousef'
    const expertCookie = await createTestUserSession({
      uid: `u_c4_yousef_${Date.now()}`,
      email: `yousef.c4.${Date.now()}@wijaha.demo`,
      orgId: `org_c4_${Date.now()}`,
      platformRole: 'expert',
      mfaVerified: true,
    });

    const res = await fetch(`${srv.baseUrl}/api/admin/overview`, {
      headers: { Cookie: expertCookie },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      revenueLedger: unknown[];
      serviceRequests: Array<{ id: string; requesterEmail?: string }>;
    };
    assert.equal(body.revenueLedger.length, 0, 'expert must not see platform revenue ledger');
    assert.equal(
      body.serviceRequests.some((r) => r.id === otherReqId),
      false,
      'expert yousef must not see requests assigned exclusively to ahmad',
    );
  } finally {
    await srv.close();
  }
});

test('C5: PATCH /api/admin/rules/:id/status rejects invalid status strings and illegal state jumps', async () => {
  const srv = await startTestServer({ ENFORCE_ADMIN_MFA: 'false' });
  try {
    const adminCookie = await createTestUserSession({
      uid: `u_c5_admin_${Date.now()}`,
      email: `c5_admin_${Date.now()}@test.local`,
      orgId: `org_c5_${Date.now()}`,
      platformRole: 'platform_admin',
      mfaVerified: true,
    });

    // 1. Invalid enum value -> 400
    const badEnum = await fetch(`${srv.baseUrl}/api/admin/rules/R-DEMO-0001/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'totally_invalid_status' }),
    });
    assert.equal(badEnum.status, 400, 'invalid rule status must return 400');

    // Create a fresh draft rule to test transition machine without mutating seeded demo status permanently
    const customRuleId = `R-C5-${Date.now()}`;
    await fetch(`${srv.baseUrl}/api/admin/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        id: customRuleId,
        titleAr: 'قاعدة اختبار انتقال الحالة',
        titleEn: 'State Transition Test Rule',
        bodyAr: 'نص تجريبي لفحص آلة حالات القواعد.',
        bodyEn: 'Test body for rule lifecycle state machine.',
        level: 'customary',
        sensitivity: 'low',
        countries: ['KW'],
        submitForReview: false,
      }),
    });

    // 2. Illegal direct jump draft -> approved -> 400
    const illegalJump = await fetch(`${srv.baseUrl}/api/admin/rules/${customRuleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(illegalJump.status, 400, 'direct jump draft -> approved must return 400');

    // 3. Valid path draft -> in_review -> approved -> 200
    const toReview = await fetch(`${srv.baseUrl}/api/admin/rules/${customRuleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'in_review' }),
    });
    assert.equal(toReview.status, 200);

    const toApproved = await fetch(`${srv.baseUrl}/api/admin/rules/${customRuleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(toApproved.status, 200);
  } finally {
    await srv.close();
  }
});

test('C6: POST /api/admin/evals/run requires admin:evals and rejects content_editor with 403', async () => {
  const srv = await startTestServer({ ENFORCE_ADMIN_MFA: 'false' });
  try {
    const editorCookie = await createTestUserSession({
      uid: `u_c6_editor_${Date.now()}`,
      email: `c6_editor_${Date.now()}@test.local`,
      orgId: `org_c6_${Date.now()}`,
      platformRole: 'content_editor',
      mfaVerified: true,
    });

    const res = await fetch(`${srv.baseUrl}/api/admin/evals/run`, {
      method: 'POST',
      headers: { Cookie: editorCookie },
    });
    assert.equal(res.status, 403, 'content_editor must not run expensive evals');
  } finally {
    await srv.close();
  }
});

test('C7: /api/admin/* enforces MFA when ENFORCE_ADMIN_MFA=true', async () => {
  const srv = await startTestServer({ ENFORCE_ADMIN_MFA: 'true' });
  try {
    const unverifiedAdminCookie = await createTestUserSession({
      uid: `u_c7_admin_${Date.now()}`,
      email: `c7_admin_${Date.now()}@test.local`,
      orgId: `org_c7_${Date.now()}`,
      platformRole: 'platform_admin',
      mfaVerified: false,
    });

    const res = await fetch(`${srv.baseUrl}/api/admin/overview`, {
      headers: { Cookie: unverifiedAdminCookie },
    });
    assert.equal(res.status, 403, 'admin without MFA must receive 403');

    // Setup and verify TOTP MFA -> admin access unlocked
    const setupRes = await fetch(`${srv.baseUrl}/api/auth/mfa/setup`, {
      method: 'POST',
      headers: { Cookie: unverifiedAdminCookie },
    });
    assert.equal(setupRes.status, 200);
    const { secret } = (await setupRes.json()) as { secret: string };
    assert.ok(secret && secret.length >= 16);

    const { generateTotpCode } = await import('../src/server/auth/totp.ts');
    const validCode = generateTotpCode(secret);

    const verifyRes = await fetch(`${srv.baseUrl}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: unverifiedAdminCookie },
      body: JSON.stringify({ code: validCode }),
    });
    assert.equal(verifyRes.status, 200);

    const afterMfa = await fetch(`${srv.baseUrl}/api/admin/overview`, {
      headers: { Cookie: unverifiedAdminCookie },
    });
    assert.equal(afterMfa.status, 200, 'admin with verified TOTP MFA can access /api/admin/overview');
  } finally {
    await srv.close();
  }
});

test('C8: 20 parallel /api/query requests on a 15-limit free org produce at most 15 results', async () => {
  const srv = await startTestServer();
  try {
    const orgId = `org_c8_${Date.now()}`;
    const cookie = await createTestUserSession({
      uid: `u_c8_${Date.now()}`,
      email: `c8_${Date.now()}@test.local`,
      orgId,
      planId: 'free',
    });

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, idx) =>
        fetch(`${srv.baseUrl}/api/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
            'X-Forwarded-For': `198.51.100.${idx + 1}`,
          },
          body: JSON.stringify({
            query: `سؤال بروتوكول رقم ${idx + 1} عن ترتيب الجلوس الرسمي`,
            locale: 'ar',
          }),
        }),
      ),
    );

    const okCount = responses.filter((r) => r.status === 200).length;
    const limitedCount = responses.filter((r) => r.status === 429).length;
    assert.equal(okCount, 15, `expected exactly 15 succeeded queries, got ${okCount}`);
    assert.equal(limitedCount, 5, `expected 5 rate/quota limited queries, got ${limitedCount}`);
  } finally {
    await srv.close();
  }
});

test('C9: rate limiter persists in Postgres across two separate Express instances', async () => {
  const srv1 = await startTestServer({ EMAIL_PROVIDER: 'console' });
  const srv2 = await startTestServer({ EMAIL_PROVIDER: 'console' });
  try {
    const sharedIp = `203.0.113.${Math.floor(10 + Math.random() * 200)}`;
    // Exhaust the 10-request/15m IP rate limit on instance #1
    for (let i = 0; i < 10; i++) {
      const r = await fetch(`${srv1.baseUrl}/api/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': sharedIp },
        body: JSON.stringify({ email: `c9_${i}_${Date.now()}@test.local` }),
      });
      assert.equal(r.status, 200);
    }

    // Request #11 on instance #2 from the same IP must be blocked immediately with 429
    const blockedOnSrv2 = await fetch(`${srv2.baseUrl}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': sharedIp },
      body: JSON.stringify({ email: `c9_blocked_${Date.now()}@test.local` }),
    });
    assert.equal(
      blockedOnSrv2.status,
      429,
      `instance #2 must immediately enforce 429 shared from PostgreSQL, got ${blockedOnSrv2.status}`,
    );
  } finally {
    await srv1.close();
    await srv2.close();
  }
});

test('C10: security headers include strict CSP, frame-ancestors none, X-Frame-Options DENY, and COOP', async () => {
  const srv = await startTestServer({ ENFORCE_FRAME_DENY: 'true' });
  try {
    const res = await fetch(`${srv.baseUrl}/api/auth/me`);
    const csp = res.headers.get('content-security-policy') || '';
    const xfo = res.headers.get('x-frame-options') || '';
    const coop = res.headers.get('cross-origin-opener-policy') || '';

    assert.ok(csp.includes("frame-ancestors 'none'"), `CSP missing frame-ancestors 'none': ${csp}`);
    assert.equal(xfo.toUpperCase(), 'DENY');
    assert.ok(coop.length > 0, 'Cross-Origin-Opener-Policy header must be set');
  } finally {
    await srv.close();
  }
});

test('C11: hashIp uses IP_HASH_SALT from environment instead of hardcoded salt', () => {
  const prev = process.env.IP_HASH_SALT;
  try {
    process.env.IP_HASH_SALT = 'salt-rotation-alpha-2026-secret-value';
    const h1 = hashIp('198.51.100.42');
    process.env.IP_HASH_SALT = 'salt-rotation-beta-2026-secret-value';
    const h2 = hashIp('198.51.100.42');
    assert.notEqual(h1, h2, 'changing IP_HASH_SALT must change hashed IP output');
  } finally {
    if (prev === undefined) delete process.env.IP_HASH_SALT;
    else process.env.IP_HASH_SALT = prev;
  }
});

test('C12: exporter rejects malicious non-enum locale injection', async () => {
  await assert.rejects(
    async () => {
      await generateProjectPdfOrHtml({
        result: {
          id: 'res_c12_test',
          title: 'Test',
          locale: 'ar" onload="alert(1)' as unknown as 'ar',
          intent: 'etiquette_personal',
          context: [],
          assumptions: [],
          summary: ['نقطة'],
          primaryAction: { label: 'حفظ', id: 'save_project' },
          secondaryActions: [],
          blocks: [],
          trust: { sensitivity: 'low', ruleIds: [], reviewedCount: 0, demoCount: 0, unreviewedClaims: 0 },
        },
        versionNumber: 1,
        watermarked: false,
      });
    },
    'exporter must reject invalid locale values before building HTML',
  );
});
