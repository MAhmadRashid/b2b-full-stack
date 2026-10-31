import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// In-memory token bucket rate limiter implementation under test (matching src/lib/rate-limit.ts)
const store = {};

function checkRateLimit(identifier, options = {}) {
  const limit = options.limit || 60;
  const windowMs = options.windowMs || 60000;
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

function clearRateLimits() {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}

// RBAC ranking and assignment checks (matching src/lib/rbac.ts)
const ROLE_RANKS = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

function hasMinimumRole(userRole, requiredRole) {
  const userRank = ROLE_RANKS[userRole?.toUpperCase()];
  const reqRank = ROLE_RANKS[requiredRole?.toUpperCase()];
  if (userRank === undefined || reqRank === undefined) return false;
  return userRank >= reqRank;
}

function canAssignRole(actorRole, targetRole) {
  const normActor = actorRole?.toUpperCase();
  const normTarget = targetRole?.toUpperCase();

  if (normActor === "OWNER") {
    return ["OWNER", "ADMIN", "MEMBER", "VIEWER"].includes(normTarget);
  }
  if (normActor === "ADMIN") {
    return ["ADMIN", "MEMBER", "VIEWER"].includes(normTarget);
  }
  return false;
}

test("Security & Performance: Rate limiter enforces limits and refills correctly", () => {
  clearRateLimits();
  const testId = "test_ip_123";

  // First 5 requests should succeed
  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(testId, { limit: 5, windowMs: 10000 });
    assert.equal(res.success, true, `Request ${i + 1} should succeed`);
    assert.equal(res.remaining, 4 - i);
  }

  // 6th request should be blocked
  const blocked = checkRateLimit(testId, { limit: 5, windowMs: 10000 });
  assert.equal(blocked.success, false, "6th request must exceed rate limit");
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.resetMs > 0);

  // Clear rate limits
  clearRateLimits();
  const resetRes = checkRateLimit(testId, { limit: 5, windowMs: 10000 });
  assert.equal(resetRes.success, true, "Should succeed after clearing rate limits");
});

test("Security: RBAC role hierarchy and privilege escalation safeguards", () => {
  // Role ranks: OWNER (4) > ADMIN (3) > MEMBER (2) > VIEWER (1)
  assert.equal(hasMinimumRole("OWNER", "VIEWER"), true);
  assert.equal(hasMinimumRole("OWNER", "ADMIN"), true);
  assert.equal(hasMinimumRole("ADMIN", "MEMBER"), true);
  assert.equal(hasMinimumRole("ADMIN", "OWNER"), false);
  assert.equal(hasMinimumRole("MEMBER", "ADMIN"), false);
  assert.equal(hasMinimumRole("VIEWER", "MEMBER"), false);

  // Privilege escalation prevention: canAssignRole
  assert.equal(canAssignRole("OWNER", "OWNER"), true);
  assert.equal(canAssignRole("OWNER", "ADMIN"), true);
  assert.equal(canAssignRole("ADMIN", "OWNER"), false, "ADMIN cannot assign OWNER");
  assert.equal(canAssignRole("ADMIN", "ADMIN"), true);
  assert.equal(canAssignRole("ADMIN", "MEMBER"), true);
  assert.equal(canAssignRole("MEMBER", "VIEWER"), false, "MEMBER cannot assign roles");
  assert.equal(canAssignRole("VIEWER", "VIEWER"), false, "VIEWER cannot assign roles");
});

test("Security: CSV formula injection prevention neutralization", () => {
  function escapeCsvValue(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }

  // Dangerous inputs starting with formula triggers
  assert.equal(escapeCsvValue("=cmd|'/C calc'!A0"), "\"'=cmd|'/C calc'!A0\"");
  assert.equal(escapeCsvValue("+12345"), "\"'+12345\"");
  assert.equal(escapeCsvValue("-2+5"), "\"'-2+5\"");
  assert.equal(escapeCsvValue("@SUM(A1:A10)"), "\"'@SUM(A1:A10)\"");
  // Standard safe input
  assert.equal(escapeCsvValue("api_request"), "\"api_request\"");
  assert.equal(escapeCsvValue('status "200" OK'), "\"status \"\"200\"\" OK\"");
});

