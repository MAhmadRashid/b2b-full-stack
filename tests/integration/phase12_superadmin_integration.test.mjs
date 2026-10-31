import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "pulseflow-production-jwt-key-secret-98234823";

const runId = Date.now();
const adminEmail = `superadmin_${runId}@pulseflow.io`;
const normalEmail = `regular_${runId}@company.io`;
const targetUserEmail = `target_victim_${runId}@client.io`;
const targetOrgSlug = `target-org-${runId}`;

let adminUser;
let regularUser;
let targetUser;
let targetOrg;
let adminCookie = "";
let regularCookie = "";

test.before(async () => {
  const hash = await bcrypt.hash("Password123!", 10);

  // 1. Create Superadmin
  adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Global Superadmin",
      passwordHash: hash,
      systemRole: "SUPERADMIN",
    },
  });

  // 2. Create Regular User
  regularUser = await prisma.user.create({
    data: {
      email: normalEmail,
      name: "Regular Employee",
      passwordHash: hash,
      systemRole: "USER",
    },
  });

  // 3. Create Target User for suspension testing
  targetUser = await prisma.user.create({
    data: {
      email: targetUserEmail,
      name: "Target Client",
      passwordHash: hash,
      systemRole: "USER",
    },
  });

  // 4. Create Target Organization & Workspace for suspension testing
  targetOrg = await prisma.organization.create({
    data: {
      name: `Target Org ${runId}`,
      slug: targetOrgSlug,
      plan: "STARTER",
      ownerId: targetUser.id,
      workspaces: {
        create: {
          name: `Target WS ${runId}`,
          slug: `target-ws-${runId}`,
          plan: "STARTER",
        },
      },
    },
  });

  // Generate tokens
  const adminToken = jwt.sign(
    { userId: adminUser.id, email: adminUser.email, systemRole: "SUPERADMIN" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  adminCookie = `pulseflow_session=${adminToken}`;

  const regularToken = jwt.sign(
    { userId: regularUser.id, email: regularUser.email, systemRole: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  regularCookie = `pulseflow_session=${regularToken}`;
});

test.after(async () => {
  // Cleanup
  if (targetOrg) {
    await prisma.workspace.deleteMany({ where: { organizationId: targetOrg.id } });
    await prisma.organization.deleteMany({ where: { id: targetOrg.id } });
  }
  await prisma.user.deleteMany({
    where: { id: { in: [adminUser?.id, regularUser?.id, targetUser?.id].filter(Boolean) } },
  });
  await prisma.$disconnect();
});

// ========================================================
// 1. STRICT SECURITY & AUTHORIZATION TESTS
// ========================================================

test("Phase 12 E2E - 1. Unauthenticated requests to /api/admin/* endpoints return 401 Unauthorized", async () => {
  const endpoints = [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/organizations",
    "/api/admin/subscriptions",
    "/api/admin/settings",
    "/api/admin/audit-logs",
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep}`);
    assert.equal(res.status, 401, `Expected 401 for unauthenticated ${ep}, got ${res.status}`);
  }
});

test("Phase 12 E2E - 2. Regular user (systemRole=USER) is rejected with 403 Forbidden across all admin APIs", async () => {
  const endpoints = [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/organizations",
    "/api/admin/subscriptions",
    "/api/admin/settings",
    "/api/admin/audit-logs",
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep}`, {
      headers: { Cookie: regularCookie },
    });
    assert.equal(res.status, 403, `Expected 403 for standard user on ${ep}, got ${res.status}`);
  }
});

// ========================================================
// 2. SUPERADMIN OVERVIEW & REAL DATA METRICS
// ========================================================

test("Phase 12 E2E - 3. Superadmin accesses /api/admin/overview with real metrics & historical charts", async () => {
  const res = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.ok(data.metrics, "Metrics object must exist");
  assert.ok(typeof data.metrics.totalUsers === "number");
  assert.ok(typeof data.metrics.totalOrganizations === "number");
  assert.ok(typeof data.metrics.totalRevenueFormatted === "string");
  assert.ok(Array.isArray(data.charts.past7Days), "Charts past7Days array must exist");
  assert.equal(data.charts.past7Days.length, 7, "Must contain exactly 7 days of real data");
});

