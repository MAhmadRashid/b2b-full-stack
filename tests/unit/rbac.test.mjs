import test from "node:test";
import assert from "node:assert/strict";

// Re-implement or import pure logic for RBAC rank checks
const ROLE_RANKS = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

function hasMinimumRole(userRole, requiredRole) {
  const userRank = ROLE_RANKS[userRole];
  const reqRank = ROLE_RANKS[requiredRole];
  if (userRank === undefined || reqRank === undefined) return false;
  return userRank >= reqRank;
}

test("RBAC: OWNER satisfies all role requirements", () => {
  assert.equal(hasMinimumRole("OWNER", "OWNER"), true);
  assert.equal(hasMinimumRole("OWNER", "ADMIN"), true);
  assert.equal(hasMinimumRole("OWNER", "MEMBER"), true);
  assert.equal(hasMinimumRole("OWNER", "VIEWER"), true);
});

test("RBAC: ADMIN satisfies ADMIN, MEMBER, and VIEWER requirements but not OWNER", () => {
  assert.equal(hasMinimumRole("ADMIN", "OWNER"), false);
  assert.equal(hasMinimumRole("ADMIN", "ADMIN"), true);
  assert.equal(hasMinimumRole("ADMIN", "MEMBER"), true);
  assert.equal(hasMinimumRole("ADMIN", "VIEWER"), true);
});

test("RBAC: MEMBER satisfies MEMBER and VIEWER requirements but not ADMIN/OWNER", () => {
  assert.equal(hasMinimumRole("MEMBER", "OWNER"), false);
  assert.equal(hasMinimumRole("MEMBER", "ADMIN"), false);
  assert.equal(hasMinimumRole("MEMBER", "MEMBER"), true);
  assert.equal(hasMinimumRole("MEMBER", "VIEWER"), true);
});

test("RBAC: VIEWER only satisfies VIEWER requirement", () => {
  assert.equal(hasMinimumRole("VIEWER", "OWNER"), false);
  assert.equal(hasMinimumRole("VIEWER", "ADMIN"), false);
  assert.equal(hasMinimumRole("VIEWER", "MEMBER"), false);
  assert.equal(hasMinimumRole("VIEWER", "VIEWER"), true);
});

test("RBAC: Invalid or unknown roles fail gracefully", () => {
  assert.equal(hasMinimumRole("UNKNOWN", "VIEWER"), false);
  assert.equal(hasMinimumRole("VIEWER", "INVALID"), false);
});
