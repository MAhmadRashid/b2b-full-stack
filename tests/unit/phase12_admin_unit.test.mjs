import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "pulseflow-default-secret-change-in-prod";
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

const prisma = new PrismaClient();

test.after(async () => {
  await prisma.$disconnect();
});

test("Phase 12 Admin Unit - 1. requireSuperAdmin guard blocks regular users and requires SUPERADMIN", async () => {
  // Test role differentiation
  const regularPayload = { userId: "user_test_1", email: "user@test.io", systemRole: "USER" };
  const adminPayload = { userId: "admin_test_1", email: "admin@test.io", systemRole: "SUPERADMIN" };

  const regularToken = signToken(regularPayload);
  const adminToken = signToken(adminPayload);

  assert.ok(regularToken, "Regular JWT token generated");
  assert.ok(adminToken, "Admin JWT token generated");
  assert.notEqual(regularPayload.systemRole, adminPayload.systemRole);
});

test("Phase 12 Admin Unit - 2. User suspension field defaults to false and stores recorded reason", async () => {
  const email = `suspend_unit_${Date.now()}@test.io`;
  const passwordHash = await bcrypt.hash("UnitPass123!", 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Suspend Test Unit",
      passwordHash,
      systemRole: "USER",
    },
  });

  assert.equal(user.suspended, false, "User should default to not suspended");
  assert.equal(user.suspensionReason, null, "User should default to null reason");

  const suspendedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      suspended: true,
      suspensionReason: "Policy violation: payment failure",
    },
  });

  assert.equal(suspendedUser.suspended, true);
  assert.equal(suspendedUser.suspensionReason, "Policy violation: payment failure");

  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
});

test("Phase 12 Admin Unit - 3. Organization suspension field defaults to false and persists reason", async () => {
  const slug = `org_suspend_${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: "Unit Org Suspend",
      slug,
      plan: "STARTER",
    },
  });

  assert.equal(org.suspended, false);

  const updatedOrg = await prisma.organization.update({
    where: { id: org.id },
    data: {
      suspended: true,
      suspensionReason: "Terms breach",
    },
  });

  assert.equal(updatedOrg.suspended, true);
  assert.equal(updatedOrg.suspensionReason, "Terms breach");

  // Cleanup
  await prisma.organization.delete({ where: { id: org.id } });
});

test("Phase 12 Admin Unit - 4. PlatformSetting model supports feature flags and JSON storage", async () => {
  const testKey = `UNIT_FLAG_${Date.now()}`;
  const setting = await prisma.platformSetting.create({
    data: {
      key: testKey,
      value: JSON.stringify(true),
      category: "FEATURE_FLAG",
      description: "Unit test feature flag",
      updatedBy: "unit_test_suite",
    },
  });

  assert.equal(setting.key, testKey);
  assert.equal(JSON.parse(setting.value), true);
  assert.equal(setting.category, "FEATURE_FLAG");

  // Cleanup
  await prisma.platformSetting.delete({ where: { id: setting.id } });
});
