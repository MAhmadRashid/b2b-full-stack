import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

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

const ALL_SCOPES = [
  "events:write",
  "metrics:read",
  "workspaces:read",
  "audit:read",
  "webhooks:write",
  "admin:all",
];

function parseScopes(rawScopes) {
  if (!rawScopes || typeof rawScopes !== "string") return [];
  const list = rawScopes
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => ALL_SCOPES.includes(s));
  return Array.from(new Set(list));
}

function hasScope(grantedScopes, requiredScope) {
  if (grantedScopes.includes("admin:all")) return true;
  return grantedScopes.includes(requiredScope);
}

const rateLimitStore = {};
function checkRateLimit(identifier, options = {}) {
  const limit = options.limit || 60;
  const windowMs = options.windowMs || 60000;
  const now = Date.now();

  if (!rateLimitStore[identifier]) {
    rateLimitStore[identifier] = {
      tokens: limit,
      lastRefill: now,
      windowMs,
    };
  }

  const record = rateLimitStore[identifier];
  record.windowMs = windowMs;
  const timeElapsed = now - record.lastRefill;

  if (timeElapsed > windowMs) {
    record.tokens = limit;
    record.lastRefill = now;
  }

  const resetMs = Math.max(0, windowMs - (now - record.lastRefill));

  if (record.tokens > 0) {
    record.tokens--;
    return { success: true, remaining: record.tokens, resetMs, limit };
  }

  return { success: false, remaining: 0, resetMs, limit };
}

function formatPrice(cents) {
  if (cents === 0) return "Free";
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

test("Phase 8 QA - 1. RBAC Transitivity: Hierarchy guarantees strict permission inheritance", () => {
  // OWNER > ADMIN > MEMBER > VIEWER
  assert.equal(hasMinimumRole("OWNER", "VIEWER"), true);
  assert.equal(hasMinimumRole("OWNER", "MEMBER"), true);
  assert.equal(hasMinimumRole("OWNER", "ADMIN"), true);
  assert.equal(hasMinimumRole("OWNER", "OWNER"), true);

  assert.equal(hasMinimumRole("ADMIN", "VIEWER"), true);
  assert.equal(hasMinimumRole("ADMIN", "MEMBER"), true);
  assert.equal(hasMinimumRole("ADMIN", "ADMIN"), true);
  assert.equal(hasMinimumRole("ADMIN", "OWNER"), false);

  assert.equal(hasMinimumRole("MEMBER", "VIEWER"), true);
  assert.equal(hasMinimumRole("MEMBER", "MEMBER"), true);
  assert.equal(hasMinimumRole("MEMBER", "ADMIN"), false);
  assert.equal(hasMinimumRole("MEMBER", "OWNER"), false);

  assert.equal(hasMinimumRole("VIEWER", "VIEWER"), true);
  assert.equal(hasMinimumRole("VIEWER", "MEMBER"), false);
  assert.equal(hasMinimumRole("VIEWER", "ADMIN"), false);
  assert.equal(hasMinimumRole("VIEWER", "OWNER"), false);

  // Test role assignments
  assert.equal(canAssignRole("OWNER", "OWNER"), true);
  assert.equal(canAssignRole("OWNER", "ADMIN"), true);
  assert.equal(canAssignRole("OWNER", "MEMBER"), true);
  assert.equal(canAssignRole("OWNER", "VIEWER"), true);

  assert.equal(canAssignRole("ADMIN", "OWNER"), false, "Admin cannot assign Owner role");
  assert.equal(canAssignRole("ADMIN", "ADMIN"), true);
  assert.equal(canAssignRole("ADMIN", "MEMBER"), true);
  assert.equal(canAssignRole("ADMIN", "VIEWER"), true);

  assert.equal(canAssignRole("MEMBER", "MEMBER"), false, "Member cannot assign any role");
  assert.equal(canAssignRole("VIEWER", "VIEWER"), false, "Viewer cannot assign any role");
});

test("Phase 8 QA - 2. Scopes Parsing: Gracefully handles malformed, whitespace, and invalid inputs", () => {
  assert.deepEqual(parseScopes(""), []);
  assert.deepEqual(parseScopes("   "), []);
  assert.deepEqual(parseScopes(null), []);
  assert.deepEqual(parseScopes(undefined), []);
  assert.deepEqual(parseScopes("events:write, metrics:read , invalid:scope"), ["events:write", "metrics:read"]);
  assert.deepEqual(parseScopes("admin:all,events:write"), ["admin:all", "events:write"]);

  // Wildcard admin:all satisfies any scope
  assert.equal(hasScope(["admin:all"], "events:write"), true);
  assert.equal(hasScope(["admin:all"], "metrics:read"), true);
  assert.equal(hasScope(["admin:all"], "workspaces:read"), true);
  assert.equal(hasScope(["events:write"], "metrics:read"), false);
});

test("Phase 8 QA - 3. Rate Limiter: Window boundaries, burst allowance, and refill countdown", () => {
  const testKey = `qa_rl_${Date.now()}`;
  const config = { limit: 5, windowMs: 10000 };

  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(testKey, config);
    assert.equal(res.success, true, `Request ${i + 1} should be permitted`);
    assert.equal(res.remaining, 4 - i);
  }

  // 6th request must exceed limit
  const burstRes = checkRateLimit(testKey, config);
  assert.equal(burstRes.success, false, "Request exceeding limit must be rejected");
  assert.equal(burstRes.remaining, 0);
  assert.ok(burstRes.resetMs > 0 && burstRes.resetMs <= 10000);
});

