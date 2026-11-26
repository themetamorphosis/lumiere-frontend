/** Per-account request budget. */
const RATE_LIMIT_MAX_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;

const rateLimitBuckets = new Map<string, number[]>();

export function checkChatRateLimit(accountId: string): boolean {
  const now = Date.now();
  const recent = (rateLimitBuckets.get(accountId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(accountId, recent);
    return false;
  }

  recent.push(now);
  rateLimitBuckets.set(accountId, recent);

  // Bounded cleanup so an instance that has seen many accounts doesn't grow
  // the map forever.
  if (rateLimitBuckets.size > 1000) {
    for (const [k, times] of rateLimitBuckets) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitBuckets.delete(k);
      }
    }
  }

  return true;
}

/** Test seam: the limiter is module state and would leak between test cases. */
export function __resetChatRateLimit() {
  rateLimitBuckets.clear();
}
