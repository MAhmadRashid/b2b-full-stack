import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:5000";

let ownerCookie = "";
let adminCookie = "";
let createdOrgId = "";
let createdWsId = "";
let inviteToken = "";
let testMemberId = "";

test.before(async () => {
  // 1. Authenticate Demo Owner (demo@acmecorp.com)
  const ownerRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
  });
  assert.equal(ownerRes.status, 200, "Owner login failed");
  ownerCookie = ownerRes.headers.get("set-cookie") || "";

  // 2. Authenticate Admin (dev@acmecorp.com)
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "dev@acmecorp.com", password: "Password123!" }),
  });
  if (adminRes.ok) {
    adminCookie = adminRes.headers.get("set-cookie") || "";
  }
});

test("1. Organizations API: GET /api/organizations returns user's organizations", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.organizations));
  assert.ok(data.organizations.length >= 1);
  const acme = data.organizations.find((o) => o.slug.includes("acme-corp"));
  assert.ok(acme);
  assert.equal(acme.role, "OWNER");
});

test("2. Organizations API: POST /api/organizations creates an organization with owner and default workspace", async () => {
  const res = await fetch(`${BASE_URL}/api/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: `Automated Test Org ${Date.now()}`,
      logoUrl: "https://example.com/logo.png",
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.organization);
  assert.ok(data.organization.id);
  assert.equal(data.organization.role, "OWNER");
  assert.ok(data.organization.defaultWorkspaceId);
  createdOrgId = data.organization.id;
});

test("3. Organizations API: GET /api/organizations/[orgId] returns detailed org info", async () => {
  assert.ok(createdOrgId);
  const res = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.organization);
  assert.equal(data.organization.id, createdOrgId);
  assert.ok(data.organization.isOwner);
  assert.ok(data.organization.canManage);
  assert.ok(Array.isArray(data.organization.members));
  assert.ok(Array.isArray(data.organization.workspaces));
});

test("4. Organizations API: PATCH /api/organizations/[orgId] updates organization name and logo", async () => {
  assert.ok(createdOrgId);
  const res = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: "Renamed Automated Test Org",
      logoUrl: "https://example.com/new-logo.png",
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.organization.name, "Renamed Automated Test Org");
  assert.equal(data.organization.logoUrl, "https://example.com/new-logo.png");
});

test("5. Team Invitations API: POST /api/organizations/[orgId]/members generates secure invitation", async () => {
  assert.ok(createdOrgId);
  const inviteEmail = `invite_test_${Date.now()}@example.com`;
  const res = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      email: inviteEmail,
      role: "ADMIN",
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.invitation);
  assert.ok(data.invitation.token);
  assert.equal(data.invitation.role, "ADMIN");
  inviteToken = data.invitation.token;

  // 6. Duplicate invitation prevention check
  const dupRes = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      email: inviteEmail,
      role: "ADMIN",
    }),
  });
  assert.equal(dupRes.status, 409, "Duplicate pending invitation must be rejected with 409 Conflict");
});

test("7. Invitation Flow: GET /api/invitations/[token] resolves invitation metadata", async () => {
  assert.ok(inviteToken);
  const res = await fetch(`${BASE_URL}/api/invitations/${inviteToken}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.valid, true);
  assert.ok(data.invitation);
  assert.equal(data.invitation.organizationId, createdOrgId);
});

test("8. Workspaces API: POST /api/workspaces creates workspace under organization", async () => {
  assert.ok(createdOrgId);
  const res = await fetch(`${BASE_URL}/api/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      name: "Org Staging Cluster",
      plan: "PRO",
      organizationId: createdOrgId,
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.workspace);
  assert.equal(data.workspace.organizationId, createdOrgId);
  createdWsId = data.workspace.id;
});

test("9. Workspaces API: GET /api/workspaces?orgId=... filters by organization", async () => {
  assert.ok(createdOrgId);
  const res = await fetch(`${BASE_URL}/api/workspaces?orgId=${createdOrgId}`, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.workspaces));
  assert.ok(data.workspaces.length >= 1);
  for (const ws of data.workspaces) {
    assert.equal(ws.organizationId, createdOrgId);
  }
});

test("10. Workspaces API: PATCH /api/workspaces/[id] renames workspace", async () => {
  assert.ok(createdWsId);
  const res = await fetch(`${BASE_URL}/api/workspaces/${createdWsId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ name: "Renamed Org Cluster" }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.workspace.name, "Renamed Org Cluster");
});

test("11. Role Escalation Prevention: ADMIN cannot promote someone to OWNER", async () => {
  if (!adminCookie) return;
  // dev@acmecorp.com is ADMIN in Acme Corp Cloud. Attempt to promote someone to OWNER
  const acmeWs = await fetch(`${BASE_URL}/api/workspaces?orgId=`, { headers: { Cookie: adminCookie } });
  const wsData = await acmeWs.json();
  const testWs = wsData.workspaces?.find((w) => w.role === "ADMIN");

  if (testWs) {
    const membersRes = await fetch(`${BASE_URL}/api/workspaces/${testWs.id}/members`, {
      headers: { Cookie: adminCookie },
    });
    const membersData = await membersRes.json();
    const nonOwner = membersData.members?.find((m) => m.role !== "OWNER");

    if (nonOwner) {
      const escalateRes = await fetch(`${BASE_URL}/api/workspaces/${testWs.id}/members/${nonOwner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ role: "OWNER" }),
      });
      assert.equal(escalateRes.status, 403, "ADMIN must not be able to promote to OWNER");
    }
  }
});

test("12. Clean Up: DELETE /api/organizations/[orgId] deletes test organization", async () => {
  if (!createdOrgId) return;
  const res = await fetch(`${BASE_URL}/api/organizations/${createdOrgId}`, {
    method: "DELETE",
    headers: { Cookie: ownerCookie },
  });
  assert.equal(res.status, 200);
});