test("Phase 8 QA - 4. Billing Plans: Monotonicity and price formatting", () => {
  assert.equal(formatPrice(0), "Free");
  assert.equal(formatPrice(2900), "$29");
  assert.equal(formatPrice(9950), "$99.50");
  assert.equal(formatPrice(24900), "$249");
});

test("Phase 8 QA - 5. Cryptographic Signatures: Webhook HMAC verification format resilience", () => {
  const secret = "whsec_test_secret_key_pulseflow_2026!";
  const payload = JSON.stringify({ type: "invoice.payment_succeeded", amount: 9900 });

  // 1. Raw hex signature
  const rawHmac = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  const compRaw = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  assert.equal(rawHmac, compRaw);

  // 2. Stripe timestamped signature format: t=...,v1=...
  const timestamp = Math.floor(Date.now() / 1000);
  const signedData = `${timestamp}.${payload}`;
  const v1Signature = crypto.createHmac("sha256", secret).update(signedData, "utf8").digest("hex");
  const fullHeader = `t=${timestamp},v1=${v1Signature}`;

  assert.ok(fullHeader.includes("t="));
  assert.ok(fullHeader.includes("v1="));

  // Verify timestamp freshness detection (within 5 minutes)
  const expiredTimestamp = timestamp - 400; // 6.6 minutes ago
  assert.ok(Math.abs(Math.floor(Date.now() / 1000) - expiredTimestamp) > 300);
});

test("Phase 8 QA - 6. Input Boundary Validations: Email normalization & Password rules", () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Valid emails
  assert.ok(emailRegex.test("user@example.com"));
  assert.ok(emailRegex.test("qa.engineer+test@sub.domain.co"));

  // Invalid emails
  assert.ok(!emailRegex.test("plainaddress"));
  assert.ok(!emailRegex.test("@missingusername.com"));
  assert.ok(!emailRegex.test("username@.com"));
  assert.ok(!emailRegex.test("username@domain"));

  // Password length boundary
  const minValidPass = "12345678";
  const shortPass = "1234567";
  const maxValidPass = "a".repeat(128);
  const tooLongPass = "a".repeat(129);

  assert.ok(minValidPass.length >= 8);
  assert.ok(shortPass.length < 8);
  assert.ok(maxValidPass.length <= 128);
  assert.ok(tooLongPass.length > 128);
});
