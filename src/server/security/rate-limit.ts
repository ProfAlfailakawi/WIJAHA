import { lt, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { rateLimitBuckets } from '../../db/schema.ts';

/**
 * Shared PostgreSQL fixed/sliding window rate limiter (Requirement C9).
 * Safe across multiple horizontally scaled Cloud Run instances sharing PostgreSQL.
 */
export async function checkSharedRateLimit(
  key: string,
  maxRequests: number,
  windowMs = 60_000,
): Promise<boolean> {
  const now = new Date();
  const nextReset = new Date(now.getTime() + windowMs);

  const result = await db.execute(sql`
    INSERT INTO rate_limit_buckets (key, count, reset_at)
    VALUES (${key}, 1, ${nextReset})
    ON CONFLICT (key) DO UPDATE
      SET
        count = CASE
          WHEN rate_limit_buckets.reset_at <= ${now} THEN 1
          ELSE rate_limit_buckets.count + 1
        END,
        reset_at = CASE
          WHEN rate_limit_buckets.reset_at <= ${now} THEN ${nextReset}
          ELSE rate_limit_buckets.reset_at
        END
    RETURNING count
  `);

  const row = result.rows[0] as { count?: number | string } | undefined;
  const currentCount = Number(row?.count ?? 1);
  return currentCount <= maxRequests;
}

export async function purgeExpiredRateLimits(): Promise<number> {
  const deleted = await db
    .delete(rateLimitBuckets)
    .where(lt(rateLimitBuckets.resetAt, new Date()))
    .returning({ key: rateLimitBuckets.key });
  return deleted.length;
}
