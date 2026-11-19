import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  billingCheckoutSessions,
  invoices,
  orgs,
  payments,
  planEntitlements,
  revenueLedger,
  revenueSplitRules,
  serviceRequests,
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
 * Atomic monthly quota reservation (Requirement C8).
 * Prevents race conditions where parallel requests bypass monthly plan limits.
 */
export async function reserveMonthlyQuota(
  bucketId: string,
  metricKey: 'results_generated' | 'exports_created' | 'checks_run',
  limit: number,
): Promise<{ allowed: boolean; usedCount: number }> {
  if (limit <= 0) {
    return { allowed: false, usedCount: 0 };
  }
  const period = currentPeriodKey();
  const res = await db.execute(sql`
    INSERT INTO usage_counters (org_id, period_key, metric_key, used_count, updated_at)
    VALUES (${bucketId}, ${period}, ${metricKey}, 1, NOW())
    ON CONFLICT (org_id, period_key, metric_key)
    DO UPDATE SET
      used_count = usage_counters.used_count + 1,
      updated_at = NOW()
    WHERE usage_counters.used_count < ${limit}
    RETURNING used_count
  `);

  if (res.rows.length === 0) {
    const cur = await getMonthlyUsage(bucketId, metricKey);
    return { allowed: false, usedCount: cur };
  }

  const usedCount = Number((res.rows[0] as { used_count?: number | string })?.used_count ?? 1);
  return { allowed: true, usedCount };
}

export async function refundMonthlyQuota(
  bucketId: string,
  metricKey: 'results_generated' | 'exports_created' | 'checks_run',
): Promise<void> {
  try {
    const period = currentPeriodKey();
    await db.execute(sql`
      UPDATE usage_counters
      SET used_count = GREATEST(0, used_count - 1), updated_at = NOW()
      WHERE org_id = ${bucketId} AND period_key = ${period} AND metric_key = ${metricKey}
    `);
  } catch (error) {
    console.error('refundMonthlyQuota failed:', error);
  }
}

/**
 * Atomic & Idempotent Billing Webhook Processor (A3).
 * Executes inside a single PostgreSQL transaction so webhook_events, payments,
 * invoices, orgs/subscriptions (or service_requests/revenue_ledger), and
 * billing_checkout_sessions succeed or roll back together.
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
  serviceRequestId?: string | null;
  serviceOwner?: 'yousef' | 'ahmad' | 'joint';
  checkoutSessionId?: string | null;
}): Promise<{ duplicate: boolean; paymentId?: string }> {
  try {
    return await db.transaction(async (tx) => {
      const insertedEvents = await tx
        .insert(webhookEvents)
        .values({
          eventId: input.eventId,
          provider: input.provider,
          eventType: input.eventType,
          payload: {
            eventId: input.eventId,
            provider: input.provider,
            eventType: input.eventType,
            orgId: input.orgId,
            targetId: input.targetId,
            amountKwd: input.amountKwd,
            checkoutSessionId: input.checkoutSessionId ?? null,
            serviceRequestId: input.serviceRequestId ?? null,
          },
        })
        .onConflictDoNothing({ target: webhookEvents.eventId })
        .returning({ id: webhookEvents.id });

      if (insertedEvents.length === 0) {
        return { duplicate: true };
      }

      const paymentId = `pay_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await tx.insert(payments).values({
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

      const invNum = `INV-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      await tx.insert(invoices).values({
        id: `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
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
        await tx
          .update(orgs)
          .set({ planId: input.targetId, updatedAt: new Date() })
          .where(eq(orgs.id, input.orgId));

        const periodDays = input.billingCycle === 'annual' ? 365 : 30;
        const periodEnd = new Date(Date.now() + periodDays * 24 * 3600 * 1000);
        const subId = `sub_${input.orgId}`;

        await tx
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
        if (input.serviceRequestId) {
          await tx
            .update(serviceRequests)
            .set({
              paid: true,
              status: 'in_progress',
              updatedAt: new Date(),
            })
            .where(eq(serviceRequests.id, input.serviceRequestId));
        }

        const owner = input.serviceOwner ?? 'yousef';
        const splitRows = await tx
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

        await tx.insert(revenueLedger).values({
          id: `led_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
          paymentId,
          serviceId: input.targetId,
          serviceOwner: owner,
          grossAmountKwd: input.amountKwd,
          splitSnapshot,
        });
      }

      if (input.checkoutSessionId) {
        await tx
          .update(billingCheckoutSessions)
          .set({ status: 'completed' })
          .where(eq(billingCheckoutSessions.id, input.checkoutSessionId));
      }

      return { duplicate: false, paymentId };
    });
  } catch (error) {
    console.error('processBillingWebhook failed:', error);
    throw new Error('Failed to process billing event.', { cause: error });
  }
}
