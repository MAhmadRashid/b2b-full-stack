import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";
const WEBHOOK_SECRET = "whsec_test_secret_key_pulseflow_2026!";

let ownerCookie = "";
let untrustedCookie = "";
let defaultWorkspaceId = "";
let testApiKey = "";

test.before(async () => {
  // 1. Authenticate Owner (demo@acmecorp.com)
  const ownerRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(ownerRes.status, 200, "Owner login failed");
  ownerCookie = ownerRes.headers.get("set-cookie") || "";

  const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: ownerCookie } });
  const meData = await meRes.json();
  if (meData.workspaces && meData.workspaces.length > 0) {
    defaultWorkspaceId = meData.workspaces[0].id;
  }

  // 2. Create an API key for ingestion test
  const createKeyRes = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ name: "Phase 3 Ingest Test Key" }),
  });
  const keyData = await createKeyRes.json();
  testApiKey = keyData.apiKey?.rawKey || "";

  // 3. Register or Authenticate Untrusted User (untrusted-phase3@tenant-x.com)
  const untrustedReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `untrusted_phase3_${Date.now()}@tenant-x.com`,
      password: "Password123!",
      name: "Phase3 Untrusted User",
    }),
  });
  if (untrustedReg.ok) {
    untrustedCookie = untrustedReg.headers.get("set-cookie") || "";
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

// ==========================================
// 1. RATE LIMITING & SECURITY HEADERS
// ==========================================

test("Rate Limiting: /api/auth/login includes rate limit headers", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(res.status, 200);
  assert.ok(res.headers.has("x-ratelimit-limit"), "Missing X-RateLimit-Limit header");
  assert.ok(parseInt(res.headers.get("x-ratelimit-limit") || "0", 10) > 0, "Rate limit should be greater than 0");
});

test("Rate Limiting: /api/v1/ingest includes per-key rate limit headers", async () => {
  assert.ok(testApiKey, "API key should be available");

  const res = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${testApiKey}`,
    },
    body: JSON.stringify({
      path: "/api/test/rate-limit",
      method: "GET",
      statusCode: 200,
      durationMs: 42,
    }),
  });

  assert.ok([200, 201].includes(res.status), `Ingest request should succeed, received ${res.status}`);
  assert.ok(res.headers.has("x-ratelimit-limit"), "Missing X-RateLimit-Limit header on ingest");
  assert.equal(res.headers.get("x-ratelimit-limit"), "120");
});

// ==========================================
// 2. USER PROFILE & PASSWORD SECURITY API
// ==========================================

test("User Profile API: GET /api/users/profile returns user details and stats", async () => {
  const res = await fetch(`${BASE_URL}/api/users/profile`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.user);
  assert.equal(data.user.email, "demo@acmecorp.com");
  assert.ok(data.user.stats);
  assert.ok(typeof data.user.stats.workspacesCount === "number");
  assert.ok(typeof data.user.stats.organizationsCount === "number");
  assert.ok(typeof data.user.stats.apiKeysCount === "number");
});

test("User Profile API: PATCH /api/users/profile updates display name and avatar", async () => {
  const updatedName = `Alex Rivera ${Date.now()}`;
  const res = await fetch(`${BASE_URL}/api/users/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: updatedName,
      avatarUrl: "https://images.unsplash.com/photo-test-avatar",
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.name, updatedName);
  assert.equal(data.user.avatarUrl, "https://images.unsplash.com/photo-test-avatar");
});

test("User Profile API: Rejects password change with incorrect current password", async () => {
  const res = await fetch(`${BASE_URL}/api/users/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      currentPassword: "WrongPassword999!",
      newPassword: "BrandNewPassword123!",
    }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /Current password is incorrect/i);
});

test("User Profile API: Rejects new password shorter than 8 characters", async () => {
  const res = await fetch(`${BASE_URL}/api/users/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      currentPassword: "Password123!",
      newPassword: "short",
    }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /at least 8 characters/i);
});

test("User Profile API: Unauthorized user cannot read or update profile", async () => {
  const getRes = await fetch(`${BASE_URL}/api/users/profile`);
  assert.equal(getRes.status, 401);

  const patchRes = await fetch(`${BASE_URL}/api/users/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacker" }),
  });
  assert.equal(patchRes.status, 401);
});

// ==========================================
// 3. NOTIFICATIONS SYSTEM API
// ==========================================

test("Notifications API: POST /api/workspaces/[id]/notifications creates workspace notification", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      title: "Integration Test Alert",
      message: "Automated alert generated during Phase 3 verification suite.",
      type: "WARNING",
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.notification);
  assert.equal(data.notification.title, "Integration Test Alert");
  assert.equal(data.notification.read, false);
});

test("Notifications API: GET /api/workspaces/[id]/notifications returns notifications and unread count", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/notifications`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.notifications));
  assert.ok(typeof data.unreadCount === "number");
  assert.ok(data.unreadCount >= 1);
});

