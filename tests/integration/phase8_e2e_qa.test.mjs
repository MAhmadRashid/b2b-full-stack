import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";
const WEBHOOK_SECRET = "whsec_test_secret_key_pulseflow_2026!";

// Test state
const runId = Date.now();
const aliceEmail = `alice_qa_${runId}@vanguard.io`;
const bobEmail = `bob_qa_${runId}@vanguard.io`;
const eveEmail = `eve_qa_${runId}@outsider.io`;
const initialPassword = "SecurePassword123!";
const updatedPassword = "UpdatedPassword456!";

let aliceCookie = "";
let aliceUserId = "";
let alicePrimaryWsId = "";
let organizationId = "";
let stagingWsId = "";
let bobCookie = "";
let bobUserId = "";
let eveCookie = "";
let apiKeyId = "";
let rawApiKey = "";
let rotatedApiKey = "";

test.after(async () => {
  await prisma.$disconnect();
});

// ========================================================
// 1. USER REGISTRATION, ONBOARDING & DUPLICATE PROTECTION
// ========================================================

test("Phase 8 E2E - 1. User Registration: Successful registration creates user, workspace, and owner role", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Alice Vanguard",
      email: aliceEmail,
      password: initialPassword,
      workspaceName: `Vanguard Core ${runId}`,
    }),
  });

  assert.equal(res.status, 200, `Registration should succeed, got ${res.status}`);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.user.email, aliceEmail);
  assert.equal(data.workspace.role, "OWNER");

  aliceUserId = data.user.id;
  alicePrimaryWsId = data.workspace.id;
  aliceCookie = res.headers.get("set-cookie") || "";
  assert.ok(aliceCookie.includes("pulseflow_session"), "Session cookie must be issued on registration");
});

test("Phase 8 E2E - 2. Registration Guard: Duplicate email registration returns 409 Conflict", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Alice Impostor",
      email: aliceEmail,
      password: initialPassword,
    }),
  });

  assert.equal(res.status, 409, "Duplicate email registration must be rejected with 409");
  const data = await res.json();
  assert.ok(data.error.includes("already exists"));
});

// ========================================================
// 2. USER AUTHENTICATION, SESSIONS & PROFILE MANAGEMENT
// ========================================================

test("Phase 8 E2E - 3. Authentication: Login validates credentials and issues signed session cookie", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: aliceEmail,
      password: initialPassword,
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.email, aliceEmail);
  aliceCookie = res.headers.get("set-cookie") || aliceCookie;
  assert.ok(res.headers.has("x-ratelimit-limit"), "Login must include rate limit headers");
});

test("Phase 8 E2E - 4. Profile Management: Update profile name and change password", async () => {
  // 1. Fetch current profile
  const profileRes = await fetch(`${BASE_URL}/api/users/profile`, {
    headers: { Cookie: aliceCookie },
  });
  assert.equal(profileRes.status, 200);
  const profileData = await profileRes.json();
  assert.equal(profileData.user.email, aliceEmail);

  // 2. Update display name & password
  const updateRes = await fetch(`${BASE_URL}/api/users/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({
      name: "Alice Vanguard (QA Lead)",
      currentPassword: initialPassword,
      newPassword: updatedPassword,
    }),
  });
  assert.equal(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.equal(updateData.user.name, "Alice Vanguard (QA Lead)");

  // 3. Verify old password no longer works
  const oldLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: aliceEmail, password: initialPassword }),
  });
  assert.equal(oldLoginRes.status, 401, "Old password must be rejected");

  // 4. Verify new password works and refresh cookie
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: aliceEmail, password: updatedPassword }),
  });
  assert.equal(newLoginRes.status, 200, "New password must succeed");
  aliceCookie = newLoginRes.headers.get("set-cookie") || aliceCookie;
});

// ========================================================
// 3. PASSWORD RESET & EMAIL VERIFICATION FLOWS
// ========================================================

test("Phase 8 E2E - 5. Password Reset Flow: Token generation and password reset", async () => {
  // 1. Request password reset
  const reqResetRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: aliceEmail }),
  });
  assert.equal(reqResetRes.status, 200);

  // 2. Retrieve token from database
  const resetRecord = await prisma.passwordResetToken.findFirst({
    where: { email: aliceEmail },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(resetRecord, "Reset record must be created");

  // 3. Reset password using token
  const resetPassRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: resetRecord.token,
      password: updatedPassword,
    }),
  });
  assert.equal(resetPassRes.status, 200);

  // 4. Invalidate token after consumption
  const expiredTokenRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: resetRecord.token,
      password: "AnotherPassword123!",
    }),
  });
  assert.ok([400, 410].includes(expiredTokenRes.status), "Consumed token must be rejected");
});

test("Phase 8 E2E - 6. Email Verification Flow: Verify token marks user emailVerified", async () => {
  // Create verification token in DB
  const verifyToken = `vfy_${crypto.randomBytes(24).toString("hex")}`;
  await prisma.verificationToken.create({
    data: {
      email: aliceEmail,
      token: verifyToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-email?token=${verifyToken}`);
  assert.equal(verifyRes.status, 200);

  const updatedUser = await prisma.user.findUnique({ where: { email: aliceEmail } });
  assert.ok(updatedUser.emailVerified, "User emailVerified date must be set");
});

