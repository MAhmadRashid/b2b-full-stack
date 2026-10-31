import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

test("Security Headers: HTTP responses contain enterprise security headers", async () => {
  const res = await fetch(`${BASE_URL}/`);
  assert.equal(res.status, 200);

  const contentTypeOptions = res.headers.get("x-content-type-options");
  assert.equal(contentTypeOptions, "nosniff", "Must include nosniff");

  const frameOptions = res.headers.get("x-frame-options");
  assert.equal(frameOptions, "DENY", "Must deny framing");

  const xssProtection = res.headers.get("x-xss-protection");
  assert.equal(xssProtection, "1; mode=block", "Must enable XSS protection");

  const referrerPolicy = res.headers.get("referrer-policy");
  assert.equal(referrerPolicy, "strict-origin-when-cross-origin", "Must set strict referrer policy");

  const permissionsPolicy = res.headers.get("permissions-policy");
  assert.ok(permissionsPolicy && permissionsPolicy.includes("camera=()"), "Must restrict permissions");

  const csp = res.headers.get("content-security-policy");
  assert.ok(csp && csp.includes("default-src 'self'"), "Must enforce Content-Security-Policy");
});

test("Security Headers: API endpoints enforce no-store cache control", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  const cacheControl = res.headers.get("cache-control");
  assert.ok(
    cacheControl && (cacheControl.includes("no-store") || cacheControl.includes("no-cache")),
    "API responses must never be cached by intermediary proxies or browsers"
  );
});

test("Auth Security: Registration validates email format and password complexity", async () => {
  // Test invalid email
  const badEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bad Email Tester",
      email: "notanemail",
      password: "validPassword123!",
    }),
  });
  assert.equal(badEmailRes.status, 400);
  const badEmailData = await badEmailRes.json();
  assert.ok(badEmailData.error.toLowerCase().includes("email"));

  // Test weak password (< 8 chars)
  const weakPassRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Weak Pass Tester",
      email: "weakpass@example.com",
      password: "123",
    }),
  });
  assert.equal(weakPassRes.status, 400);
  const weakPassData = await weakPassRes.json();
  assert.ok(weakPassData.error.toLowerCase().includes("8 characters"));
});

test("Auth Security: Password reset endpoint mitigates email enumeration", async () => {
  const unknownEmail = `nonexistent_user_${Date.now()}@domainnotfound.com`;
  const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: unknownEmail }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  // Should return a generic message, not revealing whether the email exists
  assert.ok(data.message.includes("If an account exists"));
});

test("Multi-Tenant Security: Unauthenticated requests to protected workspace APIs are rejected", async () => {
  const fakeWorkspaceId = "cm_fake_ws_9999999";

  const getWsRes = await fetch(`${BASE_URL}/api/workspaces/${fakeWorkspaceId}`);
  assert.equal(getWsRes.status, 401, "Unauthenticated GET /api/workspaces/[id] must return 401");

  const getKeysRes = await fetch(`${BASE_URL}/api/workspaces/${fakeWorkspaceId}/keys`);
  assert.equal(getKeysRes.status, 401, "Unauthenticated GET /api/workspaces/[id]/keys must return 401");

  const getAuditRes = await fetch(`${BASE_URL}/api/workspaces/${fakeWorkspaceId}/audit-logs`);
  assert.equal(getAuditRes.status, 401, "Unauthenticated GET /api/workspaces/[id]/audit-logs must return 401");

  const getNotifRes = await fetch(`${BASE_URL}/api/workspaces/${fakeWorkspaceId}/notifications`);
  assert.equal(getNotifRes.status, 401, "Unauthenticated GET /api/workspaces/[id]/notifications must return 401");
});

test("Multi-Tenant Security: Unauthenticated requests to organization APIs are rejected", async () => {
  const fakeOrgId = "cm_fake_org_8888888";

  const getOrgRes = await fetch(`${BASE_URL}/api/organizations/${fakeOrgId}`);
  assert.equal(getOrgRes.status, 401, "Unauthenticated GET /api/organizations/[orgId] must return 401");

  const getMembersRes = await fetch(`${BASE_URL}/api/organizations/${fakeOrgId}/members`);
  assert.equal(getMembersRes.status, 401, "Unauthenticated GET /api/organizations/[orgId]/members must return 401");
});

test("API Security: Webhook test delivery rejects loopback and cloud metadata SSRF targets", async () => {
  // First log in as demo user to obtain session cookie
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(loginRes.status, 200);
  const cookie = loginRes.headers.get("set-cookie");
  assert.ok(cookie);
  const loginData = await loginRes.json();
  const workspaceId = loginData.workspaces[0]?.id;
  assert.ok(workspaceId);

  // Attempt SSRF to AWS/GCP IMDS endpoint via webhook test ping
  const ssrfRes = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      action: "test",
      url: "http://169.254.169.254/latest/meta-data/",
      secretKey: "whsec_test_secret_123",
    }),
  });

  assert.equal(ssrfRes.status, 400, "Must block cloud metadata request with 400 Bad Request");
  const ssrfData = await ssrfRes.json();
  assert.ok(ssrfData.error.includes("prohibited"));
});

test("Performance & Bounds: Audit logs pagination clamps negative and excessive limits", async () => {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  const cookie = loginRes.headers.get("set-cookie");
  const loginData = await loginRes.json();
  const workspaceId = loginData.workspaces[0]?.id;

  // Request with negative page and extreme limit
  const res = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/audit-logs?page=-5&limit=999999`, {
    headers: { Cookie: cookie },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.pagination);
  assert.equal(data.pagination.page, 1, "Page must be clamped to minimum 1");
  assert.equal(data.pagination.limit, 100, "Limit must be clamped to maximum 100");
});
