// tests/integration/phase17_api_keys_hardening.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

test("API Keys Hardening: IP Whitelisting & Zero-Downtime Rotation Integration Flow", async () => {
  // 1. Authenticate / Login as Demo Owner
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(loginRes.status, 200, "Owner should log in successfully");
  const cookie = loginRes.headers.get("set-cookie");
  assert.ok(cookie, "Session cookie must be returned");

  // 2. Create isolated test organization & workspace
  const orgRes = await fetch(`${BASE_URL}/api/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: `API Security Test Org ${Date.now()}` }),
  });
  assert.equal(orgRes.status, 201, "Should create test organization");
  const orgData = await orgRes.json();
  const orgId = orgData.organization.id;

  // Upgrade org to PRO to ensure quota
  await fetch(`${BASE_URL}/api/organizations/${orgId}/billing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ targetPlan: "PRO", simulatePayment: true }),
  });

  const wsListRes = await fetch(`${BASE_URL}/api/organizations/${orgId}/workspaces`, {
    headers: { Cookie: cookie },
  });
  assert.equal(wsListRes.status, 200);
  const wsListData = await wsListRes.json();
  const workspaceId = wsListData.workspaces[0].id;
  assert.ok(workspaceId, "Workspace must be provisioned");

  // 3. Create Key with IP Whitelisting: Only allow 192.168.10.0/24 and 10.0.0.50
  const createKeyRes = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "Edge Gateway CIDR Guarded",
      scopes: ["events:write", "metrics:read"],
      environment: "live",
      expiresIn: "never",
      ipRestrictions: "192.168.10.0/24, 10.0.0.50",
    }),
  });
  assert.equal(createKeyRes.status, 201, "Should generate API key with IP restrictions");
  const createData = await createKeyRes.json();
  const rawKey1 = createData.apiKey.rawKey;
  const keyId = createData.apiKey.id;
  assert.ok(rawKey1, "Raw key must be revealed once");
  assert.ok(keyId, "Key ID must be present");

  // 4. Test Ingest with unauthorized client IP (e.g., 203.0.113.88)
  const blockedIngestRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawKey1}`,
      "X-Forwarded-For": "203.0.113.88",
    },
    body: JSON.stringify({
      eventType: "telemetry_ping",
      source: "unauthorized-ip-test",
    }),
  });
  assert.equal(blockedIngestRes.status, 403, "Must reject request from unauthorized IP with HTTP 403");
  const blockedJson = await blockedIngestRes.json();
  assert.ok(blockedJson.message.includes("not permitted") || blockedJson.message.includes("not authorized"));

  // 5. Test Ingest with authorized client IP within CIDR range 192.168.10.0/24
  const allowedIngestRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawKey1}`,
      "X-Forwarded-For": "192.168.10.45",
    },
    body: JSON.stringify({
      eventType: "telemetry_ping",
      source: "authorized-cidr-node",
      payload: { cpu: 12.4, memory: 48 },
    }),
  });
  assert.ok([200, 201].includes(allowedIngestRes.status), "Must allow request from authorized CIDR IP with HTTP 200/201");
  const allowedJson = await allowedIngestRes.json();
  assert.equal(allowedJson.success, true);

  // 6. Test Zero-Downtime Key Rotation (with 24h grace period)
  const rotateRes = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/keys/${keyId}/rotate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ gracePeriodHours: 24 }),
  });
  assert.equal(rotateRes.status, 200, "Rotation should succeed with zero-downtime grace period");
  const rotateData = await rotateRes.json();
  const rawKey2 = rotateData.apiKey.rawKey;
  assert.ok(rawKey2, "New raw key secret must be returned");
  assert.notEqual(rawKey1, rawKey2, "New key must be distinct from old key");
  assert.ok(rotateData.apiKey.gracePeriodEndsAt, "Grace period expiration timestamp must be set");

  // 7. Verify OLD key still authenticates during active grace period (Zero Downtime)
  const oldKeyDuringGraceRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawKey1}`,
      "X-Forwarded-For": "192.168.10.45",
    },
    body: JSON.stringify({
      eventType: "telemetry_ping",
      source: "legacy-server-during-rotation-grace-period",
    }),
  });
  assert.ok([200, 201].includes(oldKeyDuringGraceRes.status), "Old key MUST still work during grace period to prevent downtime");

  // 8. Verify NEW key immediately authenticates
  const newKeyRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawKey2}`,
      "X-Forwarded-For": "192.168.10.45",
    },
    body: JSON.stringify({
      eventType: "telemetry_ping",
      source: "new-server-migrated-to-rotated-secret",
    }),
  });
  assert.ok([200, 201].includes(newKeyRes.status), "New key must immediately authenticate");

  // 9. Clean up test key
  await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/keys?keyId=${keyId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
});
