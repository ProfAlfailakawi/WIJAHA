import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  invoices,
  orgs,
  payments,
  planEntitlements,
  revenueLedger,
  revenueSplitRules,
  subscriptions,
  usageCounters,
  webhookEvents,
} from '../../db/schema.ts';

export interface OrgEntitlementMap {
  planId: string;
  resultsPerMonth: number;
  projectsMax: number;
  exportsWatermark: boolean;
  simulationAccess: 'basic' | 'all';
  checkPlanAccess: boolean;
  seats: number;
}

export function currentPeriodKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function nextMonthResetLabel(locale: 'ar' | 'en', date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return next.toLocaleDateString(locale === 'ar' ? 'ar-KW' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function getOrgEntitlements(orgId: string | null | undefined): Promise<OrgEntitlementMap> {
  if (!orgId) {
    return {
      planId: 'free',
      resultsPerMonth: 15,
      projectsMax: 1,
      exportsWatermark: true,
      simulationAccess: 'basic',
      checkPlanAccess: false,
      seats: 1,
    };
  }

  try {
    const orgRows = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
    const planId = orgRows[0]?.planId || 'free';

    const entRows = await db
      .select()
      .from(planEntitlements)
      .where(eq(planEntitlements.planId, planId));

    const map = new Map<string, string>();
    for (const row of entRows) {
      map.set(row.entitlementKey, row.entitlementValue);
    }

    return {
      planId,
      resultsPerMonth: Number(map.get('results_per_month') ?? 15),
      projectsMax: Number(map.get('projects_max') ?? 1),
      exportsWatermark: map.get('exports_watermark') !== 'false',
      simulationAccess: map.get('simulation_access') === 'all' ? 'all' : 'basic',
      checkPlanAccess: map.get('check_plan_access') === 'true',
      seats: Number(map.get('seats') ?? 1),
    };
  } catch (error) {
    console.error('getOrgEntitlements failed:', error);
    throw new Error('Failed to load subscription entitlements.', { cause: error });
  }
}

export async function getMonthlyUsage(
  orgId: string,
  metricKey: 'results_generated' | 'exports_created' | 'checks_run',
): Promise<number> {
  try {
    const period = currentPeriodKey();
    const rows = await db
      .select()
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.orgId, orgId),
          eq(usageCounters.periodKey, period),
          eq(usageCounters.metricKey, metricKey),
        ),
      )
      .limit(1);
    return rows[0]?.usedCount ?? 0;
  } catch (error) {
    console.error('getMonthlyUsage failed:', error);
    return 0;
  }
}

export async function incrementMonthlyUsage(
  orgId: string,
  metricKey: 'results_generated' | 'exports_created' | 'checks_run',
): Promise<number> {
  try {
    const period = currentPeriodKey();
    const existing = await db
      .select()
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.orgId, orgId),
          eq(usageCounters.periodKey, period),
          eq(usageCounters.metricKey, metricKey),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(usageCounters).values({
        orgId,
        periodKey: period,
        metricKey,
        usedCount: 1,
      });
      return 1;
    }

    const nextCount = existing[0].usedCount + 1;
    await db
      .update(usageCounters)
      .set({ usedCount: nextCount, updatedAt: new Date() })
      .where(eq(usageCounters.id, existing[0].id));
    return nextCount;
  } catch (error) {
    console.error('incrementMonthlyUsage failed:', error);
    return 0;
  }
}

/**
 * Idempotent Billing Webhook Processor (Section 17.4 & Phase 5 Acceptance Criteria).
 * Sending the exact same eventId twice returns `{ duplicate: true }` and never double-bills or duplicates subscriptions.
 */
export async function processBillingWebhook(input: {
  eventId: string;
  provider: string;
  eventType: 'subscription.activated' | 'service.paid';
  orgId: string;
  userUid: string;
  targetId: string;
  billingCycle?: 'monthly' | 'annual';
  amountKwd: number;
  serviceOwner?: 'yousef' | 'ahmad' | 'joint';
}): Promise<{ duplicate: boolean; paymentId?: string }> {
  try {
    const existing = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, input.eventId))
      .limit(1);

    if (existing.length > 0) {
      return { duplicate: true };
    }

    await db.insert(webhookEvents).values({
      eventId: input.eventId,
      provider: input.provider,
      eventType: input.eventType,
      payload: input as unknown as Record<string, unknown>,
    });

    const paymentId = `pay_${crypto.randomUUID().slice(0, 12)}`;
    await db.insert(payments).values({
      id: paymentId,
      orgId: input.orgId,
      userUid: input.userUid,
      kind: input.eventType === 'subscription.activated' ? 'subscription' : 'service',
      targetId: input.targetId,
      amountKwd: input.amountKwd,
      currency: 'KWD',
      status: 'succeeded',
      provider: input.provider,
      providerTxId: `tx_${input.eventId}`,
    });

    const invNum = `INV-${new Date().getUTCFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    await db.insert(invoices).values({
      id: `inv_${crypto.randomUUID().slice(0, 10)}`,
      invoiceNumber: invNum,
      orgId: input.orgId,
      userUid: input.userUid,
      paymentId,
      amountKwd: input.amountKwd,
      descriptionAr:
        input.eventType === 'subscription.activated'
          ? `اشتراك باقة وجاهة (${input.targetId})`
          : `خدمة خبير (${input.targetId})`,
      descriptionEn:
        input.eventType === 'subscription.activated'
          ? `WIJAHA Plan Subscription (${input.targetId})`
          : `WIJAHA Specialist Engagement (${input.targetId})`,
    });

    if (input.eventType === 'subscription.activated') {
      await db
        .update(orgs)
        .set({ planId: input.targetId, updatedAt: new Date() })
        .where(eq(orgs.id, input.orgId));

      const periodDays = input.billingCycle === 'annual' ? 365 : 30;
      const periodEnd = new Date(Date.now() + periodDays * 24 * 3600 * 1000);
      const subId = `sub_${input.orgId}`;

      await db
        .insert(subscriptions)
        .values({
          id: subId,
          orgId: input.orgId,
          userUid: input.userUid,
          planId: input.targetId,
          billingCycle: input.billingCycle ?? 'monthly',
          status: 'active',
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          providerRef: input.eventId,
        })
        .onConflictDoUpdate({
          target: subscriptions.id,
          set: {
            planId: input.targetId,
            billingCycle: input.billingCycle ?? 'monthly',
            status: 'active',
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            updatedAt: new Date(),
          },
        });
    } else if (input.eventType === 'service.paid') {
      const owner = input.serviceOwner ?? 'yousef';
      const splitRows = await db
        .select()
        .from(revenueSplitRules)
        .where(eq(revenueSplitRules.ownerType, owner))
        .limit(1);

      const splitSnapshot = splitRows[0]
        ? {
            platformSharePct: splitRows[0].platformSharePct,
            yousefSharePct: splitRows[0].yousefSharePct,
            ahmadSharePct: splitRows[0].ahmadSharePct,
          }
        : { platformSharePct: null, yousefSharePct: null, ahmadSharePct: null };

      await db.insert(revenueLedger).values({
        id: `led_${crypto.randomUUID().slice(0, 10)}`,
        paymentId,
        serviceId: input.targetId,
        serviceOwner: owner,
        grossAmountKwd: input.amountKwd,
        splitSnapshot,
      });
    }

    return { duplicate: false, paymentId };
  } catch (error) {
    console.error('processBillingWebhook failed:', error);
    throw new Error('Failed to process billing event.', { cause: error });
  }
}
