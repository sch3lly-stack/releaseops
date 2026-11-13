export interface RateLimiter {
  allow(key: string): boolean;
}

export function createLoginRateLimiter(options?: {
  limit?: number;
  windowMs?: number;
  now?: () => number;
}): RateLimiter {
  const limit = options?.limit ?? 5;
  const windowMs = options?.windowMs ?? 60_000;
  const now = options?.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return {
    allow(key) {
      const time = now();
      const recent = (hits.get(key) ?? []).filter((stamp) => time - stamp < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(time);
      hits.set(key, recent);
      return true;
    },
  };
}
