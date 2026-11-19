import crypto from 'node:crypto';
import type { ValidatedServerEnv } from '../config/env.ts';

export interface CreateCheckoutSessionInput {
  checkoutSessionId: string;
  orgId: string;
  userUid: string;
  kind: 'subscription' | 'service';
  targetId: string;
  title: string;
  amountKwd: number;
  billingCycle?: 'monthly' | 'annual';
  successPath?: string;
  cancelPath?: string;
}

export interface VerifiedBillingEvent {
  eventId: string;
  eventType: 'checkout.completed' | 'ignored';
  checkoutSessionId?: string;
  providerSessionId?: string;
}

export interface BillingProvider {
  readonly name: 'mock' | 'stripe';
  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<{ providerSessionId: string; checkoutUrl: string }>;
  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean;
  parseEvent(rawBody: Buffer): VerifiedBillingEvent;
  cancelSubscription(input: { orgId: string; providerRef?: string | null }): Promise<void>;
  signMockWebhookPayload?(payloadJson: string, timestampSec?: number): string;
}

const WEBHOOK_TOLERANCE_SECONDS = 300;

function getHeaderString(
  headers: Record<string, string | string[] | undefined>,
  lowerName: string,
): string | null {
  const val = headers[lowerName] ?? headers[lowerName.toLowerCase()];
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  if (Array.isArray(val) && val[0]) return val[0].trim();
  return null;
}

function verifyTimestampedHmacSignature(
  rawBody: Buffer,
  sigHeader: string,
  secret: string,
): boolean {
  const parts = sigHeader.split(',').map((p) => p.trim());
  let timestampStr: string | null = null;
  const v1Signatures: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = part.slice(0, eqIdx);
    const v = part.slice(eqIdx + 1);
    if (k === 't') timestampStr = v;
    if (k === 'v1' && /^[0-9a-fA-F]{64}$/.test(v)) v1Signatures.push(v.toLowerCase());
  }

  if (!timestampStr || v1Signatures.length === 0) return false;
  const ts = Number(timestampStr);
  if (!Number.isFinite(ts)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${ts}.${rawBody.toString('utf8')}`;
  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')
    .toLowerCase();
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  for (const candidateHex of v1Signatures) {
    const candidateBuf = Buffer.from(candidateHex, 'hex');
    if (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      return true;
    }
  }
  return false;
}

class MockBillingProvider implements BillingProvider {
  readonly name = 'mock' as const;
  private readonly appUrl: string;
  private readonly signingSecret: string;

  constructor(env: ValidatedServerEnv) {
    if (env.isProduction) {
      throw new Error('MockBillingProvider cannot be instantiated in production (A3).');
    }
    this.appUrl = env.APP_URL.replace(/\/$/, '');
    this.signingSecret = env.sessionSecret;
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<{ providerSessionId: string; checkoutUrl: string }> {
    const providerSessionId = `cs_mock_${crypto.randomUUID()}`;
    const returnPath = input.successPath || '/pricing';
    const checkoutUrl = `${this.appUrl}${returnPath}?checkout_session=${encodeURIComponent(input.checkoutSessionId)}`;
    return { providerSessionId, checkoutUrl };
  }

  signMockWebhookPayload(payloadJson: string, timestampSec = Math.floor(Date.now() / 1000)): string {
    const digest = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${timestampSec}.${payloadJson}`, 'utf8')
      .digest('hex');
    return `t=${timestampSec},v1=${digest}`;
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const sig = getHeaderString(headers, 'x-wijaha-mock-signature');
    if (!sig) return false;
    return verifyTimestampedHmacSignature(rawBody, sig, this.signingSecret);
  }

  parseEvent(rawBody: Buffer): VerifiedBillingEvent {
    const parsed = JSON.parse(rawBody.toString('utf8')) as {
      eventId?: string;
      eventType?: string;
      checkoutSessionId?: string;
      providerSessionId?: string;
    };
    if (!parsed.eventId || typeof parsed.eventId !== 'string') {
      throw new Error('Missing eventId in mock webhook payload.');
    }
    const isCompleted =
      parsed.eventType === 'checkout.completed' ||
      parsed.eventType === 'subscription.activated' ||
      parsed.eventType === 'service.paid';
    return {
      eventId: parsed.eventId,
      eventType: isCompleted ? 'checkout.completed' : 'ignored',
      checkoutSessionId:
        typeof parsed.checkoutSessionId === 'string' ? parsed.checkoutSessionId : undefined,
      providerSessionId:
        typeof parsed.providerSessionId === 'string' ? parsed.providerSessionId : undefined,
    };
  }

  async cancelSubscription(): Promise<void> {
    // No external API call required in mock mode
  }
}

