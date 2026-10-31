import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

let ownerCookie = "";
let adminCookie = "";
let testOrgId = "";
let nonMemberCookie = "";

test.before(async () => {
  // 1. Authenticate Demo Owner
  const ownerRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(ownerRes.status, 200, "Owner login failed");
  ownerCookie = ownerRes.headers.get("set-cookie") || "";

  // 2. Authenticate Admin
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "dev@acmecorp.com", password: "Password123!" }),
  });
  if (adminRes.ok) {
    adminCookie = adminRes.headers.get("set-cookie") || "";
  }

  // 3. Register a separate third-party user for multi-tenant isolation testing
  const randomSuffix = Math.random().toString(36).substring(7);
  const outsiderRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Outsider User",
      email: `outsider_${randomSuffix}@example.com`,
      password: "StrongPassword123!",
    }),
  });
  if (outsiderRes.ok) {
    nonMemberCookie = outsiderRes.headers.get("set-cookie") || "";
  }

  // 4. Create an isolated organization for Phase 6 billing tests
  const orgRes = await fetch(`${BASE_URL}/api/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: `Billing Test Corp ${Date.now()}`,
    }),
  });
  assert.equal(orgRes.status, 201, "Failed to create test organization");
  const orgData = await orgRes.json();
  testOrgId = orgData.organization.id;
});

test("1. Multi-Tenant Security: Unauthorized access without token is blocked with 401", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`);
  assert.equal(res.status, 401);
});

test("2. Multi-Tenant Security: Non-member user cannot access organization billing (403)", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`, {
    headers: { Cookie: nonMemberCookie },
  });
  assert.equal(res.status, 403);
});

test("3. Organization Billing: GET returns initial Free plan with quotas and usage metrics", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.currentPlan, "FREE");
  assert.equal(data.planConfig.id, "FREE");
  assert.ok(data.planConfig.limits);
  assert.equal(data.planConfig.limits.maxWorkspaces, 1);
  assert.equal(data.planConfig.limits.maxTeamMembers, 2);
  assert.ok(data.usage);
  assert.equal(data.usage.workspaces.limit, 1);
  assert.equal(data.usage.teamMembers.limit, 2);
  assert.ok(Array.isArray(data.invoices));
  assert.ok(Array.isArray(data.plans));
});

test("4. Billing Settings: Owner can configure billing contact, address, and VAT/Tax ID", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      billingEmail: "finance@billingtestcorp.com",
      billingAddress: "456 Enterprise Way, Suite 100, Austin, TX 78701",
      taxId: "US-EIN-98-7654321",
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.settings.billingEmail, "finance@billingtestcorp.com");
  assert.equal(data.settings.taxId, "US-EIN-98-7654321");

  // Verify in GET endpoint
  const getRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`, {
    headers: { Cookie: ownerCookie },
  });
  const getData = await getRes.json();
  assert.equal(getData.billingSettings.billingEmail, "finance@billingtestcorp.com");
  assert.equal(getData.billingSettings.billingAddress, "456 Enterprise Way, Suite 100, Austin, TX 78701");
});

test("5. Quota Enforcement: Free plan blocks creating 2nd workspace (limit = 1)", async () => {
  // Free plan has limit = 1 workspace. When created, organization already has 1 default workspace.
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: "Excess Workspace",
    }),
  });

  assert.equal(res.status, 403, "Creating workspace over Free limit must return 403");
  const data = await res.json();
  assert.equal(data.upgradeRequired, true);
  assert.equal(data.limit, 1);
  assert.ok(data.message.includes("limit") || data.message.includes("upgrade"));
});

