import test from "node:test";
import assert from "node:assert/strict";

const ROLE_RANKS = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

function hasMinimumRole(userRole, requiredRole) {
  const userRank = ROLE_RANKS[userRole?.toUpperCase()];
  const reqRank = ROLE_RANKS[requiredRole?.toUpperCase()];
  if (userRank === undefined || reqRank === undefined) return false;
  return userRank >= reqRank;
}

function canAssignRole(actorRole, targetRole) {
  const normActor = actorRole?.toUpperCase();
  const normTarget = targetRole?.toUpperCase();

  if (normActor === "OWNER") {
    return ["OWNER", "ADMIN", "MEMBER", "VIEWER"].includes(normTarget);
  }
  if (normActor === "ADMIN") {
    return ["ADMIN", "MEMBER", "VIEWER"].includes(normTarget);
  }
  return false;
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

test("RBAC Role Escalation: OWNER can assign all roles including OWNER", () => {
  assert.equal(canAssignRole("OWNER", "OWNER"), true);
  assert.equal(canAssignRole("OWNER", "ADMIN"), true);
  assert.equal(canAssignRole("OWNER", "MEMBER"), true);
  assert.equal(canAssignRole("OWNER", "VIEWER"), true);
});

test("RBAC Role Escalation: ADMIN cannot promote to OWNER", () => {
  assert.equal(canAssignRole("ADMIN", "OWNER"), false, "ADMIN must not be allowed to assign OWNER role");
  assert.equal(canAssignRole("ADMIN", "ADMIN"), true);
  assert.equal(canAssignRole("ADMIN", "MEMBER"), true);
  assert.equal(canAssignRole("ADMIN", "VIEWER"), true);
});

test("RBAC Role Escalation: MEMBER and VIEWER cannot assign any roles", () => {
  assert.equal(canAssignRole("MEMBER", "VIEWER"), false);
  assert.equal(canAssignRole("MEMBER", "MEMBER"), false);
  assert.equal(canAssignRole("VIEWER", "VIEWER"), false);
});