// ========================================================
// 4. ORGANIZATIONS & WORKSPACES MULTI-TENANCY
// ========================================================

test("Phase 8 E2E - 7. Organization Lifecycle: Create organization, rename, and provision workspace", async () => {
  // 1. Create Organization
  const createOrgRes = await fetch(`${BASE_URL}/api/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({
      name: `Vanguard Global ${runId}`,
      slug: `vanguard-global-${runId}`,
    }),
  });
  assert.equal(createOrgRes.status, 201);
  const orgData = await createOrgRes.json();
  organizationId = orgData.organization.id;
  assert.ok(organizationId);

  // 2. Rename Organization
  const renameRes = await fetch(`${BASE_URL}/api/organizations/${organizationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({ name: `Vanguard Technologies International ${runId}` }),
  });
  assert.equal(renameRes.status, 200);

  // 3. Provision Secondary Workspace in Organization
  const createWsRes = await fetch(`${BASE_URL}/api/organizations/${organizationId}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({
      name: `Vanguard Staging Cluster ${runId}`,
      plan: "STARTER",
    }),
  });
  assert.equal(createWsRes.status, 201);
  const wsData = await createWsRes.json();
  stagingWsId = wsData.workspace.id;
  assert.ok(stagingWsId);
});

// ========================================================
// 5. TEAM INVITATIONS & RBAC PERMISSIONS ENFORCEMENT
// ========================================================

test("Phase 8 E2E - 8. Invitations & Acceptance: Invite Bob, accept token, verify role", async () => {
  // 1. Register Bob first
  const bobReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bob Builder",
      email: bobEmail,
      password: initialPassword,
      workspaceName: `Bob Solo Workspace ${runId}`,
    }),
  });
  assert.equal(bobReg.status, 200);
  const bobData = await bobReg.json();
  bobUserId = bobData.user.id;
  bobCookie = bobReg.headers.get("set-cookie") || "";

  // 2. Alice invites Bob to organization as MEMBER
  const inviteRes = await fetch(`${BASE_URL}/api/organizations/${organizationId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({
      email: bobEmail,
      role: "MEMBER",
    }),
  });
  assert.equal(inviteRes.status, 201);
  const inviteData = await inviteRes.json();
  const rawInviteToken = inviteData.invitation?.token;
  assert.ok(rawInviteToken, "Invitation token must be returned");

  // 3. Bob accepts invitation
  const acceptRes = await fetch(`${BASE_URL}/api/invitations/${rawInviteToken}`, {
    method: "POST",
    headers: { Cookie: bobCookie },
  });
  assert.equal(acceptRes.status, 200);

  // 4. Verify Bob has membership in DB with role MEMBER
  const bobOrgMem = await prisma.organizationMembership.findFirst({
    where: { organizationId, userId: bobUserId },
  });
  assert.ok(bobOrgMem);
  assert.equal(bobOrgMem.role, "MEMBER");
});