test("6. Subscription Upgrade: Upgrading to PRO activates tier, issues invoice, and expands quotas", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      targetPlan: "PRO",
      billingInterval: "ANNUAL",
      simulatePayment: true,
    }),
  });

  assert.equal(res.status, 200, "Upgrade must succeed");
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.plan, "PRO");
  assert.ok(data.invoiceNumber);

  // Verify quotas updated
  const billingRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`, {
    headers: { Cookie: ownerCookie },
  });
  const billingData = await billingRes.json();
  assert.equal(billingData.currentPlan, "PRO");
  assert.equal(billingData.subscription.tier, "PRO");
  assert.equal(billingData.subscription.status, "ACTIVE");
  assert.equal(billingData.subscription.billingCycle, "ANNUAL");
  assert.equal(billingData.planConfig.limits.maxWorkspaces, 10);
  assert.equal(billingData.planConfig.limits.maxTeamMembers, 15);
  assert.ok(billingData.invoices.length > 0);
  assert.equal(billingData.invoices[0].status, "PAID");
});

test("7. Quota Enforcement: After upgrading to PRO, creating additional workspace succeeds", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: "Pro Tier Engineering Workspace",
      description: "Unlocked via Phase 6 subscription upgrade",
    }),
  });

  assert.equal(res.status, 201, "Workspace creation should succeed under PRO quota");
  const data = await res.json();
  assert.ok(data.workspace);
  assert.equal(data.workspace.name, "Pro Tier Engineering Workspace");
});

test("8. Webhook Security: Rejects webhook payload without signature", async () => {
  const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "evt_unsigned", type: "invoice.payment_succeeded" }),
  });
  assert.ok(res.status === 400 || res.status === 401);
});

test("9. Webhook Security: Rejects webhook payload with forged signature", async () => {
  const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "forged_hex_signature_abcdef123456",
    },
    body: JSON.stringify({ id: "evt_forged", type: "invoice.payment_succeeded" }),
  });
  assert.equal(res.status, 401);
});

test("10. Webhook Ingestion & Idempotency: Processes valid webhook and deduplicates duplicate delivery", async () => {
  const webhookSecret =
    process.env.BILLING_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    "whsec_test_secret_key_pulseflow_2026!";
  const uniqueEventId = `evt_test_idemp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const webhookBody = JSON.stringify({
    id: uniqueEventId,
    type: "invoice.payment_succeeded",
    data: {
      object: {
        id: `in_test_${Date.now()}`,
        customer: "cus_test_sandbox",
        amount_paid: 7900,
        currency: "usd",
        metadata: {
          organizationId: testOrgId,
          plan: "PRO",
          billingInterval: "MONTHLY",
        },
      },
    },
  });

  const hmac = crypto.createHmac("sha256", webhookSecret);
  hmac.update(webhookBody, "utf8");
  const signature = hmac.digest("hex");

  // First Delivery: Should process and record event
  const firstRes = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: webhookBody,
  });

  assert.equal(firstRes.status, 200, "First webhook delivery must succeed");
  const firstData = await firstRes.json();
  assert.equal(firstData.received, true);
  assert.equal(firstData.idempotent, false, "First delivery should not be marked as duplicate");

  // Second Delivery (Duplicate Replay): Should detect idempotency and return 200 without reprocessing
  const secondRes = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: webhookBody,
  });

  assert.equal(secondRes.status, 200, "Duplicate webhook replay must be acknowledged with 200");
  const secondData = await secondRes.json();
  assert.equal(secondData.received, true);
  assert.equal(secondData.idempotent, true, "Duplicate delivery must be safely marked idempotent");
});

test("11. Subscription Cancellation: Schedule cancellation at period end retains access until period expires", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ immediate: false }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.cancelAtPeriodEnd, true);

  // Verify organization still retains PRO plan until end of period
  const billingRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`, {
    headers: { Cookie: ownerCookie },
  });
  const billingData = await billingRes.json();
  assert.equal(billingData.currentPlan, "PRO");
  assert.equal(billingData.subscription.cancelAtPeriodEnd, true);
});

test("12. Subscription Cancellation: Immediate cancellation revokes tier back to FREE", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ immediate: true }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, "CANCELED");

  // Verify organization plan reverted to FREE
  const billingRes = await fetch(`${BASE_URL}/api/organizations/${testOrgId}/billing`, {
    headers: { Cookie: ownerCookie },
  });
  const billingData = await billingRes.json();
  assert.equal(billingData.currentPlan, "FREE");
  assert.equal(billingData.subscription.status, "CANCELED");
});
