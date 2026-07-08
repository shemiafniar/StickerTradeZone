/**
 * Minimal in-process rate limiter for actions that don't already have a
 * natural database table to count against (e.g. auth attempts, where we
 * don't want to create a row for every failed login).
 *
 * IMPORTANT: this is a "basic" per-instance limiter, not a distributed one.
 * On serverless platforms (Vercel) each warm lambda instance has its own
 * memory, so a determined attacker spread across many cold starts/instances
 * could exceed these limits. It's still a real, useful first line of
 * defense (most abuse comes from a single warm connection/session), and
 * Supabase Auth itself enforces its own server-side rate limits on top of
 * this. For a stricter guarantee at scale, swap this for a shared store
 * (e.g. Upstash Redis) behind the same `checkRateLimit` signature - no
 * caller needs to change.
 *
 * Actions with an existing table (trade requests, chat messages, scanner
 * uploads) instead count real rows in Postgres, which *is* accurate across
 * instances - see the rate-limit checks in their respective action files.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function formatRetrySeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} שניות`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} דקות`;
}
