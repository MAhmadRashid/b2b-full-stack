import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";

let superAdminCookie = "";
let regularUserCookie = "";

test.after(async () => {
  await prisma.$disconnect();
});

test("Phase 10 Integration - 1. Platform Health Check: /api/health exposes verified status & DB latency", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, "HEALTHY");
  assert.equal(data.database.status, "CONNECTED");
  assert.ok(typeof data.database.latencyMs === "number");
  assert.ok(data.readiness);
  assert.equal(data.readiness.envValid, true);
});

test("Phase 10 Integration - 2. SRE Monitoring Access: Unauthenticated request rejected with 401", async () => {
  const res = await fetch(`${BASE_URL}/api/admin/monitoring`);
  assert.equal(res.status, 401, "Unauthenticated access must be rejected with 401");
});

test("Phase 10 Integration - 3. SRE Monitoring Access: Regular user rejected with 403 Forbidden", async () => {
  // Login as regular user (demo@acmecorp.com)
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(loginRes.status, 200);
  regularUserCookie = loginRes.headers.get("set-cookie") || "";

  // Attempt to access SRE monitoring
  const monitorRes = await fetch(`${BASE_URL}/api/admin/monitoring`, {
    headers: { Cookie: regularUserCookie },
  });
  assert.equal(monitorRes.status, 403, "Regular user must be forbidden from SRE monitoring");
});

test("Phase 10 Integration - 4. SRE Monitoring: Superadmin receives complete system telemetry", async () => {
  // Login as superadmin (admin@pulseflow.io)
  const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@pulseflow.io", password: "Password123!" }),
  });
  assert.equal(adminLogin.status, 200);
  superAdminCookie = adminLogin.headers.get("set-cookie") || "";

  // Access SRE monitoring
  const monitorRes = await fetch(`${BASE_URL}/api/admin/monitoring`, {
    headers: { Cookie: superAdminCookie },
  });
  assert.equal(monitorRes.status, 200);
  const data = await monitorRes.json();

  assert.equal(data.status, "HEALTHY");
  assert.ok(data.system.memory.rssMb > 0);
  assert.ok(data.system.memory.heapUsedMb > 0);
  assert.equal(data.database.status, "CONNECTED");
  assert.ok(data.database.inventory.users > 0);
  assert.ok(data.database.inventory.workspaces > 0);
  assert.ok(data.performance.percentiles);
  assert.ok(data.reliability.alerts);
});

test("Phase 10 Integration - 5. Maintenance Automation: Record verification & audit entry", async () => {
  const auditLogs = await prisma.auditLog.findMany({
    where: { action: "SYSTEM_MAINTENANCE_COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  assert.ok(auditLogs.length > 0, "Maintenance audit log should be recorded");
  assert.ok(auditLogs[0].details.includes("maintenance pruned"));
});
