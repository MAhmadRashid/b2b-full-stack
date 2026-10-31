import { getPlan } from "./billing-plans";
import type { PlanId, PlanConfig } from "./billing-plans";

export interface WorkspacePlanResolutionTarget {
  plan?: string | null;
  organization?: {
    plan?: string | null;
  } | null;
}

/**
 * Resolves the effective subscription plan ID for a workspace.
 *
 * Inheritance Rule:
 * 1. If the parent organization has an active paid subscription tier (STARTER, PRO, BUSINESS, ENTERPRISE),
 *    the workspace automatically inherits the organization's plan and entitlements.
 * 2. If the organization is on the FREE plan or absent, the workspace's individually assigned plan is used.
 * 3. Defaults safely to FREE if no higher plan is found.
 */
export function resolveEffectivePlan(
  target: WorkspacePlanResolutionTarget | null | undefined
): PlanId {
  if (!target) return "FREE";

  const orgPlan = target.organization?.plan;
  if (orgPlan && orgPlan.toUpperCase() !== "FREE") {
    return orgPlan.toUpperCase() as PlanId;
  }

  const wsPlan = target.plan;
  if (wsPlan && wsPlan.toUpperCase() !== "FREE") {
    return wsPlan.toUpperCase() as PlanId;
  }

  return "FREE";
}

/**
 * Resolves the full PlanConfig object (limits, entitlements, pricing) for a workspace.
 */
export function resolveEffectivePlanConfig(
  target: WorkspacePlanResolutionTarget | null | undefined
): PlanConfig {
  const effectiveId = resolveEffectivePlan(target);
  return getPlan(effectiveId);
}