test("Notifications API: PATCH /api/workspaces/[id]/notifications marks notification as read", async () => {
  // First fetch an unread notification
  const getRes = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/notifications`, {
    headers: { Cookie: ownerCookie },
  });
  const getData = await getRes.json();
  const unreadNotif = getData.notifications.find((n) => !n.read);
  assert.ok(unreadNotif, "Should have at least one unread notification");

  // Mark single notification as read
  const patchRes = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/notifications`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ id: unreadNotif.id }),
  });
  assert.equal(patchRes.status, 200);
  const patchData = await patchRes.json();
  assert.equal(patchData.success, true);

  // Mark all as read
  const markAllRes = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/notifications`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ all: true }),
  });
  assert.equal(markAllRes.status, 200);
  const markAllData = await markAllRes.json();
  assert.equal(markAllData.all, true);

  // Verify unread count is now 0
  const verifyRes = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/notifications`, {
    headers: { Cookie: ownerCookie },
  });
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.unreadCount, 0);
});

test("Notifications API: Tenant isolation prevents untrusted user from accessing notifications", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/notifications`, {
    headers: { Cookie: untrustedCookie },
  });
  assert.equal(res.status, 403);
});

// ==========================================
// 4. BILLING & HMAC WEBHOOK VERIFICATION
// ==========================================

test("Billing Webhook API: Rejects request missing signature header with 401", async () => {
  const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "invoice.payment_succeeded", data: {} }),
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /invalid webhook signature/i);
});

test("Billing Webhook API: Rejects request with forged/invalid HMAC signature with 401", async () => {
  const payload = JSON.stringify({ type: "invoice.payment_succeeded", data: {} });
  const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pulseflow-signature": "sha256=forged_signature_00000000000000000000000000000000000000000000000000",
    },
    body: payload,
  });
  assert.equal(res.status, 401);
});

test("Billing Webhook API: Processes invoice.payment_succeeded with valid HMAC signature", async () => {
  const payloadObj = {
    type: "invoice.payment_succeeded",
    data: {
      workspaceId: defaultWorkspaceId,
      amountCents: 9900,
      currency: "USD",
      invoiceNumber: `INV-TEST-${Date.now()}`,
    },
  };
  const payloadStr = JSON.stringify(payloadObj);

  // Generate valid HMAC
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(payloadStr);
  const signature = `sha256=${hmac.digest("hex")}`;

  const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pulseflow-signature": signature,
    },
    body: payloadStr,
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.received, true);
  assert.equal(data.action, "invoice_paid");
  assert.ok(data.invoiceId);
});

test("Billing Webhook API: Processes customer.subscription.updated with valid HMAC signature", async () => {
  const payloadObj = {
    type: "customer.subscription.updated",
    data: {
      workspaceId: defaultWorkspaceId,
      tier: "SCALE",
      status: "active",
      cancelAtPeriodEnd: false,
    },
  };
  const payloadStr = JSON.stringify(payloadObj);

  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(payloadStr);
  const signature = `sha256=${hmac.digest("hex")}`;

  const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pulseflow-signature": signature,
    },
    body: payloadStr,
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.received, true);
  assert.equal(data.action, "subscription_updated");
  assert.equal(data.tier, "SCALE");
});

test("Billing Cancel API: OWNER can schedule subscription cancellation at period end", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/billing/cancel`, {
    method: "POST",
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.cancelAtPeriodEnd, true);
});

test("Billing Cancel API: Untrusted non-member is rejected with 403 Forbidden", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/billing/cancel`, {
    method: "POST",
    headers: { Cookie: untrustedCookie },
  });
  assert.equal(res.status, 403);
});

// ==========================================
// 5. ANALYTICS & USAGE RECORDS AGGREGATION
// ==========================================

test("Analytics Overview API: GET /api/workspaces/[id]/analytics/overview returns real percentiles and daily usage", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/analytics/overview?range=7d`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  // Summary with real percentiles
  assert.ok(data.summary);
  assert.ok(typeof data.summary.totalRequests === "number");
  assert.ok(typeof data.summary.avgLatency === "number");
  assert.ok(typeof data.summary.p50 === "number");
  assert.ok(typeof data.summary.p95 === "number");
  assert.ok(typeof data.summary.p99 === "number");
  assert.ok(data.summary.p99 >= data.summary.p95, "p99 should be >= p95");
  assert.ok(data.summary.p95 >= data.summary.p50, "p95 should be >= p50");

  // Breakdowns
  assert.ok(data.statusBreakdown);
  assert.ok(typeof data.statusBreakdown["2xx"] === "number");
  assert.ok(Array.isArray(data.latencyBuckets));
  assert.ok(Array.isArray(data.sourceDistribution));

  // Daily Usage Records
  assert.ok(Array.isArray(data.dailyUsage));
  assert.ok(data.dailyUsage.length > 0, "Should have seeded daily usage records");
  const firstRecord = data.dailyUsage[0];
  assert.ok(firstRecord.date);
  assert.ok(typeof firstRecord.totalEvents === "number");
});

test("Analytics API: Multi-tenant isolation blocks unauthorized cross-workspace queries", async () => {
  const res = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/analytics/overview`, {
    headers: { Cookie: untrustedCookie },
  });
  assert.equal(res.status, 403);
});
