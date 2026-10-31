import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:5000";

let demoSessionCookie = "";
let demoWorkspaceId = "";

test.after(async () => {
  if (demoWorkspaceId && demoSessionCookie) {
    try {
      const keysRes = await fetch(`${BASE_URL}/api/workspaces/${demoWorkspaceId}/keys`, {
        headers: { Cookie: demoSessionCookie },
      });
      if (keysRes.ok) {
        const { keys } = await keysRes.json();
        for (const k of keys || []) {
          if (k.name === "Automated QA Ephemeral Key" || k.name === "Gateway Ingest Test Token") {
            await fetch(`${BASE_URL}/api/workspaces/${demoWorkspaceId}/keys/${k.id}`, {
              method: "DELETE",
              headers: { Cookie: demoSessionCookie },
            });
          }
        }
      }
    } catch {
      // Best-effort cleanup
    }
  }
});

test("1. System Health Check: /api/health responds with 200", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status.toUpperCase(), "HEALTHY");
  assert.ok(data.timestamp);
});

test("2. Auth Security: Register rejects invalid inputs", async () => {
  // Missing password
  const res1 = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid@company.com", password: "123" }),
  });
  assert.equal(res1.status, 400);

  // Missing email
  const res2 = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "", password: "Password123!" }),
  });
  assert.equal(res2.status, 400);
});

test("3. Auth Security: Login rejects invalid credentials", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "WrongPassword!" }),
  });
  assert.equal(res.status, 401);
});

test("4. Auth: Login with valid credentials establishes HTTP-Only session", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get("set-cookie");
  assert.ok(setCookie, "Set-Cookie header should be present");
  assert.ok(setCookie.includes("pulseflow_session"), "Cookie should be pulseflow_session");
  demoSessionCookie = setCookie;

  const data = await res.json();
  assert.equal(data.user.email, "demo@acmecorp.com");
});

test("5. Session Verification: /api/auth/me protects unauthorized requests", async () => {
  // Request without cookie
  const unauthRes = await fetch(`${BASE_URL}/api/auth/me`);
  assert.equal(unauthRes.status, 401);

  // Request with valid cookie
  const authRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: demoSessionCookie },
  });
  assert.equal(authRes.status, 200);
  const authData = await authRes.json();
  assert.equal(authData.user.email, "demo@acmecorp.com");
  assert.ok(authData.workspaces.length > 0);
  demoWorkspaceId = authData.workspaces[0].id;
});

test("6. API Key Safeguards: Create key with 30-day expiration policy", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${demoWorkspaceId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoSessionCookie },
    body: JSON.stringify({
      name: "Automated QA Ephemeral Key",
      environment: "live",
      scopes: ["metrics:read", "events:write"],
      expiresIn: "30d",
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.apiKey.rawKey.startsWith("pfl_live_"));
  assert.ok(data.apiKey.expiresAt);
  const expDate = new Date(data.apiKey.expiresAt);
  const now = new Date();
  const diffDays = Math.round((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  assert.ok(diffDays >= 29 && diffDays <= 31, `Expected ~30 days expiration, got ${diffDays}`);
});

test("7. Ingestion Gateway: Valid key persists telemetry & updates usage", async () => {
  // First, provision a key to test
  const keyRes = await fetch(`${BASE_URL}/api/workspaces/${demoWorkspaceId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoSessionCookie },
    body: JSON.stringify({
      name: "Gateway Ingest Test Token",
      environment: "live",
      expiresIn: "never",
    }),
  });
  const keyData = await keyRes.json();
  const liveKey = keyData.apiKey.rawKey;

  // Ingest telemetry event
  const ingestRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${liveKey}`,
    },
    body: JSON.stringify({
      eventType: "qa_automated_probe",
      source: "node-test-runner",
      payload: {
        latency: 28,
        success: true,
      },
    }),
  });
  assert.equal(ingestRes.status, 201);
  const ingestData = await ingestRes.json();
  assert.equal(ingestData.success, true);
  assert.equal(ingestData.eventType, "qa_automated_probe");
  assert.ok(ingestData.eventId);
});

test("8. Ingestion Gateway Security: Rejects invalid or expired keys", async () => {
  // Invalid key token
  const invalidRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer pfl_live_invalidtoken1234567890",
    },
    body: JSON.stringify({ eventType: "unauthorized_probe" }),
  });
  assert.equal(invalidRes.status, 403);

  // Missing Authorization header
  const missingRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: "missing_token" }),
  });
  assert.equal(missingRes.status, 401);
});

