import test from "node:test";
import assert from "node:assert/strict";

function resolveEffectivePlan(target) {
  if (!target) return "FREE";
  const orgPlan = target.organization?.plan;
  if (orgPlan && orgPlan.toUpperCase() !== "FREE") {
    return orgPlan.toUpperCase();
  }
  const wsPlan = target.plan;
  if (wsPlan && wsPlan.toUpperCase() !== "FREE") {
    return wsPlan.toUpperCase();
  }
  return "FREE";
}

const LIMITS = {
  FREE: { id: "FREE", limits: { maxApiKeys: 2 } },
  STARTER: { id: "STARTER", limits: { maxApiKeys: 5 } },
  PRO: { id: "PRO", limits: { maxApiKeys: 20 } },
  ENTERPRISE: { id: "ENTERPRISE", limits: { maxApiKeys: 200 } },
};

function resolveEffectivePlanConfig(target) {
  const plan = resolveEffectivePlan(target);
  return LIMITS[plan] || LIMITS.FREE;
}

test("Plan Resolver - Organization paid plan takes precedence", () => {
  const ws = {
    plan: "FREE",
    organization: { plan: "PRO" },
  };
  const plan = resolveEffectivePlan(ws);
  assert.strictEqual(plan, "PRO");

  const config = resolveEffectivePlanConfig(ws);
  assert.strictEqual(config.id, "PRO");
  assert.strictEqual(config.limits.maxApiKeys, 20);
});

test("Plan Resolver - Workspace paid plan used when organization is FREE", () => {
  const ws = {
    plan: "STARTER",
    organization: { plan: "FREE" },
  };
  const plan = resolveEffectivePlan(ws);
  assert.strictEqual(plan, "STARTER");

  const config = resolveEffectivePlanConfig(ws);
  assert.strictEqual(config.id, "STARTER");
  assert.strictEqual(config.limits.maxApiKeys, 5);
});

test("Plan Resolver - Falls back to FREE when both are missing or FREE", () => {
  assert.strictEqual(resolveEffectivePlan(null), "FREE");
  assert.strictEqual(resolveEffectivePlan({ plan: "FREE", organization: { plan: "FREE" } }), "FREE");
  assert.strictEqual(resolveEffectivePlan({ plan: null, organization: null }), "FREE");

  const freeConfig = resolveEffectivePlanConfig(null);
  assert.strictEqual(freeConfig.id, "FREE");
  assert.strictEqual(freeConfig.limits.maxApiKeys, 2);
});

test("Plan Resolver - Organization Enterprise tier overrides workspace tier", () => {
  const ws = {
    plan: "STARTER",
    organization: { plan: "ENTERPRISE" },
  };
  assert.strictEqual(resolveEffectivePlan(ws), "ENTERPRISE");

  const config = resolveEffectivePlanConfig(ws);
  assert.strictEqual(config.id, "ENTERPRISE");
  assert.strictEqual(config.limits.maxApiKeys, 200);
});