class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe' as const;
  private readonly appUrl: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(env: ValidatedServerEnv) {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required for Stripe billing.');
    }
    this.appUrl = env.APP_URL.replace(/\/$/, '');
    this.secretKey = env.STRIPE_SECRET_KEY;
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<{ providerSessionId: string; checkoutUrl: string }> {
    const successPath = input.successPath || '/pricing?checkout=success';
    const cancelPath = input.cancelPath || '/pricing?checkout=cancelled';

    // KWD is a 3-decimal currency in Stripe (1 KWD = 1000 fils)
    const unitAmountFils = Math.max(0, Math.round(input.amountKwd * 1000));

    const body = new URLSearchParams();
    body.set('mode', 'payment');
    body.set('client_reference_id', input.checkoutSessionId);
    body.set('success_url', `${this.appUrl}${successPath}`);
    body.set('cancel_url', `${this.appUrl}${cancelPath}`);
    body.set('metadata[checkout_session_id]', input.checkoutSessionId);
    body.set('metadata[org_id]', input.orgId);
    body.set('metadata[kind]', input.kind);
    body.set('metadata[target_id]', input.targetId);
    body.set('line_items[0][quantity]', '1');
    body.set('line_items[0][price_data][currency]', 'kwd');
    body.set('line_items[0][price_data][unit_amount]', String(unitAmountFils));
    body.set('line_items[0][price_data][product_data][name]', input.title);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Stripe checkout session creation failed (${response.status}): ${errBody.slice(0, 200)}`);
    }

    const session = (await response.json()) as { id: string; url: string | null };
    if (!session.id || !session.url) {
      throw new Error('Stripe checkout session response missing id or url.');
    }

    return { providerSessionId: session.id, checkoutUrl: session.url };
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const sig = getHeaderString(headers, 'stripe-signature');
    if (!sig) return false;
    return verifyTimestampedHmacSignature(rawBody, sig, this.webhookSecret);
  }

  parseEvent(rawBody: Buffer): VerifiedBillingEvent {
    const parsed = JSON.parse(rawBody.toString('utf8')) as {
      id?: string;
      type?: string;
      data?: {
        object?: {
          id?: string;
          client_reference_id?: string | null;
          metadata?: Record<string, string | undefined>;
        };
      };
    };
    if (!parsed.id || typeof parsed.id !== 'string') {
      throw new Error('Invalid Stripe event payload: missing id.');
    }
    if (parsed.type === 'checkout.session.completed') {
      const obj = parsed.data?.object;
      return {
        eventId: parsed.id,
        eventType: 'checkout.completed',
        providerSessionId: obj?.id,
        checkoutSessionId:
          obj?.metadata?.checkout_session_id || obj?.client_reference_id || undefined,
      };
    }
    return {
      eventId: parsed.id,
      eventType: 'ignored',
    };
  }

  async cancelSubscription(input: { orgId: string; providerRef?: string | null }): Promise<void> {
    if (!input.providerRef || !input.providerRef.startsWith('sub_')) {
      return;
    }
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(input.providerRef)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.secretKey}` },
      },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Stripe subscription cancellation failed (${response.status}).`);
    }
  }
}

export function createBillingProvider(env: ValidatedServerEnv): BillingProvider {
  if (env.BILLING_PROVIDER === 'stripe') {
    return new StripeBillingProvider(env);
  }
  return new MockBillingProvider(env);
}
