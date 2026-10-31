import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "pulseflow-production-jwt-key-secret-98234823";

const runId = Date.now();
const aliceEmail = `alice_notif_${runId}@company.io`;
const bobEmail = `bob_notif_${runId}@company.io`;

let aliceUser;
let bobUser;
let workspace;
let aliceCookie = "";
let bobCookie = "";

test.before(async () => {
  const hash = await bcrypt.hash("Password123!", 10);

  // 1. Create Alice
  aliceUser = await prisma.user.create({
    data: {
      email: aliceEmail,
      name: "Alice Notifications",
      passwordHash: hash,
      systemRole: "USER",
    },
  });

  // 2. Create Bob
  bobUser = await prisma.user.create({
    data: {
      email: bobEmail,
      name: "Bob Notifications",
      passwordHash: hash,
      systemRole: "USER",
    },
  });

  // 3. Create Workspace
  workspace = await prisma.workspace.create({
    data: {
      name: `Notif WS ${runId}`,
      slug: `notif-ws-${runId}`,
      plan: "PRO",
      creatorId: aliceUser.id,
      members: {
        create: [
          { userId: aliceUser.id, role: "OWNER" },
          { userId: bobUser.id, role: "MEMBER" },
        ],
      },
    },
  });

  // Generate tokens
  const aliceToken = jwt.sign(
    { userId: aliceUser.id, email: aliceUser.email, systemRole: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  aliceCookie = `pulseflow_session=${aliceToken}`;

  const bobToken = jwt.sign(
    { userId: bobUser.id, email: bobUser.email, systemRole: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  bobCookie = `pulseflow_session=${bobToken}`;
});

test.after(async () => {
  // Cleanup
  if (workspace) {
    await prisma.notification.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.membership.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.workspace.deleteMany({ where: { id: workspace.id } });
  }
  await prisma.notificationPreference.deleteMany({
    where: { userId: { in: [aliceUser?.id, bobUser?.id].filter(Boolean) } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [aliceUser?.id, bobUser?.id].filter(Boolean) } },
  });
  await prisma.$disconnect();
});

// ========================================================
// 1. NOTIFICATION LISTING, UNREAD COUNT & AUTH
// ========================================================

test("Phase 13 E2E - 1. Unauthenticated requests to /api/notifications are blocked with 401", async () => {
  const res = await fetch(`${BASE_URL}/api/notifications`);
  assert.equal(res.status, 401);
});

test("Phase 13 E2E - 2. In-app notifications are created and listed with accurate unread counts", async () => {
  // Create notifications via database directly for Alice
  await prisma.notification.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: aliceUser.id,
        title: "Test In-App Notification 1",
        message: "You have a new update",
        type: "INFO",
        read: false,
      },
      {
        workspaceId: workspace.id,
        userId: aliceUser.id,
        title: "Test In-App Notification 2",
        message: "Second update alert",
        type: "WARNING",
        read: false,
      },
    ],
  });

  const res = await fetch(`${BASE_URL}/api/notifications?workspaceId=${workspace.id}`, {
    headers: { Cookie: aliceCookie },
  });
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.unreadCount >= 2, true);
  assert.equal(Array.isArray(data.notifications), true);
  assert.equal(data.notifications[0].title.startsWith("Test In-App Notification"), true);
});

// ========================================================
// 2. MARK AS READ & USER ISOLATION
// ========================================================

test("Phase 13 E2E - 3. Mark all notifications as read updates unread counter to 0", async () => {
  const patchRes = await fetch(`${BASE_URL}/api/notifications`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({ markAllRead: true, workspaceId: workspace.id }),
  });
  assert.equal(patchRes.status, 200);

  const getRes = await fetch(`${BASE_URL}/api/notifications?workspaceId=${workspace.id}`, {
    headers: { Cookie: aliceCookie },
  });
  assert.equal(getRes.status, 200);
  const data = await getRes.json();
  assert.equal(data.unreadCount, 0, "Unread count should be 0 after markAllRead");
});

test("Phase 13 E2E - 4. User cannot see or mutate another user's private notification", async () => {
  // Create a private notification specifically for Alice
  const privateNotif = await prisma.notification.create({
    data: {
      workspaceId: workspace.id,
      userId: aliceUser.id,
      title: "Alice Private Security Alert",
      message: "Secret login attempt from unusual IP",
      type: "CRITICAL",
      read: false,
    },
  });

  // Bob requests notifications - should NOT see Alice's private notification
  const bobGetRes = await fetch(`${BASE_URL}/api/notifications?workspaceId=${workspace.id}`, {
    headers: { Cookie: bobCookie },
  });
  const bobData = await bobGetRes.json();
  const foundInBob = bobData.notifications.some((n) => n.id === privateNotif.id);
  assert.equal(foundInBob, false, "Bob must not see Alice's private notification");

  // Bob attempts to mutate Alice's notification
  const bobPatchRes = await fetch(`${BASE_URL}/api/notifications`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: bobCookie },
    body: JSON.stringify({ notificationId: privateNotif.id }),
  });
  assert.equal(bobPatchRes.status, 403, "Bob cannot mutate Alice's notification");
});

// ========================================================
// 3. USER NOTIFICATION PREFERENCES API
// ========================================================

test("Phase 13 E2E - 5. GET & PUT /api/users/preferences/notifications updates settings safely", async () => {
  // 1. Get default preferences
  const getRes = await fetch(`${BASE_URL}/api/users/preferences/notifications`, {
    headers: { Cookie: aliceCookie },
  });
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.ok(getData.preferences);
  assert.equal(getData.preferences.securityAlerts, true);

  // 2. Update preferences (opt out of marketing, change frequency)
  const putRes = await fetch(`${BASE_URL}/api/users/preferences/notifications`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({
      billingAlerts: true,
      usageAlerts: false, // Turn off usage alerts
      marketingEmails: false,
      emailFrequency: "DAILY_DIGEST",
    }),
  });
  assert.equal(putRes.status, 200);
  const putData = await putRes.json();
  assert.equal(putData.success, true);
  assert.equal(putData.preferences.usageAlerts, false);
  assert.equal(putData.preferences.emailFrequency, "DAILY_DIGEST");
  assert.equal(putData.preferences.securityAlerts, true, "Security alerts must remain true");
});