test("Phase 8 E2E - 9. Privilege Escalation Mitigation: Bob (MEMBER) cannot perform admin actions", async () => {
  // Bob attempts to rename organization (requires ADMIN/OWNER)
  const renameAttempt = await fetch(`${BASE_URL}/api/organizations/${organizationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: bobCookie },
    body: JSON.stringify({ name: "Hacked Org Name" }),
  });
  assert.equal(renameAttempt.status, 403, "MEMBER cannot rename organization");

  // Bob attempts to delete workspace (requires OWNER)
  const deleteAttempt = await fetch(`${BASE_URL}/api/workspaces/${stagingWsId}`, {
    method: "DELETE",
    headers: { Cookie: bobCookie },
  });
  assert.equal(deleteAttempt.status, 403, "MEMBER cannot delete workspace");
});

// ========================================================
// 6. MULTI-TENANT ISOLATION: OUTSIDER ACCESS BLOCKED
// ========================================================

test("Phase 8 E2E - 10. Multi-Tenant Isolation: Outsider Eve cannot view or mutate Alice's resources", async () => {
  // Register Eve
  const eveReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Eve Malicious",
      email: eveEmail,
      password: initialPassword,
      workspaceName: `Eve Workspace ${runId}`,
    }),
  });
  assert.equal(eveReg.status, 200);
  eveCookie = eveReg.headers.get("set-cookie") || "";

  // Eve attempts to inspect Alice's organization
  const getOrg = await fetch(`${BASE_URL}/api/organizations/${organizationId}`, {
    headers: { Cookie: eveCookie },
  });
  assert.equal(getOrg.status, 403, "Outsider cannot access organization details");

  // Eve attempts to read Alice's workspace audit logs
  const getAudits = await fetch(`${BASE_URL}/api/workspaces/${alicePrimaryWsId}/audit-logs`, {
    headers: { Cookie: eveCookie },
  });
  assert.equal(getAudits.status, 403, "Outsider cannot access workspace audit logs");

  // Eve attempts to list Alice's API keys
  const getKeys = await fetch(`${BASE_URL}/api/workspaces/${alicePrimaryWsId}/keys`, {
    headers: { Cookie: eveCookie },
  });
  assert.equal(getKeys.status, 403, "Outsider cannot access workspace API keys");
});

// ========================================================
// 7. DEVELOPER TOOLS, API GATEWAY & SECURE ROTATION
// ========================================================

test("Phase 8 E2E - 11. API Key Lifecycle: Creation, Ingestion, Rotation, and Revocation", async () => {
  // 1. Alice creates API key with 'events:write' and 'metrics:read'
  const keyCreateRes = await fetch(`${BASE_URL}/api/workspaces/${alicePrimaryWsId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({
      name: `QA Pipeline Key ${runId}`,
      environment: "live",
      scopes: ["events:write", "metrics:read"],
      expiresIn: "90d",
    }),
  });
  assert.equal(keyCreateRes.status, 201);
  const keyData = await keyCreateRes.json();
  apiKeyId = keyData.apiKey.id;
  rawApiKey = keyData.apiKey.rawKey;
  assert.ok(rawApiKey.startsWith("pfl_live_"));

  // 2. Verify key using /api/v1/keys/verify
  const verifyKeyRes = await fetch(`${BASE_URL}/api/v1/keys/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawApiKey}`,
    },
  });
  assert.equal(verifyKeyRes.status, 200);
  const verifiedData = await verifyKeyRes.json();
  assert.equal(verifiedData.valid, true);
  assert.ok(verifiedData.apiKey.scopes.includes("events:write"));

  // 3. Telemetry Ingestion via /api/v1/ingest
  const ingestRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawApiKey}`,
    },
    body: JSON.stringify({
      path: "/checkout/confirmation",
      method: "POST",
      statusCode: 201,
      durationMs: 45,
    }),
  });
  assert.ok([200, 201].includes(ingestRes.status));
  assert.ok(ingestRes.headers.has("x-ratelimit-remaining"));

  // 4. Rotate API key
  const rotateRes = await fetch(
    `${BASE_URL}/api/workspaces/${alicePrimaryWsId}/keys/${apiKeyId}/rotate`,
    {
      method: "POST",
      headers: { Cookie: aliceCookie },
    }
  );
  assert.equal(rotateRes.status, 200);
  const rotateData = await rotateRes.json();
  rotatedApiKey = rotateData.apiKey?.rawKey;
  assert.ok(rotatedApiKey?.startsWith("pfl_live_"));
  assert.notEqual(rotatedApiKey, rawApiKey, "Rotated key must differ from old key");

  // 5. Old key must now be rejected
  const oldIngestRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawApiKey}`,
    },
    body: JSON.stringify({ path: "/test", method: "GET", statusCode: 200, durationMs: 10 }),
  });
  assert.equal(oldIngestRes.status, 403, "Old rotated key must be rejected");

  // 6. New rotated key must succeed
  const newIngestRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rotatedApiKey}`,
    },
    body: JSON.stringify({ path: "/test", method: "GET", statusCode: 200, durationMs: 12 }),
  });
  assert.ok([200, 201].includes(newIngestRes.status), "Rotated key must succeed");

  // 7. Revoke key
  const revokeRes = await fetch(
    `${BASE_URL}/api/workspaces/${alicePrimaryWsId}/keys/${apiKeyId}`,
    {
      method: "DELETE",
      headers: { Cookie: aliceCookie },
    }
  );
  assert.equal(revokeRes.status, 200);

  // 8. Revoked key must now be rejected
  const revokedAttempt = await fetch(`${BASE_URL}/api/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rotatedApiKey}`,
    },
    body: JSON.stringify({ path: "/test", method: "GET", statusCode: 200, durationMs: 10 }),
  });
  assert.equal(revokedAttempt.status, 403, "Revoked key must be rejected");
});

// ========================================================
// 8. SUBSCRIPTION WEBHOOKS & IDEMPOTENCY
// ========================================================

test("Phase 8 E2E - 12. Billing Webhooks: Process payment event and enforce idempotency on duplicates", async () => {
  const eventId = `evt_qa_${Date.now()}`;
  const webhookPayload = JSON.stringify({
    id: eventId,
    type: "customer.subscription.updated",
    data: {
      id: `sub_qa_${Date.now()}`,
      status: "active",
      metadata: {
        organizationId: organizationId,
        planId: "PRO",
      },
    },
  });

  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET).update(webhookPayload, "utf8").digest("hex");

  // 1. First webhook transmission
  const firstRes = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pulseflow-signature": hmac,
    },
    body: webhookPayload,
  });
  assert.equal(firstRes.status, 200);
  const firstData = await firstRes.json();
  assert.equal(firstData.received, true);

  // 2. Second transmission with identical eventId (idempotency check)
  const secondRes = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pulseflow-signature": hmac,
    },
    body: webhookPayload,
  });
  assert.equal(secondRes.status, 200);
  const secondData = await secondRes.json();
  assert.equal(secondData.received, true);
  assert.equal(secondData.idempotent, true, "Duplicate event must be flagged as idempotent without reprocessing");
});

// ========================================================
// 9. SUPERADMIN CONTROLS & PLATFORM HEALTH
// ========================================================

test("Phase 8 E2E - 13. Superadmin Controls: Regular user blocked (403), Superadmin granted (200)", async () => {
  // 1. Alice (regular user) attempts to access /api/admin/overview
  const aliceAdminRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: aliceCookie },
  });
  assert.equal(aliceAdminRes.status, 403, "Regular user must be forbidden from admin overview");

  // 2. Login as superadmin (admin@pulseflow.io)
  const superAdminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@pulseflow.io",
      password: "Password123!",
    }),
  });
  assert.equal(superAdminLogin.status, 200);
  const adminCookie = superAdminLogin.headers.get("set-cookie") || "";

  // 3. Superadmin requests overview
  const superAdminRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(superAdminRes.status, 200);
  const adminData = await superAdminRes.json();
  assert.ok(adminData.stats.totalUsers > 0);
  assert.ok(adminData.stats.totalWorkspaces > 0);
});

test("Phase 8 E2E - 14. Platform Health Check: GET /api/health returns healthy status and DB latency", async () => {
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.status, "HEALTHY");
  assert.equal(healthData.database.status, "CONNECTED");
  assert.ok(healthData.uptimeSeconds >= 0);
});
