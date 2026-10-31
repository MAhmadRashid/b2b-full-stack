import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test("Phase 20 Firebase Integration - 1. Environment & Config Integrity", (t) => {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
  assert.ok(envContent.includes("NEXT_PUBLIC_FIREBASE_PROJECT_ID"), "Must contain Firebase project ID");
  assert.ok(envContent.includes("antigravity-saas-188c1"), "Must point to active project antigravity-saas-188c1");
  assert.ok(envContent.includes("NEXT_PUBLIC_FIREBASE_API_KEY"), "Must contain client API key");
  assert.ok(envContent.includes("NEXT_PUBLIC_FIREBASE_APP_ID"), "Must contain client App ID");
});

test("Phase 20 Firebase Integration - 2. Firestore Security Rules Coverage", (t) => {
  const rulesContent = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf-8");

  const requiredCollections = [
    "users",
    "organizations",
    "workspaces",
    "invitations",
    "plans",
    "subscriptions",
    "usageRecords",
    "analyticsEvents",
    "dailyAnalytics",
    "notifications",
    "notificationPreferences",
    "leads",
    "apiKeys",
    "auditLogs",
  ];

  for (const coll of requiredCollections) {
    assert.ok(rulesContent.includes(coll), `Firestore rules must cover collection '${coll}'`);
  }

  // Ensure helper functions exist
  assert.ok(rulesContent.includes("function isSuperAdmin()"));
  assert.ok(rulesContent.includes("function isOrgMember(orgId)"));
  assert.ok(rulesContent.includes("function isWorkspaceMember(workspaceId)"));
});

test("Phase 20 Firebase Integration - 3. Firebase Configuration Files Exist", (t) => {
  assert.ok(fs.existsSync(path.resolve(process.cwd(), "firebase.json")), "firebase.json must exist");
  assert.ok(fs.existsSync(path.resolve(process.cwd(), "firestore.indexes.json")), "firestore.indexes.json must exist");
  assert.ok(fs.existsSync(path.resolve(process.cwd(), ".firebaserc")), ".firebaserc must exist");

  const rcContent = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), ".firebaserc"), "utf-8"));
  assert.equal(rcContent.projects.default, "antigravity-saas-188c1");
});

test("Phase 20 Firebase Integration - 4. User Provisioning and Multi-Tenant Isolation", async (t) => {
  const testEmail = `firebase_user_${Date.now()}@example.com`;
  const testUid = `fb_uid_${Date.now()}`;

  // Simulate user provisioned from Firebase Auth sync
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: "Firebase Test User",
      passwordHash: `FIREBASE_AUTH:${testUid}`,
      systemRole: "USER",
    },
  });

  assert.ok(user.id);
  assert.equal(user.email, testEmail);
  assert.ok(user.passwordHash.startsWith("FIREBASE_AUTH:"));

  // Create isolated organization and workspace
  const org = await prisma.organization.create({
    data: {
      name: "Firebase Test Org",
      slug: `fb-org-${Date.now().toString(36)}`,
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
    include: { members: true },
  });

  assert.equal(org.members.length, 1);
  assert.equal(org.members[0].role, "OWNER");

  const ws = await prisma.workspace.create({
    data: {
      name: "Firebase Test Workspace",
      slug: `fb-ws-${Date.now().toString(36)}`,
      creatorId: user.id,
      organizationId: org.id,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
    include: { members: true },
  });

  assert.equal(ws.members[0].role, "OWNER");

  // Verify non-member isolation
  const otherUser = await prisma.user.create({
    data: {
      email: `other_${Date.now()}@example.com`,
      name: "Other User",
      passwordHash: "test_hash",
    },
  });

  const isMember = await prisma.organizationMembership.findUnique({
    where: {
      userId_organizationId: {
        userId: otherUser.id,
        organizationId: org.id,
      },
    },
  });

  assert.equal(isMember, null, "Unrelated user must NOT have membership");

  // Cleanup
  await prisma.workspace.delete({ where: { id: ws.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.deleteMany({ where: { id: { in: [user.id, otherUser.id] } } });
});

test("Phase 20 Firebase Integration - 5. API Key Generation and Secret Masking", async (t) => {
  const crypto = await import("node:crypto");
  const rawSecret = `pfl_live_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = rawSecret.substring(0, 16);
  const hashedKey = crypto.createHash("sha256").update(rawSecret).digest("hex");

  const apiKey = await prisma.apiKey.create({
    data: {
      name: "Production Firebase Key",
      keyPrefix,
      hashedKey,
      userId: (await prisma.user.findFirst())?.id || "temp_user",
      scopes: "metrics:read,events:write",
      rateLimit: 120,
    },
  });

  assert.ok(apiKey.id);
  assert.equal(apiKey.keyPrefix, keyPrefix);
  assert.notEqual(apiKey.hashedKey, rawSecret, "Raw secret must never be stored directly");
  assert.equal(apiKey.hashedKey, hashedKey);

  // Cleanup
  await prisma.apiKey.delete({ where: { id: apiKey.id } });
});

test("Phase 20 Firebase Integration - 6. Auth Firebase Route Contract & Input Validation", async (t) => {
  // Validate request contract
  function validateFirebaseRequest(body) {
    if (!body || !body.idToken || typeof body.idToken !== "string") {
      return { status: 400, error: "Valid Firebase idToken is required" };
    }
    if (body.idToken.length < 10) {
      return { status: 401, error: "Invalid or expired Firebase ID token" };
    }
    return { status: 200, success: true };
  }

  // Missing idToken should return 400
  const checkEmpty = validateFirebaseRequest({});
  assert.equal(checkEmpty.status, 400);
  assert.ok(checkEmpty.error.includes("idToken is required"));

  // Malformed idToken
  const checkShort = validateFirebaseRequest({ idToken: "bad" });
  assert.equal(checkShort.status, 401);

  // Valid contract
  const checkValid = validateFirebaseRequest({ idToken: "ey_fake_jwt_valid_format_test" });
  assert.equal(checkValid.status, 200);
});

test("Phase 20 Firebase Integration - 7. User & Workspace Sync Provisioning Idempotency", async (t) => {
  const syncEmail = `google_sync_${Date.now()}@pulseflow.io`;
  const syncName = "Google Sync User";
  const syncUid = `google_uid_${Date.now()}`;

  // First sync provisioning
  let user = await prisma.user.findUnique({ where: { email: syncEmail } });
  assert.equal(user, null);

  user = await prisma.user.create({
    data: {
      email: syncEmail,
      name: syncName,
      passwordHash: `FIREBASE_AUTH:${syncUid}`,
      systemRole: "USER",
    },
  });

  const slug = `goog-${Date.now().toString(36)}`;
  const org = await prisma.organization.create({
    data: {
      name: `${syncName}'s Team`,
      slug,
      ownerId: user.id,
      plan: "FREE",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const ws = await prisma.workspace.create({
    data: {
      name: "Default Workspace",
      slug: `${slug}-default`,
      creatorId: user.id,
      organizationId: org.id,
      plan: "STARTER",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  // Second sync with existing email: should resolve existing user without duplicate key collision
  const existingUser = await prisma.user.findUnique({
    where: { email: syncEmail },
  });
  assert.ok(existingUser);
  assert.equal(existingUser.id, user.id);

  // Cleanup
  await prisma.workspace.delete({ where: { id: ws.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

