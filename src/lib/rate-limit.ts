import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  [key: string]: {
    tokens: number;
    lastRefill: number;
    windowMs: number;
  };
}

const store: RateLimitStore = {};
let lastCleanup = Date.now();

/**
 * Periodically purge expired buckets to prevent unbounded memory growth.
 */
function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup < 60000) return; // Cleanup at most once per minute
  lastCleanup = now;

  for (const key of Object.keys(store)) {
    if (now - store[key].lastRefill > store[key].windowMs * 2) {
      delete store[key];
    }
  }
}

interface RateLimitOptions {
  limit?: number;       // Max requests
  windowMs?: number;    // Window in ms (e.g., 60000 for 1 minute)
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Token bucket rate limiter for Next.js App Router route handlers.
 * @param identifier Unique key (e.g. IP address or API key prefix)
 * @param options limit and windowMs
 * @returns { success: boolean, limit: number, remaining: number, resetMs: number }
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  cleanupStore();

  const limit = options.limit || 60; // 60 requests
  const windowMs = options.windowMs || 60000; // 1 minute
  const now = Date.now();

  if (!store[identifier]) {
    store[identifier] = {
      tokens: limit,
      lastRefill: now,
      windowMs,
    };
  }

  const record = store[identifier];
  record.windowMs = windowMs;
  const timeElapsed = now - record.lastRefill;

  // Refill tokens proportionally over elapsed time
  if (timeElapsed > windowMs) {
    record.tokens = limit;
    record.lastRefill = now;
  } else {
    const refillTokens = Math.floor((timeElapsed / windowMs) * limit);
    if (refillTokens > 0) {
      record.tokens = Math.min(limit, record.tokens + refillTokens);
      record.lastRefill = now;
    }
  }

  const resetMs = Math.max(0, windowMs - (now - record.lastRefill));

  if (record.tokens > 0) {
    record.tokens--;
    return {
      success: true,
      limit,
      remaining: record.tokens,
      resetMs,
    };
  }

  return {
    success: false,
    limit,
    remaining: 0,
    resetMs,
  };
}

/**
 * Helper to build standard 429 Too Many Requests response with rate-limit headers.
 */
export function rateLimitExceededResponse(
  rl: RateLimitResult,
  customMessage: string = "Too many requests. Please slow down and try again later."
): NextResponse {
  return NextResponse.json(
    {
      error: "Rate Limit Exceeded",
      message: customMessage,
      retryAfterSeconds: Math.ceil(rl.resetMs / 1000),
    },
    {
      status: 429,
      headers: {
        "Retry-After": Math.ceil(rl.resetMs / 1000).toString(),
        "X-RateLimit-Limit": rl.limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": Math.ceil((Date.now() + rl.resetMs) / 1000).toString(),
      },
    }
  );
}

/**
 * Helper to get client IP from request headers
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * Reset all rate limits (for testing purposes)
 */
export function clearRateLimits(): void {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}
