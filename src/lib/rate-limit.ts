import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  [key: string]: {
    tokens: number;
    lastRefill: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  limit?: number;       // Max requests
  windowMs?: number;    // Window in ms (e.g., 60000 for 1 minute)
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
) {
  const limit = options.limit || 60; // 60 requests
  const windowMs = options.windowMs || 60000; // 1 minute
  const now = Date.now();

  if (!store[identifier]) {
    store[identifier] = {
      tokens: limit,
      lastRefill: now,
    };
  }

  const record = store[identifier];
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

  const remaining = record.tokens;
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
 * Helper to get client IP from request headers
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
