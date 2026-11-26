import { and, eq, inArray, isNotNull, lt, not, like } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  competencyScores,
  expertSuggestionEvents,
  exportsLog,
  feedback,
  orgs,
  queries,
  serviceRequests,
  simulationRuns,
  users,
} from '../../db/schema.ts';

/**
 * Accounts are soft-deleted by POST /api/account/delete and can be recovered for
 * ACCOUNT_RECOVERY_DAYS. After that window this purge removes the account and its
 * personal data for good (Google Play / GDPR deletion requirement).
 *
 * Kept on purpose: payments and invoices (accounting/legal retention) and audit logs
 * (security). Demo accounts (uid "demo:*") are never purged.
 */
export const ACCOUNT_RECOVERY_DAYS = 14;

export async function purgeDeletedAccounts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ACCOUNT_RECOVERY_DAYS * 24 * 3600 * 1000);
  const due = await db
    .select({ uid: users.uid })
    .from(users)
    .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, cutoff), not(like(users.uid, 'demo:%'))));
  for (const { uid } of due) {
    await db.transaction(async (tx) => {
      await tx.delete(queries).where(eq(queries.userUid, uid)); // results cascade
      await tx.delete(feedback).where(eq(feedback.userUid, uid));
      await tx.delete(simulationRuns).where(eq(simulationRuns.userUid, uid)); // steps cascade
      await tx.delete(competencyScores).where(eq(competencyScores.userUid, uid));
      await tx.delete(expertSuggestionEvents).where(eq(expertSuggestionEvents.userUid, uid));
      await tx.delete(serviceRequests).where(eq(serviceRequests.requesterUid, uid));
      await tx.delete(exportsLog).where(eq(exportsLog.userUid, uid));
      // Personal workspace (and everything that cascades from it: projects, memberships, subscriptions).
      const personalOrgId = `personal_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await tx.delete(orgs).where(and(inArray(orgs.id, [personalOrgId]), eq(orgs.isPersonal, true)));
      // The user row last: sessions, memberships and owned projects cascade.
      await tx.delete(users).where(eq(users.uid, uid));
    });
  }
  return due.length;
}

export function schedulePurge(intervalMs = 6 * 3600 * 1000): void {
  const run = () =>
    purgeDeletedAccounts()
      .then((n) => {
        if (n) console.log(`account purge: removed ${n} account(s) past the ${ACCOUNT_RECOVERY_DAYS}-day window`);
      })
      .catch((error) => console.error('account purge failed:', error));
  setTimeout(run, 60_000).unref?.();
  setInterval(run, intervalMs).unref?.();
}