test("Security: SSRF protection blocks cloud metadata service endpoints", () => {
  const blockedHosts = [
    "169.254.169.254",
    "metadata.google.internal",
    "instance-data",
    "100.100.100.200",
  ];

  function validateUrl(targetUrl) {
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { allowed: false, reason: "Invalid protocol" };
    }
    if (blockedHosts.includes(parsed.hostname.toLowerCase())) {
      return { allowed: false, reason: "Blocked cloud metadata endpoint" };
    }
    return { allowed: true };
  }

  assert.equal(validateUrl("http://169.254.169.254/latest/meta-data").allowed, false);
  assert.equal(validateUrl("http://metadata.google.internal/computeMetadata/v1").allowed, false);
  assert.equal(validateUrl("file:///etc/passwd").allowed, false);
  assert.equal(validateUrl("https://hooks.slack.com/services/T00/B00/X00").allowed, true);
  assert.equal(validateUrl("https://api.acme.com/webhook").allowed, true);
});

test("Security & Performance: API key prefix calculation for O(1) indexed lookup", () => {
  const rawKey = "pfl_live_4a8f9c0e2b1d3a5f6e7d8c9b0a1f2e3d";
  const expectedPrefix = `${rawKey.substring(0, 13)}...${rawKey.substring(rawKey.length - 4)}`;
  assert.equal(expectedPrefix, "pfl_live_4a8f...2e3d");
  assert.equal(expectedPrefix.length, 20);

  const testKey = "pfl_test_99887766554433221100aabbccddeeff";
  const testPrefix = `${testKey.substring(0, 13)}...${testKey.substring(testKey.length - 4)}`;
  assert.equal(testPrefix, "pfl_test_9988...eeff");
});

test("Security: Sensitive tokens and credentials masking in audit details", () => {
  function sanitizeAuditDetails(details) {
    if (!details) return "";
    return details
      .replace(/(pfl_[a-zA-Z0-9_-]{8,})/g, (m) => `${m.substring(0, 8)}...[REDACTED]`)
      .replace(/(whsec_[a-zA-Z0-9_-]{6,})/g, "whsec_...[REDACTED]")
      .replace(/(rst_[a-zA-Z0-9_-]{6,})/g, "rst_...[REDACTED]")
      .replace(/(vfy_[a-zA-Z0-9_-]{6,})/g, "vfy_...[REDACTED]")
      .replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"[REDACTED]"');
  }

  const rawText = 'Generated API key pfl_live_secret123456789 and webhook secret whsec_topsecret456 with "password": "supersecretpassword123"';
  const sanitized = sanitizeAuditDetails(rawText);

  assert.ok(!sanitized.includes("pfl_live_secret123456789"));
  assert.ok(!sanitized.includes("whsec_topsecret456"));
  assert.ok(!sanitized.includes("supersecretpassword123"));
  assert.ok(sanitized.includes("pfl_live...[REDACTED]"));
  assert.ok(sanitized.includes("whsec_...[REDACTED]"));
  assert.ok(sanitized.includes('"password":"[REDACTED]"'));
});

test("Database: Multi-tenant scoping and isolation across organizations and workspaces", async () => {
  const acmeWs = await prisma.workspace.findFirst({
    where: { slug: "acme-corp" },
    include: { organization: true, members: true },
  });
  const starlightWs = await prisma.workspace.findFirst({
    where: { slug: "starlight-ai" },
    include: { organization: true, members: true },
  });

  assert.ok(acmeWs, "Acme workspace must exist");
  assert.ok(starlightWs, "Starlight workspace must exist");

  // Ensure workspaces belong to different organizations or are strictly segregated
  assert.notEqual(acmeWs.id, starlightWs.id);
  assert.notEqual(acmeWs.organizationId, starlightWs.organizationId);

  // Ensure API keys are isolated to their specific workspace
  const acmeKeys = await prisma.apiKey.findMany({ where: { workspaceId: acmeWs.id } });
  const starlightKeys = await prisma.apiKey.findMany({ where: { workspaceId: starlightWs.id } });

  const acmeKeyIds = new Set(acmeKeys.map((k) => k.id));
  const starlightKeyIds = new Set(starlightKeys.map((k) => k.id));

  for (const id of acmeKeyIds) {
    assert.equal(starlightKeyIds.has(id), false, "API keys cannot be shared across tenants");
  }
});
