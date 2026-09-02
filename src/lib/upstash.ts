// Upstash Redis client. Used for two things:
//   1) The "anything new on this board?" probe so we don't hit MongoDB on
//      every poll when nothing has changed.
//   2) Per-partner rate limiting on the live feed endpoint so a runaway
//      client can't melt the API.
//
// Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in
// the environment for this to be active. If either is missing we fall back
// to a no-op shim — every probe says "you might have missed something",
// callers query Mongo, and the rate limiter always says "allowed". This
// means local dev keeps working without provisioning Upstash and a brief
// outage of Upstash never breaks the app.

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type RedisLike = {
  set: (key: string, value: string) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
};

const URL = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const upstashEnabled = Boolean(URL && TOKEN);

let _redis: Redis | null = null;
function client(): Redis | null {
  if (!upstashEnabled) return null;
  if (_redis) return _redis;
  _redis = new Redis({ url: URL, token: TOKEN });
  return _redis;
}

// Best-effort wrapper. Never throw — if Upstash is unreachable we want
// callers to fall through to the Mongo path, not 500 the request.
const noopRedis: RedisLike = {
  async set() {
    return null;
  },
  async get() {
    return null;
  },
};

function safe(): RedisLike {
  const c = client();
  if (!c) return noopRedis;
  return {
    async set(key, value) {
      try {
        return await c.set(key, value);
      } catch (err) {
        console.warn("[upstash] set failed:", err);
        return null;
      }
    },
    async get(key) {
      try {
        const v = await c.get<string>(key);
        return v ?? null;
      } catch (err) {
        console.warn("[upstash] get failed:", err);
        return null;
      }
    },
  };
}

export const redisSafe = safe();

// Rate limiter: 60 requests per 10 seconds per partner. The live feed is
// the only chatty endpoint, and a single tab polls at most ~1 req/s, so
// 60/10s comfortably covers ~6 simultaneous tabs of the same partner
// before throttling. Bursts up to 6 are allowed via the sliding window.
let _liveLimiter: Ratelimit | null = null;
export function liveFeedLimiter(): Ratelimit | null {
  const c = client();
  if (!c) return null;
  if (_liveLimiter) return _liveLimiter;
  _liveLimiter = new Ratelimit({
    redis: c,
    limiter: Ratelimit.slidingWindow(60, "10 s"),
    prefix: "le:rl:live",
    analytics: false,
  });
  return _liveLimiter;
}

// Rate limiter for the public contact form: 5 submissions per hour per IP.
// The endpoint sends mail on behalf of an anonymous visitor, so it must not
// be usable as a relay. Generous enough that a person correcting a typo and
// resubmitting is never blocked.
let _contactLimiter: Ratelimit | null = null;
export function contactLimiter(): Ratelimit | null {
  const c = client();
  if (!c) return null;
  if (_contactLimiter) return _contactLimiter;
  _contactLimiter = new Ratelimit({
    redis: c,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "le:rl:contact",
    analytics: false,
  });
  return _contactLimiter;
}

// Key helpers — keep all keys namespaced under `le:` and prefer ids over
// human-readable names so renames don't strand keys.
export const keys = {
  boardLatestActivity: (partnerId: string, boardId: string) =>
    `le:board:${partnerId}:${boardId}:latest`,
  partnerLatestActivity: (partnerId: string) =>
    `le:partner:${partnerId}:latest`,
};
