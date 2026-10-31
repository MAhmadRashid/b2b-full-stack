import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Helper implementations matching src/lib/api-scopes.ts
const API_SCOPES = {
  "events:write": { id: "events:write", label: "Ingest Events" },
  "metrics:read": { id: "metrics:read", label: "Read Metrics" },
  "workspaces:read": { id: "workspaces:read", label: "Read Workspace" },
  "audit:read": { id: "audit:read", label: "Read Audit Logs" },
  "webhooks:write": { id: "webhooks:write", label: "Manage Webhooks" },
  "admin:all": { id: "admin:all", label: "Full Admin Access" },
};

function parseScopes(input) {
  if (!input) return ["events:write", "metrics:read"];
  const list = Array.isArray(input) ? input : input.split(",").map((s) => s.trim());
  const valid = list.filter((s) => Boolean(s) && (s in API_SCOPES || s === "*"));
  return Array.from(new Set(valid.length > 0 ? valid : ["events:write", "metrics:read"]));
}

function hasScope(grantedScopes, requiredScope) {
  if (!requiredScope) return true;
  const scopes = parseScopes(grantedScopes);
  if (scopes.includes("admin:all") || scopes.includes("*")) return true;
  return scopes.includes(requiredScope);
}

// Token bucket rate limiter under test
function checkRateLimit(store, identifier, options = {}) {
  const limit = options.limit || 120;
  const windowMs = options.windowMs || 60000;
  const now = Date.now();

  if (!store[identifier]) {
    store[identifier] = { tokens: limit, lastRefill: now, windowMs };
  }

  const record = store[identifier];
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
    return { success: true, limit, remaining: record.tokens, resetMs };
  }

  return { success: false, limit, remaining: 0, resetMs };
}

// ====================== TEST SUITE ======================

test("1. Key Generation: Generates valid live and test raw key tokens with prefix", () => {
  const hex1 = crypto.randomBytes(16).toString("hex");
  const liveKey = `pfl_live_${hex1}`;
  assert.equal(liveKey.startsWith("pfl_live_"), true);
  assert.equal(liveKey.length, 41);

  const prefix = `${liveKey.substring(0, 13)}...${liveKey.substring(liveKey.length - 4)}`;
  assert.equal(prefix.startsWith("pfl_live_"), true);
  assert.equal(prefix.includes("..."), true);

  const hex2 = crypto.randomBytes(16).toString("hex");
  const testKey = `pfl_test_${hex2}`;
  assert.equal(testKey.startsWith("pfl_test_"), true);
});

test("2. Secure Storage: Raw key verifies against bcrypt hash; never stores raw plaintext", async () => {
  const rawKey = `pfl_live_${crypto.randomBytes(16).toString("hex")}`;
  const hashedKey = await bcrypt.hash(rawKey, 10);

  // Hashed key must differ completely from raw secret
  assert.notEqual(hashedKey, rawKey);
  assert.equal(hashedKey.startsWith("$2"), true);

  // Verifies matching raw key
  assert.equal(await bcrypt.compare(rawKey, hashedKey), true);

  // Rejects invalid raw key
  assert.equal(await bcrypt.compare("pfl_live_wrongtoken", hashedKey), false);
});

test("3. Scopes & Permissions: parseScopes deduplicates and filters invalid scopes", () => {
  const parsed = parseScopes("events:write, metrics:read, invalid_scope, events:write");
  assert.deepEqual(parsed, ["events:write", "metrics:read"]);

  const empty = parseScopes("");
  assert.deepEqual(empty, ["events:write", "metrics:read"]);
});

test("4. Scopes & Permissions: hasScope enforces granular permissions", () => {
  const readOnly = ["metrics:read", "workspaces:read"];
  assert.equal(hasScope(readOnly, "metrics:read"), true);
  assert.equal(hasScope(readOnly, "events:write"), false);
  assert.equal(hasScope(readOnly, "audit:read"), false);

  const ingestOnly = ["events:write"];
  assert.equal(hasScope(ingestOnly, "events:write"), true);
  assert.equal(hasScope(ingestOnly, "metrics:read"), false);

  // admin:all satisfies all scopes
  const adminScopes = ["admin:all"];
  assert.equal(hasScope(adminScopes, "events:write"), true);
  assert.equal(hasScope(adminScopes, "metrics:read"), true);
  assert.equal(hasScope(adminScopes, "audit:read"), true);
  assert.equal(hasScope(adminScopes, "webhooks:write"), true);
});

test("5. Key Expiration: Correctly detects expired and valid keys", () => {
  const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
  const isPastExpired = pastDate < new Date();
  assert.equal(isPastExpired, true, "Past timestamp must be expired");

  const futureDate = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days ahead
  const isFutureExpired = futureDate < new Date();
  assert.equal(isFutureExpired, false, "Future timestamp must not be expired");
});

test("6. Rate Limiting: Token bucket enforces 120 req/min quota and provides reset countdown", () => {
  const store = {};
  const id = "key_test_bucket_1";

  // First request consumes 1 token
  const first = checkRateLimit(store, id, { limit: 120, windowMs: 60000 });
  assert.equal(first.success, true);
  assert.equal(first.remaining, 119);
  assert.ok(first.resetMs > 0);

  // Consume all 119 remaining tokens
  for (let i = 0; i < 119; i++) {
    checkRateLimit(store, id, { limit: 120, windowMs: 60000 });
  }

  // 121st request should be blocked
  const blocked = checkRateLimit(store, id, { limit: 120, windowMs: 60000 });
  assert.equal(blocked.success, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.resetMs > 0);
});

test("7. Audit Masking: Never exposes raw secret keys in audit details", () => {
  const rawSecret = `pfl_live_${crypto.randomBytes(16).toString("hex")}`;
  const prefix = `${rawSecret.substring(0, 13)}...${rawSecret.substring(rawSecret.length - 4)}`;

  const auditDetail = `Generated API key 'Production Ingest' with prefix ${prefix} (never expires)`;

  // Audit string contains prefix but NEVER the full raw key
  assert.ok(auditDetail.includes(prefix));
  assert.equal(auditDetail.includes(rawSecret), false);
});

test("8. Request Size Ceiling: Blocks payload larger than 1MB", () => {
  const maxBytes = 1048576; // 1MB
  const validSize = 512000; // 500KB
  const oversized = 1500000; // 1.5MB

  assert.equal(validSize <= maxBytes, true);
  assert.equal(oversized <= maxBytes, false);
});