// ========================================================
// 3. USER MANAGEMENT: SEARCH, SUSPENSION & REACTIVATION
// ========================================================

test("Phase 12 E2E - 4. Superadmin queries users, suspends target user, and verifies login block", async () => {
  // Query users
  const listRes = await fetch(`${BASE_URL}/api/admin/users?search=${encodeURIComponent(targetUserEmail)}`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.ok(listData.users.length >= 1, "Target user should be returned");
  assert.equal(listData.users[0].email, targetUserEmail);

  // Suspend user
  const suspendRes = await fetch(`${BASE_URL}/api/admin/users/${targetUser.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ action: "SUSPEND", reason: "Suspicious API brute-force behavior" }),
  });
  assert.equal(suspendRes.status, 200);
  const suspendData = await suspendRes.json();
  assert.equal(suspendData.success, true);
  assert.equal(suspendData.user.suspended, true);

  // Verify suspended user cannot sign in
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: targetUserEmail, password: "Password123!" }),
  });
  assert.equal(loginRes.status, 403, "Suspended user login must be rejected with 403 Forbidden");

  // Reactivate user
  const reactivateRes = await fetch(`${BASE_URL}/api/admin/users/${targetUser.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ action: "REACTIVATE" }),
  });
  assert.equal(reactivateRes.status, 200);
  const reactivateData = await reactivateRes.json();
  assert.equal(reactivateData.user.suspended, false);
});

// ========================================================
// 4. ORGANIZATION MANAGEMENT: INSPECT & SUSPEND
// ========================================================

test("Phase 12 E2E - 5. Superadmin inspects organizations and suspends target organization", async () => {
  const orgsRes = await fetch(`${BASE_URL}/api/admin/organizations?search=${encodeURIComponent(targetOrgSlug)}`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(orgsRes.status, 200);
  const orgsData = await orgsRes.json();
  assert.ok(orgsData.organizations.length >= 1);

  // Suspend organization
  const suspendRes = await fetch(`${BASE_URL}/api/admin/organizations/${targetOrg.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ action: "SUSPEND", reason: "Billing dispute and chargeback investigation" }),
  });
  assert.equal(suspendRes.status, 200);
  const suspendData = await suspendRes.json();
  assert.equal(suspendData.organization.suspended, true);

  // Reactivate organization
  const reactivateRes = await fetch(`${BASE_URL}/api/admin/organizations/${targetOrg.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ action: "REACTIVATE" }),
  });
  assert.equal(reactivateRes.status, 200);
  const reactivateData = await reactivateRes.json();
  assert.equal(reactivateData.organization.suspended, false);
});

// ========================================================
// 5. PLATFORM SETTINGS & FEATURE FLAGS
// ========================================================

test("Phase 12 E2E - 6. Superadmin toggles feature flags and retrieves settings", async () => {
  // Fetch settings
  const getRes = await fetch(`${BASE_URL}/api/admin/settings`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.ok(Array.isArray(getData.settings), "Settings array must be returned");

  // Save new setting
  const flagKey = `TEST_FLAG_${runId}`;
  const postRes = await fetch(`${BASE_URL}/api/admin/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      key: flagKey,
      value: true,
      category: "FEATURE_FLAG",
      description: "Automated regression flag",
    }),
  });
  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.success, true);
  assert.equal(postData.setting.key, flagKey);
});

// ========================================================
// 6. ENTERPRISE AUDIT LOGGING
// ========================================================

test("Phase 12 E2E - 7. Superadmin accesses cross-tenant audit log stream with pagination", async () => {
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(auditRes.status, 200);
  const auditData = await auditRes.json();
  assert.ok(Array.isArray(auditData.auditLogs), "Audit logs list must be returned");
  assert.ok(auditData.pagination.total >= 1, "Should have audit entries recorded");
});
