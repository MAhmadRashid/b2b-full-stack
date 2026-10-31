import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:5000";

let ownerCookie = "";
let adminCookie = "";
let untrustedCookie = "";
let defaultWorkspaceId = "";
let createdOrgId = "";

test.before(async () => {
  // 1. Authenticate Owner (demo@acmecorp.com)
  const ownerRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(ownerRes.status, 200, "Owner login failed");
  ownerCookie = ownerRes.headers.get("set-cookie") || "";
  const ownerData = await ownerRes.json();
  if (ownerData.user) {
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: ownerCookie } });
    const meData = await meRes.json();
    if (meData.workspaces && meData.workspaces.length > 0) {
      defaultWorkspaceId = meData.workspaces[0].id;
    }
  }

  // 2. Authenticate Admin (dev@acmecorp.com)
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "dev@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(adminRes.status, 200, "Admin login failed");
  adminCookie = adminRes.headers.get("set-cookie") || "";

  // 3. Register or Authenticate Untrusted User (untrusted@tenant-x.com)
  const untrustedReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `untrusted_${Date.now()}@tenant-x.com`,
      password: "Password123!",
      name: "Untrusted User",
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
// 1. PASSWORD RESET FLOW
// ==========================================
test("Phase 2 - 1. Password Reset: Request token for user", async () => {
  const email = "dev@acmecorp.com";

  // Request password reset
  const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);

  // Retrieve token from database
  const user = await prisma.user.findUnique({ where: { email } });
  assert.ok(user);

  const resetTokenRecord = await prisma.passwordResetToken.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(resetTokenRecord, "Password reset token should be recorded");
  assert.ok(resetTokenRecord.token.startsWith("rst_"));
  assert.ok(new Date(resetTokenRecord.expiresAt) > new Date());

  // Test reset with fake token -> 400
  const badReset = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "rst_fake_nonexistent_token", password: "NewPassword123!" }),
  });
  assert.equal(badReset.status, 400);

  // Test reset with valid token
  const goodReset = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetTokenRecord.token, password: "NewValidPassword456!" }),
  });
  assert.equal(goodReset.status, 200);

  // Verify old password fails
  const oldLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Password123!" }),
  });
  assert.equal(oldLogin.status, 401);

  // Verify new password succeeds
  const newLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "NewValidPassword456!" }),
  });
  assert.equal(newLogin.status, 200);

  // Verify token cannot be reused (consumed)
  const reuseReset = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetTokenRecord.token, password: "AnotherPassword123!" }),
  });
  assert.equal(reuseReset.status, 400);

  // Restore password back to Password123! for test consistency
  const restoreTokenRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.equal(restoreTokenRes.status, 200);
  const restoreRecord = await prisma.passwordResetToken.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: restoreRecord.token, password: "Password123!" }),
  });
});

