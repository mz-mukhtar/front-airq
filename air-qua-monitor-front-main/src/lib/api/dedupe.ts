const inflight = new Map<string, Promise<unknown>>();
const resolved = new Map<string, { data: unknown; expires: number }>();

// Cap on resolved entries; oldest insertions are evicted first.
const MAX_RESOLVED_ENTRIES = 200;

function sweepExpired(): void {
  const now = Date.now();
  for (const [key, entry] of resolved) {
    if (entry.expires <= now) resolved.delete(key);
  }
}

/** Coalesce concurrent and recent identical API calls (helps Strict Mode + sibling components). */
export function dedupeAsync<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 15_000
): Promise<T> {
  const cached = resolved.get(key);
  if (cached) {
    if (cached.expires > Date.now()) {
      return Promise.resolve(cached.data as T);
    }
    // Evict expired entries on read so they don't linger for the session lifetime
    resolved.delete(key);
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fn()
    .then((data) => {
      resolved.set(key, { data, expires: Date.now() + ttlMs });
      while (resolved.size > MAX_RESOLVED_ENTRIES) {
        const oldest = resolved.keys().next().value;
        if (oldest === undefined) break;
        resolved.delete(oldest);
      }
      return data;
    })
    .finally(() => {
      inflight.delete(key);
      sweepExpired();
    });

  inflight.set(key, promise);
  return promise;
}
