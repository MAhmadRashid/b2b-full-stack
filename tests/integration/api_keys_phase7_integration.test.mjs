import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

let ownerCookie = "";
let outsiderCookie = "";
let testOrgId = "";
let testWsId = "";
let testKeyId = "";
let testRawKey = "";
let ingestOnlyRawKey = "";
let expiredRawKey = "";

test.before(async () => {
  // 1. Authenticate Demo Owner
  const ownerRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(ownerRes.status, 200, "Owner login failed");
  ownerCookie = ownerRes.headers.get("set-cookie") || "";

  // 2. Register outsider user for multi-tenant isolation testing
  const randomSuffix = Math.random().toString(36).substring(7);
  const outsiderRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Outsider Developer",
      email: `outsider_dev_${randomSuffix}@example.com`,
      password: "StrongPassword123!",
    }),
  });
  if (outsiderRes.ok) {
    outsiderCookie = outsiderRes.headers.get("set-cookie") || "";
  }

  // 3. Create isolated organization and workspace for Phase 7 tests
  const orgRes = await fetch(`${BASE_URL}/api/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ name: `DevCorp Phase7 ${Date.now()}` }),
  });
  assert.equal(orgRes.status, 201, "Failed to create test organization");
  const orgData = await orgRes.json();
  testOrgId = orgData.organization.id;

  // Upgrade org to PRO so it has ample API keys quota
  await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ targetPlan: "PRO", simulatePayment: true }),
  });

  // Get or create workspace
  const wsRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/workspaces`, {
    headers: { Cookie: ownerCookie },
  });
  const wsData = await wsRes.json();
  testWsId = wsData.workspaces[0].id;
});

test("1. Access Control: Unauthorized request to list keys returns 401", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/keys`);
  assert.equal(res.status, 401);
});

test("2. Multi-Tenant Security: Outsider user cannot list or create keys in other workspace (403)", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/keys`, {
    headers: { Cookie: outsiderCookie },
  });
  assert.equal(res.status, 403);
});

test("3. API Key Management: Owner can generate API key with custom scopes and receives rawKey once", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: "Production Telemetry Key",
      environment: "live",
      scopes: ["events:write", "metrics:read"],
      expiresIn: "never",
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.apiKey);
  assert.ok(data.apiKey.id);
  assert.ok(data.apiKey.rawKey, "Must return raw key once");
  assert.equal(data.apiKey.rawKey.startsWith("pfl_live_"), true);
  assert.ok(data.apiKey.keyPrefix.includes("..."));
  assert.deepEqual(data.apiKey.scopes, ["events:write", "metrics:read"]);

  testKeyId = data.apiKey.id;
  testRawKey = data.apiKey.rawKey;

  // Verify that GET /api/workspaces/[id]/keys returns the key with prefix, but NOT the raw secret
  const listRes = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/keys`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  const found = listData.keys.find((k) => k.id === testKeyId);
  assert.ok(found);
  assert.equal(found.rawKey, undefined, "Raw key must never be stored or leaked in listings");
  assert.equal(found.revoked, false);
});

test("4. API Authentication: POST /api/v1/keys/verify verifies valid key credentials", async () => {
  // 1. Missing header
  const missingRes = await fetch(`${BASE_URL}/api/v1/keys/verify`, {
    method: "POST",
  });
  assert.equal(missingRes.status, 401);

  // 2. Invalid secret
  const invalidRes = await fetch(`${BASE_URL}/api/v1/keys/verify`, {
    method: "POST",
    headers: { Authorization: "Bearer pfl_live_invalidkey1234567890" },
  });
  assert.equal(invalidRes.status, 403);

  // 3. Valid secret
  const validRes = await fetch(`${BASE_URL}/api/v1/keys/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${testRawKey}` },
  });
  assert.equal(validRes.status, 200);
  const validData = await validRes.json();
  assert.equal(validData.valid, true);
  assert.equal(validData.apiKey.id, testKeyId);
  assert.deepEqual(validData.apiKey.scopes, ["events:write", "metrics:read"]);
  assert.ok(validRes.headers.get("x-ratelimit-limit"), "Must include rate limit headers");
});

test("5. Telemetry Ingestion: POST /api/v1/ingest succeeds with valid key and logs API usage", async () => {
  const res = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${testRawKey}`,
    },
    body: JSON.stringify({
      eventType: "telemetry_ping",
      source: "phase7-integration-test",
      payload: { cpuPercent: 34.2, activeThreads: 8 },
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.eventId);
  assert.equal(data.eventType, "telemetry_ping");
});

