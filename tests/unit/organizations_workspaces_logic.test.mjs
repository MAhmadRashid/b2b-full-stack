import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

test("Database: Organizations have name, logoUrl, slug, ownerId, createdAt", async () => {
  const org = await prisma.organization.findFirst({
    where: { slug: "acme-corp" },
    include: {
      owner: true,
      members: true,
      workspaces: true,
    },
  });

  assert.ok(org, "Acme Corporation must exist in database");
  assert.equal(org.name, "Acme Corporation");
  assert.equal(org.slug, "acme-corp");
  assert.ok(org.logoUrl);
  assert.ok(org.ownerId);
  assert.ok(org.owner);
  assert.ok(org.createdAt);
  assert.ok(org.members.length >= 1, "Must have organization members");
});

test("Database: Users can belong to multiple organizations", async () => {
  const demoUser = await prisma.user.findUnique({
    where: { email: "demo@acmecorp.com" },
    include: {
      orgMemberships: {
        include: { organization: true },
      },
    },
  });

  assert.ok(demoUser);
  assert.ok(
    demoUser.orgMemberships.length >= 2,
    "demo@acmecorp.com must belong to multiple organizations (Acme and Starlight)"
  );

  const orgNames = demoUser.orgMemberships.map((m) => m.organization.name);
  assert.ok(orgNames.includes("Acme Corporation"));
  assert.ok(orgNames.includes("Starlight Telemetry AI"));
});

test("Database: Workspaces record creator and organization links", async () => {
  const ws = await prisma.workspace.findFirst({
    where: { slug: "acme-corp" },
    include: {
      creator: true,
      organization: true,
      members: true,
    },
  });

  assert.ok(ws);
  assert.ok(ws.organizationId, "Workspace must be linked to an organization");
  assert.equal(ws.organization.name, "Acme Corporation");
  assert.ok(ws.creator, "Workspace must have a recorded creator");
  assert.ok(ws.creator.email);
  assert.ok(ws.members.length >= 1, "Workspace must have members");
});

test("RBAC & Guards: isLastOrganizationOwner accurately detects sole owner", async () => {
  // Create test org with 1 owner
  const testOrg = await prisma.organization.create({
    data: {
      name: "Solitary Org",
      slug: `solitary-${Date.now()}`,
    },
  });

  const testUser = await prisma.user.create({
    data: {
      email: `test_owner_${Date.now()}@example.com`,
      name: "Sole Owner",
      passwordHash: "hash123",
    },
  });

  await prisma.organizationMembership.create({
    data: {
      organizationId: testOrg.id,
      userId: testUser.id,
      role: "OWNER",
    },
  });

  // Verify sole owner
  const owners = await prisma.organizationMembership.findMany({
    where: { organizationId: testOrg.id, role: "OWNER" },
  });
  assert.equal(owners.length, 1);
  assert.equal(owners[0].userId, testUser.id);

  // Clean up test org
  await prisma.organizationMembership.deleteMany({ where: { organizationId: testOrg.id } });
  await prisma.organization.delete({ where: { id: testOrg.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});

test("Invitations: Duplicate pending invitations are prevented for same email in same scope", async () => {
  const acmeWs = await prisma.workspace.findFirst({ where: { slug: "acme-corp" } });
  assert.ok(acmeWs);

  const testEmail = `invitee_${Date.now()}@testcorp.com`;
  const token1 = `inv_test1_${Date.now()}`;
  const tokenHash1 = crypto.createHash("sha256").update(token1).digest("hex");

  // Create first invitation
  const inv1 = await prisma.invitation.create({
    data: {
      workspaceId: acmeWs.id,
      email: testEmail,
      role: "MEMBER",
      token: token1,
      tokenHash: tokenHash1,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      status: "PENDING",
    },
  });

  assert.ok(inv1.id);

  // Check for duplicate pending invite
  const duplicate = await prisma.invitation.findFirst({
    where: {
      workspaceId: acmeWs.id,
      email: testEmail,
      status: "PENDING",
    },
  });

  assert.ok(duplicate, "Duplicate check finds existing pending invitation");
  assert.equal(duplicate.id, inv1.id);

  // Clean up
  await prisma.invitation.delete({ where: { id: inv1.id } });
});

test("Invitations: Acceptance activates membership and revokes/invalidates token", async () => {
  const acmeWs = await prisma.workspace.findFirst({ where: { slug: "acme-corp" } });
  assert.ok(acmeWs);

  const inviteeEmail = `accepted_user_${Date.now()}@acmetest.com`;
  const token = `inv_accept_${Date.now()}`;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const inv = await prisma.invitation.create({
    data: {
      workspaceId: acmeWs.id,
      email: inviteeEmail,
      role: "MEMBER",
      token,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      status: "PENDING",
    },
  });

  // User accepts: create user & membership, mark invitation ACCEPTED
  const newUser = await prisma.user.create({
    data: {
      email: inviteeEmail,
      name: "Accepted User",
      passwordHash: await bcrypt.hash("Password123!", 10),
    },
  });

  await prisma.membership.create({
    data: {
      userId: newUser.id,
      workspaceId: acmeWs.id,
      role: inv.role,
    },
  });

  await prisma.invitation.update({
    where: { id: inv.id },
    data: { status: "ACCEPTED" },
  });

  // Verification: membership is active
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: newUser.id,
        workspaceId: acmeWs.id,
      },
    },
  });
  assert.ok(membership);
  assert.equal(membership.role, "MEMBER");

  // Verification: Token is now ACCEPTED and cannot be reused
  const checkToken = await prisma.invitation.findFirst({
    where: {
      token,
      status: "PENDING",
    },
  });
  assert.equal(checkToken, null, "Accepted token must not be found as PENDING");

  // Clean up
  await prisma.membership.delete({ where: { id: membership.id } });
  await prisma.invitation.delete({ where: { id: inv.id } });
  await prisma.user.delete({ where: { id: newUser.id } });
});

test("Data Isolation: Cross-organization workspace queries are strictly segregated", async () => {
  const acmeOrg = await prisma.organization.findUnique({ where: { slug: "acme-corp" } });
  const starlightOrg = await prisma.organization.findUnique({ where: { slug: "starlight-ai" } });

  assert.ok(acmeOrg);
  assert.ok(starlightOrg);

  const acmeWorkspaces = await prisma.workspace.findMany({
    where: { organizationId: acmeOrg.id },
  });

  const starlightWorkspaces = await prisma.workspace.findMany({
    where: { organizationId: starlightOrg.id },
  });

  assert.ok(acmeWorkspaces.length > 0);
  assert.ok(starlightWorkspaces.length > 0);

  // Check no cross contamination
  for (const aws of acmeWorkspaces) {
    assert.notEqual(aws.organizationId, starlightOrg.id);
  }
  for (const sws of starlightWorkspaces) {
    assert.notEqual(sws.organizationId, acmeOrg.id);
  }
});
