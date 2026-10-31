export type PlanId = "FREE" | "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";
export type BillingInterval = "MONTHLY" | "ANNUAL";

export interface PlanLimits {
  maxWorkspaces: number;
  maxTeamMembers: number;
  monthlyRequests: number;
  telemetryRetentionDays: number;
  maxApiKeys: number;
  maxWebhooks: number;
}

export interface PlanEntitlements {
  customWebhooks: boolean;
  teamCollaboration: boolean;
  auditLogs: boolean;
  advancedAnalytics: boolean;
  dataExport: boolean;
  prioritySupport: boolean;
  slaGuarantee: boolean;
  dedicatedSolutionsArchitect: boolean;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  badge?: string;
  popular?: boolean;
  pricing: {
    monthlyCents: number;
    annualCents: number; // total annual charge
    annualMonthlyEquivalentCents: number; // equivalent per month when billed annually
  };
  limits: PlanLimits;
  entitlements: PlanEntitlements;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<PlanId, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Developer Free",
    tagline: "Essential observability for personal projects & local testing",
    pricing: {
      monthlyCents: 0,
      annualCents: 0,
      annualMonthlyEquivalentCents: 0,
    },
    limits: {
      maxWorkspaces: 1,
      maxTeamMembers: 2,
      monthlyRequests: 10000,
      telemetryRetentionDays: 1,
      maxApiKeys: 2,
      maxWebhooks: 1,
    },
    entitlements: {
      customWebhooks: false,
      teamCollaboration: false,
      auditLogs: false,
      advancedAnalytics: false,
      dataExport: true,
      prioritySupport: false,
      slaGuarantee: false,
      dedicatedSolutionsArchitect: false,
    },
    features: [
      "10,000 Telemetry requests / month",
      "1 Team workspace",
      "Up to 2 team members",
      "1 Active API Key",
      "24-Hour telemetry retention",
      "JSON & CSV data export",
      "Community GitHub support",
    ],
  },

  STARTER: {
    id: "STARTER",
    name: "Growth Starter",
    tagline: "Ideal for early-stage startups and small engineering squads",
    pricing: {
      monthlyCents: 2900, // $29
      annualCents: 29000, // $290 (2 months free)
      annualMonthlyEquivalentCents: 2400, // ~$24/mo
    },
    limits: {
      maxWorkspaces: 3,
      maxTeamMembers: 5,
      monthlyRequests: 50000,
      telemetryRetentionDays: 7,
      maxApiKeys: 5,
      maxWebhooks: 3,
    },
    entitlements: {
      customWebhooks: true,
      teamCollaboration: true,
      auditLogs: true,
      advancedAnalytics: false,
      dataExport: true,
      prioritySupport: false,
      slaGuarantee: false,
      dedicatedSolutionsArchitect: false,
    },
    features: [
      "50,000 Telemetry requests / month",
      "3 Isolated team workspaces",
      "Up to 5 team members",
      "5 Active API Keys with expiration",
      "7-Day data retention & metrics",
      "Outbound webhook dispatchers",
      "Full audit trail logs",
      "Standard email support (48h)",
    ],
  },

  PRO: {
    id: "PRO",
    name: "Team Pro",
    tagline: "High-throughput telemetry & analytics for scaling tech companies",
    popular: true,
    badge: "Most Popular",
    pricing: {
      monthlyCents: 9900, // $99
      annualCents: 99000, // $990
      annualMonthlyEquivalentCents: 8250, // ~$82.50/mo
    },
    limits: {
      maxWorkspaces: 10,
      maxTeamMembers: 15,
      monthlyRequests: 250000,
      telemetryRetentionDays: 30,
      maxApiKeys: 20,
      maxWebhooks: 10,
    },
    entitlements: {
      customWebhooks: true,
      teamCollaboration: true,
      auditLogs: true,
      advancedAnalytics: true,
      dataExport: true,
      prioritySupport: true,
      slaGuarantee: false,
      dedicatedSolutionsArchitect: false,
    },
    features: [
      "250,000 Telemetry requests / month",
      "10 Isolated team workspaces",
      "Up to 15 team members with RBAC",
      "20 Active API Keys with scopes",
      "30-Day metrics retention",
      "10 Custom webhook endpoints",
      "Advanced latency & percentile analytics",
      "Export streaming with CSV sanitization",
      "Priority email support (12h response)",
    ],
  },

  BUSINESS: {
    id: "BUSINESS",
    name: "Scale Business",
    tagline: "Enterprise-grade observability, high concurrency & 99.9% uptime SLA",
    badge: "Best for Scale",
    pricing: {
      monthlyCents: 24900, // $249
      annualCents: 249000, // $2,490
      annualMonthlyEquivalentCents: 20750, // ~$207.50/mo
    },
    limits: {
      maxWorkspaces: 25,
      maxTeamMembers: 50,
      monthlyRequests: 1000000,
      telemetryRetentionDays: 90,
      maxApiKeys: 50,
      maxWebhooks: 25,
    },
    entitlements: {
      customWebhooks: true,
      teamCollaboration: true,
      auditLogs: true,
      advancedAnalytics: true,
      dataExport: true,
      prioritySupport: true,
      slaGuarantee: true,
      dedicatedSolutionsArchitect: false,
    },
    features: [
      "1,000,000 Telemetry requests / month",
      "25 Isolated team workspaces",
      "Up to 50 team members",
      "50 Active API Keys with rotation",
      "90-Day data retention window",
      "25 Automated webhook webhooks",
      "99.9% Uptime SLA commitment",
      "Compliance audit logs export",
      "Dedicated Slack / Discord channel support",
    ],
  },

  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise Global",
    tagline: "Dedicated cloud infrastructure, custom quotas & solutions engineering",
    pricing: {
      monthlyCents: 59900, // $599
      annualCents: 599000, // $5,990
      annualMonthlyEquivalentCents: 49900, // ~$499/mo
    },
    limits: {
      maxWorkspaces: 100,
      maxTeamMembers: 500,
      monthlyRequests: 5000000,
      telemetryRetentionDays: 365,
      maxApiKeys: 200,
      maxWebhooks: 100,
    },
    entitlements: {
      customWebhooks: true,
      teamCollaboration: true,
      auditLogs: true,
      advancedAnalytics: true,
      dataExport: true,
      prioritySupport: true,
      slaGuarantee: true,
      dedicatedSolutionsArchitect: true,
    },
    features: [
      "5,000,000+ Telemetry requests / month",
      "100+ Team workspaces",
      "Up to 500 team members",
      "200 Active API Keys",
      "1-Year full retention",
      "100 Webhook destinations",
      "99.99% Custom enterprise SLA",
      "Dedicated Solutions Architect",
      "Custom security review & DPA sign-off",
      "24/7 Phone & emergency escalation",
    ],
  },
};