test("6. Scope Enforcement: GET /api/v1/metrics rejects key missing 'metrics:read' scope with 403", async () => {
  // Create key with ONLY 'events:write' scope
  const createRes = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: "Ingest-Only Key",
      scopes: ["events:write"],
    }),
  });
  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  ingestOnlyRawKey = createData.apiKey.rawKey;

  // Ingest should succeed
  const ingestRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ingestOnlyRawKey}`,
    },
    body: JSON.stringify({ eventType: "scoped_event" }),
  });
  assert.equal(ingestRes.status, 201);

  // Metrics query should be rejected due to missing 'metrics:read' scope
  const metricsRes = await fetch(`${BASE_URL}/api/v1/metrics`, {
    headers: { Authorization: `Bearer ${ingestOnlyRawKey}` },
  });
  assert.equal(metricsRes.status, 403, "Must return 403 Forbidden for missing scope");
  const metricsData = await metricsRes.json();
  assert.ok(metricsData.message.includes("metrics:read"));

  // Key WITH 'metrics:read' should succeed
  const allowedRes = await fetch(`${BASE_URL}/api/v1/metrics`, {
    headers: { Authorization: `Bearer ${testRawKey}` },
  });
  assert.equal(allowedRes.status, 200);
  const allowedData = await allowedRes.json();
  assert.ok(allowedData.metrics);
  assert.ok(Array.isArray(allowedData.sampleEvents));
});

test("7. Usage Quota API: GET /api/v1/usage returns current monthly usage and limits", async () => {
  const res = await fetch(`${BASE_URL}/api/v1/usage`, {
    headers: { Authorization: `Bearer ${testRawKey}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.plan);
  assert.ok(data.quota);
  assert.ok(typeof data.quota.currentMonthlyRequests === "number");
  assert.ok(typeof data.quota.monthlyRequestLimit === "number");
  assert.ok(data.quota.resetsAt);
  assert.equal(data.key.id, testKeyId);
});

test("8. Key Rotation: POST /api/workspaces/[id]/keys/[keyId]/rotate generates new secret and revokes old secret", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/keys/${testKeyId}/rotate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.apiKey.rawKey, "Must return new raw key secret");
  assert.notEqual(data.apiKey.rawKey, testRawKey);

  const newRawKey = data.apiKey.rawKey;

  // Old secret must now fail
  const oldRes = await fetch(`${BASE_URL}/api/v1/keys/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${testRawKey}` },
  });
  assert.equal(oldRes.status, 403, "Old rotated key secret must be rejected");

  // New secret must succeed
  const newRes = await fetch(`${BASE_URL}/api/v1/keys/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${newRawKey}` },
  });
  assert.equal(newRes.status, 200, "New rotated key secret must succeed");

  // Update testRawKey for remaining tests
  testRawKey = newRawKey;
});

test("9. Key Revocation: DELETE /api/workspaces/[id]/keys/[keyId] revokes key and blocks access", async () => {
  // Revoke the ingestOnly key
  const listRes = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/keys`, {
    headers: { Cookie: ownerCookie },
  });
  const listData = await listRes.json();
  const ingestKey = listData.keys.find((k) => k.name === "Ingest-Only Key");
  assert.ok(ingestKey);

  const revokeRes = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/keys/${ingestKey.id}`, {
    method: "DELETE",
    headers: { Cookie: ownerCookie },
  });
  assert.equal(revokeRes.status, 200);

  // Calling ingest with revoked key must now be rejected
  const res = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ingestOnlyRawKey}`,
    },
    body: JSON.stringify({ eventType: "revoked_probe" }),
  });
  assert.equal(res.status, 403, "Revoked key must be rejected with 403");
  const data = await res.json();
  assert.ok(data.message.includes("revoked"));
});

test("10. Developer Analytics: GET /api/workspaces/[id]/api-usage aggregates endpoints, status codes, and quotas", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${testWsId}/api-usage`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.workspaceId, testWsId);
  assert.ok(data.usage);
  assert.ok(typeof data.usage.currentMonth === "number");
  assert.ok(typeof data.usage.monthlyLimit === "number");
  assert.ok(Array.isArray(data.dailyTrends));
  assert.ok(Array.isArray(data.endpoints));
  assert.ok(data.statusDistribution);
  assert.ok(typeof data.statusDistribution["2xx"] === "number");
  assert.ok(Array.isArray(data.recentRequests));
  assert.ok(data.recentRequests.length > 0, "Must have recorded recent request logs");
});

test("11. Organization API Keys: Create, list, rotate, and revoke organization-level keys", async () => {
  // 1. Create org-level key
  const createRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: "Global Org Integration Key",
      scopes: ["events:write", "metrics:read", "audit:read"],
      environment: "live",
      rateLimit: 200,
    }),
  });
  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  assert.ok(createData.apiKey.rawKey);
  const orgRawKey = createData.apiKey.rawKey;
  const orgKeyId = createData.apiKey.id;

  // 2. Verify with org key
  const verifyRes = await fetch(`${BASE_URL}/api/v1/keys/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${orgRawKey}` },
  });
  assert.equal(verifyRes.status, 200);

  // 3. Rotate org key
  const rotateRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/keys/${orgKeyId}/rotate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
  });
  assert.equal(rotateRes.status, 200);
  const rotateData = await rotateRes.json();
  assert.notEqual(rotateData.apiKey.rawKey, orgRawKey);

  // 4. Revoke org key
  const revokeRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/keys?keyId=${orgKeyId}`, {
    method: "DELETE",
    headers: { Cookie: ownerCookie },
  });
  assert.equal(revokeRes.status, 200);

  // 5. Query org api-usage
  const orgUsageRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/api-usage`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(orgUsageRes.status, 200);
  const orgUsageData = await orgUsageRes.json();
  assert.equal(orgUsageData.organizationId, testOrgId);
  assert.ok(orgUsageData.usage);
});
