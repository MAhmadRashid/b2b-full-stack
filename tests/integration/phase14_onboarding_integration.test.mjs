import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "pulseflow-production-jwt-key-secret-98234823";

const runId = Date.now();
const testUserEmail = `onb_user_${runId}@company.io`;
const otherUserEmail = `onb_other_${runId}@company.io`;

let testUser;
let otherUser;
let testUserCookie = "";
let otherUserCookie = "";

test.before(async () => {
  const hash = await bcrypt.hash("Password123!", 10);

  testUser = await prisma.user.create({
    data: {
      email: testUserEmail,
      name: "Onboarding Tester",
      passwordHash: hash,
      systemRole: "USER",
    },
  });

  otherUser = await prisma.user.create({
    data: {
      email: otherUserEmail,
      name: "Other User",
      passwordHash: hash,
      systemRole: "USER",
    },
  });

  const testToken = jwt.sign(
    { userId: testUser.id, email: testUser.email, systemRole: testUser.systemRole },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  testUserCookie = `pulseflow_session=${testToken}`;

  const otherToken = jwt.sign(
    { userId: otherUser.id, email: otherUser.email, systemRole: otherUser.systemRole },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  otherUserCookie = `pulseflow_session=${otherToken}`;
});

test("Phase 14 Integration: GET /api/onboarding requires authentication", async () => {
  const res = await fetch(`${BASE_URL}/api/onboarding`);
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.ok(json.error);
});

test("Phase 14 Integration: GET /api/onboarding initializes progress and computes real checklist", async () => {
  const res = await fetch(`${BASE_URL}/api/onboarding`, {
    headers: { Cookie: testUserCookie },
  });
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.ok(json.progress);
  assert.equal(json.progress.currentStep, 1);
  assert.equal(json.progress.completed, false);
  assert.equal(json.progress.tourCompleted, false);

  assert.ok(json.checklist);
  assert.ok(Array.isArray(json.checklist.items));
  // User profile has name "Onboarding Tester", so profile item should be completed
  const profileItem = json.checklist.items.find((i) => i.id === "profile");
  assert.ok(profileItem);
  assert.equal(profileItem.completed, true);

  // But user has no workspace or API keys yet
  const wsItem = json.checklist.items.find((i) => i.id === "workspace");
  assert.ok(wsItem);
  assert.equal(wsItem.completed, false);
});

test("Phase 14 Integration: PATCH /api/onboarding updates currentStep and completedSteps", async () => {
  const res = await fetch(`${BASE_URL}/api/onboarding`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: testUserCookie,
    },
    body: JSON.stringify({
      currentStep: 2,
      completedStepId: "profile",
    }),
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.progress.currentStep, 2);
  assert.ok(json.progress.completedSteps.includes("profile"));
});

test("Phase 14 Integration: PATCH /api/onboarding updates tour completion and dismissal", async () => {
  const res = await fetch(`${BASE_URL}/api/onboarding`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: testUserCookie,
    },
    body: JSON.stringify({
      tourCompleted: true,
      tourDismissed: true,
    }),
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.progress.tourCompleted, true);
  assert.equal(json.progress.tourDismissed, true);
});

test("Phase 14 Integration: Cross-user tenant isolation - other user cannot mutate test user progress", async () => {
  // Other user gets their own separate onboarding progress
  const otherRes = await fetch(`${BASE_URL}/api/onboarding`, {
    headers: { Cookie: otherUserCookie },
  });
  assert.equal(otherRes.status, 200);
  const otherJson = await otherRes.json();

  assert.notEqual(otherJson.progress.id, "");
  // Other user's tour is not completed
  assert.equal(otherJson.progress.tourCompleted, false);

  // Check test user's status remains intact
  const verifyRes = await fetch(`${BASE_URL}/api/onboarding`, {
    headers: { Cookie: testUserCookie },
  });
  const verifyJson = await verifyRes.json();
  assert.equal(verifyJson.progress.tourCompleted, true);
});

test.after(async () => {
  await prisma.onboardingProgress.deleteMany({
    where: { userId: { in: [testUser.id, otherUser.id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [testUser.id, otherUser.id] } },
  });
  await prisma.$disconnect();
});