/**
 * Normalizes and resolves a plan configuration.
 */
export function getPlan(planId?: string | null): PlanConfig {
  if (!planId) return SUBSCRIPTION_PLANS.FREE;
  const key = planId.toUpperCase();
  if (key === "GROWTH") return SUBSCRIPTION_PLANS.PRO;
  if (key === "SCALE") return SUBSCRIPTION_PLANS.BUSINESS;
  if (key === "TEAM") return SUBSCRIPTION_PLANS.STARTER;
  return SUBSCRIPTION_PLANS[key as PlanId] || SUBSCRIPTION_PLANS.FREE;
}

/**
 * Retrieves all plans in hierarchical order.
 */
export function getAllPlans(): PlanConfig[] {
  return [
    SUBSCRIPTION_PLANS.FREE,
    SUBSCRIPTION_PLANS.STARTER,
    SUBSCRIPTION_PLANS.PRO,
    SUBSCRIPTION_PLANS.BUSINESS,
    SUBSCRIPTION_PLANS.ENTERPRISE,
  ];
}

/**
 * Checks whether a given plan possesses a specific boolean feature entitlement.
 */
export function checkEntitlement(planId: string, feature: keyof PlanEntitlements): boolean {
  const plan = getPlan(planId);
  return Boolean(plan.entitlements[feature]);
}

/**
 * Evaluates whether current usage falls within the plan's limit ceiling.
 */
export function checkUsageLimit(
  planId: string,
  metric: keyof PlanLimits,
  currentUsage: number
): {
  allowed: boolean;
  limit: number;
  currentUsage: number;
  remaining: number;
  upgradeRequired: boolean;
  suggestedPlan?: PlanId;
} {
  const plan = getPlan(planId);
  const limit = plan.limits[metric];
  const allowed = currentUsage < limit;
  const remaining = Math.max(0, limit - currentUsage);

  let suggestedPlan: PlanId | undefined;
  if (!allowed) {
    const all = getAllPlans();
    const currIdx = all.findIndex((p) => p.id === plan.id);
    for (let i = currIdx + 1; i < all.length; i++) {
      if (all[i].limits[metric] > currentUsage) {
        suggestedPlan = all[i].id;
        break;
      }
    }
    if (!suggestedPlan && currIdx < all.length - 1) {
      suggestedPlan = all[all.length - 1].id;
    }
  }

  return {
    allowed,
    limit,
    currentUsage,
    remaining,
    upgradeRequired: !allowed,
    suggestedPlan,
  };
}

/**
 * Currency formatter helper.
 */
export function formatPrice(amountCents: number, currency: string = "USD"): string {
  if (amountCents === 0) return "$0";
  const dollars = (amountCents / 100).toFixed(0);
  return `$${dollars}`;
}