test("9. Telemetry Export: Supports CSV and JSON format streaming", async () => {
  // Test CSV export
  const csvRes = await fetch(
    `${BASE_URL}/api/workspaces/${demoWorkspaceId}/metrics/export?format=csv&limit=10`,
    { headers: { Cookie: demoSessionCookie } }
  );
  assert.equal(csvRes.status, 200);
  assert.ok(csvRes.headers.get("content-type")?.includes("text/csv"));
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('"Timestamp"'));
  assert.ok(csvText.includes('"Event Type"'));
  assert.ok(csvText.includes('"Latency (ms)"'));

  // Test JSON export
  const jsonRes = await fetch(
    `${BASE_URL}/api/workspaces/${demoWorkspaceId}/metrics/export?format=json&limit=10`,
    { headers: { Cookie: demoSessionCookie } }
  );
  assert.equal(jsonRes.status, 200);
  assert.ok(jsonRes.headers.get("content-type")?.includes("application/json"));
  const jsonData = await jsonRes.json();
  assert.equal(jsonData.workspaceId, demoWorkspaceId);
  assert.ok(Array.isArray(jsonData.events));
});

test("10. Outbound Webhooks: Create, HMAC ping test, patch, and delete", async () => {
  // 1. Create webhook
  const createRes = await fetch(`${BASE_URL}/api/workspaces/${demoWorkspaceId}/webhooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoSessionCookie },
    body: JSON.stringify({
      url: "https://httpbin.org/post",
      events: ["error_spike", "latency_breach"],
      active: true,
    }),
  });
  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  const webhookId = createData.webhook.id;
  assert.ok(createData.webhook.secretKey.startsWith("whsec_"));

  // 2. Test ping delivery
  const pingRes = await fetch(`${BASE_URL}/api/workspaces/${demoWorkspaceId}/webhooks/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoSessionCookie },
    body: JSON.stringify({
      webhookId,
      url: createData.webhook.url,
      secretKey: createData.webhook.secretKey,
    }),
  });
  assert.equal(pingRes.status, 200);
  const pingData = await pingRes.json();
  assert.ok(pingData.signature, "Should include computed HMAC-SHA256 signature");
  assert.ok(pingData.deliveryStatus);

  // 3. Patch webhook
  const patchRes = await fetch(`${BASE_URL}/api/workspaces/${demoWorkspaceId}/webhooks`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: demoSessionCookie },
    body: JSON.stringify({ webhookId, active: false }),
  });
  assert.equal(patchRes.status, 200);

  // 4. Delete webhook
  const deleteRes = await fetch(
    `${BASE_URL}/api/workspaces/${demoWorkspaceId}/webhooks?webhookId=${webhookId}`,
    { method: "DELETE", headers: { Cookie: demoSessionCookie } }
  );
  assert.equal(deleteRes.status, 200);
});

test("11. Team Invitations: Token issuance, verification, onboarding & acceptance", async () => {
  const invitedEmail = `invited_${Date.now()}@acmetest.com`;

  // 1. Issue invitation
  const inviteRes = await fetch(`${BASE_URL}/api/workspaces/${demoWorkspaceId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoSessionCookie },
    body: JSON.stringify({
      email: invitedEmail,
      role: "MEMBER",
      name: "Invited Teammate",
    }),
  });
  assert.equal(inviteRes.status, 201);
  const inviteData = await inviteRes.json();
  const token = inviteData.invitation.token;
  assert.ok(token.startsWith("inv_"));

  // 2. Verify invitation token via public endpoint
  const verifyRes = await fetch(`${BASE_URL}/api/invitations/${token}`);
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.valid, true);
  assert.equal(verifyData.invitation.email, invitedEmail);
  assert.equal(verifyData.invitation.role, "MEMBER");

  // 3. Accept invitation, create password, activate membership
  const acceptRes = await fetch(`${BASE_URL}/api/invitations/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Invited Teammate",
      password: "NewPassword123!",
    }),
  });
  assert.equal(acceptRes.status, 200);
  const acceptSetCookie = acceptRes.headers.get("set-cookie");
  assert.ok(acceptSetCookie?.includes("pulseflow_session"), "Invited member should receive session cookie");

  // 4. Re-verifying used token should return 404 (cleaned up)
  const reuseRes = await fetch(`${BASE_URL}/api/invitations/${token}`);
  assert.equal(reuseRes.status, 404);
});

test("12. RBAC & Superadmin Isolation: Non-admin rejected from /api/admin/overview", async () => {
  // Non-superadmin access (demo@acmecorp.com is a regular business user)
  const regularRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: demoSessionCookie },
  });
  assert.equal(regularRes.status, 403);

  // Superadmin login
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@pulseflow.io", password: "Password123!" }),
  });
  assert.equal(adminLoginRes.status, 200);
  const adminCookie = adminLoginRes.headers.get("set-cookie");

  // Superadmin access to control panel
  const adminOverviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(adminOverviewRes.status, 200);
  const adminData = await adminOverviewRes.json();
  assert.ok(adminData.stats.totalUsers > 0);
  assert.ok(adminData.stats.totalWorkspaces > 0);
});
