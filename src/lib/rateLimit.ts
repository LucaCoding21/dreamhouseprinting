// Tiny dependency-free sliding-window rate limiter.
//
// CAVEAT: the window lives in module-level memory, so it is per-serverless-
// instance, not global. Under fan-out this only blunts abusive bursts routed to
// the same instance, an acceptable stopgap for signed-URL minting, not a hard
// quota. Swap for a shared store (Redis/Upstash) if a real guarantee is needed.

const store = new Map<string, number[]>(); // key -> request timestamps (ms)
let lastPrune = 0;

/**
 * Records a hit for `key` and returns true when it is within `limit` requests in
 * the trailing `windowMs`, false once the allowance is exceeded (no hit recorded
 * on rejection, so a blocked caller can't push its own window forward).
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Opportunistic sweep so the Map can't grow unbounded across many keys.
  if (now - lastPrune > windowMs) {
    for (const [k, hits] of store) {
      const kept = hits.filter((t) => t > cutoff);
      if (kept.length) store.set(k, kept);
      else store.delete(k);
    }
    lastPrune = now;
  }

  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    store.set(key, hits);
    return false;
  }
  hits.push(now);
  store.set(key, hits);
  return true;
}