// ==========================================
// 2. EMAIL VERIFICATION FLOW
// ==========================================
test("Phase 2 - 2. Email Verification: Request and verify token", async () => {
  // Ensure emailVerified is null before triggering verification flow
  await prisma.user.update({
    where: { email: "dev@acmecorp.com" },
    data: { emailVerified: null },
  });

  // Request verification token
  const sendRes = await fetch(`${BASE_URL}/api/auth/send-verification`, {
    method: "POST",
    headers: { Cookie: adminCookie },
  });
  assert.equal(sendRes.status, 200);

  // Retrieve token from DB
  const user = await prisma.user.findUnique({ where: { email: "dev@acmecorp.com" } });
  const vToken = await prisma.verificationToken.findFirst({
    where: { email: "dev@acmecorp.com" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(vToken, "Verification token must exist");
  assert.ok(vToken.token.startsWith("vfy_"));

  // Verify with invalid token
  const badVerify = await fetch(`${BASE_URL}/api/auth/verify-email?token=vfy_invalid_token`);
  assert.equal(badVerify.status, 400);

  // Verify with valid token
  const goodVerify = await fetch(`${BASE_URL}/api/auth/verify-email?token=${vToken.token}`);
  assert.equal(goodVerify.status, 200);
  const verifyData = await goodVerify.json();
  assert.equal(verifyData.success, true);

  // Check user record has emailVerified populated
  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
  assert.ok(updatedUser.emailVerified, "emailVerified must be set to Date");

  // Re-verify fails (token consumed)
  const reusedVerify = await fetch(`${BASE_URL}/api/auth/verify-email?token=${vToken.token}`);
  assert.equal(reusedVerify.status, 400);
});

// ==========================================
// 3. ORGANIZATIONS & WORKSPACES LIFECYCLE
// ==========================================
test("Phase 2 - 3. Organizations: Create organization with default workspace", async () => {
  const orgName = `Acme Enterprise ${Date.now()}`;
  const res = await fetch(`${BASE_URL}/api/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ name: orgName }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.organization.name, orgName);
  assert.ok(data.organization.id);
  assert.ok(data.organization.defaultWorkspaceId, "Should have default workspace");
  createdOrgId = data.organization.id;
});

test("Phase 2 - 4. Organizations: Retrieve organization details and members", async () => {
  assert.ok(createdOrgId, "Must have createdOrgId");
  const res = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.organization.id, createdOrgId);
  assert.equal(data.organization.role, "OWNER");
  assert.ok(data.organization.members.length >= 1);
  assert.equal(data.organization.members[0].role, "OWNER");
  assert.equal(data.organization.canManage, true);
});

test("Phase 2 - 5. Workspaces: Provision secondary workspace in organization", async () => {
  const wsName = `Secondary Edge Node ${Date.now()}`;
  const res = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ name: wsName, plan: "PRO" }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.workspace.name, wsName);
  assert.equal(data.workspace.plan, "PRO");
  assert.equal(data.workspace.organizationId, createdOrgId);

  // Verify org now has 2 workspaces
  const orgRes = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    headers: { Cookie: ownerCookie },
  });
  const orgData = await orgRes.json();
  assert.equal(orgData.organization.workspaces.length, 2);
});

test("Phase 2 - 6. Organizations: Rename organization (Owner/Admin)", async () => {
  const newName = `Renamed Global Group ${Date.now()}`;
  const res = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ name: newName }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.organization.name, newName);
});

// ==========================================
// 4. TENANT ISOLATION & RBAC CHECKS
// ==========================================
test("Phase 2 - 7. Tenant Isolation: Untrusted user cannot read or edit other org", async () => {
  assert.ok(untrustedCookie, "Must have untrustedCookie");

  // Attempt to read Acme's organization
  const getRes = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    headers: { Cookie: untrustedCookie },
  });
  assert.equal(getRes.status, 403, "Cross-org read must be blocked (403)");

  // Attempt to rename Acme's organization
  const patchRes = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: untrustedCookie },
    body: JSON.stringify({ name: "Malicious Takeover Name" }),
  });
  assert.equal(patchRes.status, 403, "Cross-org modification must be blocked (403)");

  // Attempt to provision workspace in Acme's organization
  const postWsRes = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: untrustedCookie },
    body: JSON.stringify({ name: "Hacker Workspace" }),
  });
  assert.equal(postWsRes.status, 403, "Cross-org workspace creation must be blocked (403)");
});

// ==========================================
// 5. INVITATIONS LIFECYCLE (RESEND & REJECT)
// ==========================================
test("Phase 2 - 8. Invitations: Invite member, resend to extend expiry, and reject", async () => {
  assert.ok(defaultWorkspaceId, "Must have defaultWorkspaceId");
  const testEmail = `invite_test_${Date.now()}@example.com`;

  // 1. Create invitation
  const inviteRes = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      email: testEmail,
      name: "Invited Test User",
      role: "MEMBER",
      sendInviteLink: true,
    }),
  });
  assert.equal(inviteRes.status, 201);
  const inviteData = await inviteRes.json();
  assert.ok(inviteData.invitation);
  const invitationId = inviteData.invitation.id;
  const token = inviteData.invitation.token;

  // 2. Resend invitation
  const resendRes = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}/members/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ invitationId }),
  });
  assert.equal(resendRes.status, 200);
  const resendData = await resendRes.json();
  assert.equal(resendData.success, true);
  const refreshedToken = resendData.invitation.token;
  assert.ok(refreshedToken, "Resend returns updated token");

  // 3. Inspect invitation via public endpoint
  const checkRes = await fetch(`${BASE_URL}/api/invitations/${refreshedToken}`);
  assert.equal(checkRes.status, 200);
  const checkData = await checkRes.json();
  assert.equal(checkData.valid, true);

  // 4. Reject / Decline invitation
  const rejectRes = await fetch(`${BASE_URL}/api/invitations/${refreshedToken}/reject`, {
    method: "POST",
  });
  assert.equal(rejectRes.status, 200);
  const rejectData = await rejectRes.json();
  assert.equal(rejectData.success, true);

  // 5. Verify invitation is now gone / invalid
  const subsequentCheck = await fetch(`${BASE_URL}/api/invitations/${refreshedToken}`);
  assert.equal(subsequentCheck.status, 404);
});

// ==========================================
// 6. RBAC ESCALATION PREVENTION
// ==========================================
test("Phase 2 - 9. RBAC Escalation: Admin cannot delete workspace or delete org", async () => {
  // Admin attempts to delete workspace
  const delWsRes = await fetch(`${BASE_URL}/api/workspaces/${defaultWorkspaceId}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });
  assert.equal(delWsRes.status, 403, "Only OWNER can delete workspace");

  // Admin attempts to delete organization
  const delOrgRes = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });
  assert.equal(delOrgRes.status, 403, "Only organization OWNER can delete organization");
});
