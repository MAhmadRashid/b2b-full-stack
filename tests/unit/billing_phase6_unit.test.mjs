import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// 1. Subscription Plans Definition under test
const SUBSCRIPTION_PLANS = {
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
      teamCollaboration: true,
      auditLogs: false,
      advancedAnalytics: false,
      dataExport: false,
      prioritySupport: false,
      slaGuarantee: false,
      dedicatedSolutionsArchitect: false,
    },
  },
  STARTER: {
    id: "STARTER",
    name: "Team Starter",
    tagline: "For early-stage startups and small teams building production apps",
    pricing: {
      monthlyCents: 2900,
      annualCents: 27800,
      annualMonthlyEquivalentCents: 2317,
    },
    limits: {
      maxWorkspaces: 3,
      maxTeamMembers: 5,
      monthlyRequests: 100000,
      telemetryRetentionDays: 7,
      maxApiKeys: 10,
      maxWebhooks: 5,
    },
    entitlements: {
      customWebhooks: true,
      teamCollaboration: true,
      auditLogs: false,
      advancedAnalytics: false,
      dataExport: true,
      prioritySupport: false,
      slaGuarantee: false,
      dedicatedSolutionsArchitect: false,
    },
  },
  PRO: {
    id: "PRO",
    name: "Growth Pro",
    tagline: "High-throughput telemetry, real-time alerts, and deep query analytics",
    popular: true,
    pricing: {
      monthlyCents: 7900,
      annualCents: 75800,
      annualMonthlyEquivalentCents: 6317,
    },
    limits: {
      maxWorkspaces: 10,
      maxTeamMembers: 20,
      monthlyRequests: 1000000,
      telemetryRetentionDays: 30,
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
      slaGuarantee: false,
      dedicatedSolutionsArchitect: false,
    },
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Scale Business",
    tagline: "Advanced security controls, audit trails, and multi-team collaboration",
    pricing: {
      monthlyCents: 19900,
      annualCents: 191000,
      annualMonthlyEquivalentCents: 15917,
    },
    limits: {
      maxWorkspaces: 50,
      maxTeamMembers: 100,
      monthlyRequests: 5000000,
      telemetryRetentionDays: 90,
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
      dedicatedSolutionsArchitect: false,
    },
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise Custom",
    tagline: "Dedicated infrastructure, custom SLAs, bespoke retention, and 24/7 phone support",
    pricing: {
      monthlyCents: 49900,
      annualCents: 479000,
      annualMonthlyEquivalentCents: 39917,
    },
    limits: {
      maxWorkspaces: 999999,
      maxTeamMembers: 999999,
      monthlyRequests: 10000000,
      telemetryRetentionDays: 365,
      maxApiKeys: 999999,
      maxWebhooks: 999999,
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
  },
};

function formatPrice(cents, currency = "USD") {
  if (cents === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function checkEntitlement(planId, entitlementKey) {
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.FREE;
  return plan.entitlements[entitlementKey] === true;
}

function checkUsageLimit(planId, limitKey, currentUsage) {
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.FREE;
  const limit = plan.limits[limitKey];
  const allowed = currentUsage < limit;

  let upgradePlan = null;
  if (!allowed) {
    const tiers = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];
    const currentIndex = tiers.indexOf(planId);
    for (let i = currentIndex + 1; i < tiers.length; i++) {
      const nextTier = tiers[i];
      if (SUBSCRIPTION_PLANS[nextTier].limits[limitKey] > currentUsage) {
        upgradePlan = nextTier;
        break;
      }
    }
    if (!upgradePlan) upgradePlan = "ENTERPRISE";
  }

  return {
    allowed,
    currentUsage,
    limit,
    planId,
    upgradePlan,
    message: allowed
      ? undefined
      : `Usage limit reached (${currentUsage}/${limit} for ${limitKey}). Upgrade to ${upgradePlan} to increase quota.`,
  };
}

function verifyWebhookSignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  try {
    let signature = signatureHeader;
    let timestamp = null;

    if (signatureHeader.includes("t=") && signatureHeader.includes("v1=")) {
      const parts = signatureHeader.split(",");
      for (const part of parts) {
        const [k, v] = part.trim().split("=");
        if (k === "t") timestamp = parseInt(v, 10);
        if (k === "v1") signature = v;
      }

      if (timestamp) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - timestamp) > 300) {
          return false; // Expired timestamp (> 5 minutes)
        }
      }
    }

    const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(signedPayload, "utf8");
    const expectedSignature = hmac.digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");

    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ====================== TEST SUITE ======================

test("Subscription Plans: All 5 tiers (FREE, STARTER, PRO, BUSINESS, ENTERPRISE) are configured", () => {
  const tiers = Object.keys(SUBSCRIPTION_PLANS);
  assert.deepEqual(tiers, ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"]);

  for (const tier of tiers) {
    const plan = SUBSCRIPTION_PLANS[tier];
    assert.ok(plan.id, `${tier} must have an id`);
    assert.ok(plan.name, `${tier} must have a name`);
    assert.ok(plan.tagline, `${tier} must have a tagline`);
    assert.ok(plan.limits, `${tier} must have limits configured`);
    assert.ok(plan.entitlements, `${tier} must have entitlements configured`);
    assert.ok(typeof plan.pricing.monthlyCents === "number", "Monthly cents must be a number");
    assert.ok(typeof plan.pricing.annualCents === "number", "Annual cents must be a number");
  }
});

test("Subscription Plans: Monotonic limit progression across tiers", () => {
  const tiers = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];
  for (let i = 0; i < tiers.length - 1; i++) {
    const current = SUBSCRIPTION_PLANS[tiers[i]];
    const next = SUBSCRIPTION_PLANS[tiers[i + 1]];

    assert.ok(
      next.limits.maxWorkspaces > current.limits.maxWorkspaces,
      `Workspaces limit must escalate: ${next.id} (${next.limits.maxWorkspaces}) > ${current.id} (${current.limits.maxWorkspaces})`
    );
    assert.ok(
      next.limits.maxTeamMembers > current.limits.maxTeamMembers,
      `Members limit must escalate: ${next.id} > ${current.id}`
    );
    assert.ok(
      next.limits.monthlyRequests > current.limits.monthlyRequests,
      `Monthly requests must escalate: ${next.id} > ${current.id}`
    );
    assert.ok(
      next.limits.telemetryRetentionDays > current.limits.telemetryRetentionDays,
      `Retention days must escalate: ${next.id} > ${current.id}`
    );
  }
});

test("Subscription Plans: 20% Annual billing discount is consistently applied", () => {
  const paidTiers = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"];
  for (const tier of paidTiers) {
    const plan = SUBSCRIPTION_PLANS[tier];
    const fullAnnualCost = plan.pricing.monthlyCents * 12;
    const discountedAnnualCost = plan.pricing.annualCents;

    // Discount percentage should be approx 20%
    const savingsPercent = Math.round(((fullAnnualCost - discountedAnnualCost) / fullAnnualCost) * 100);
    assert.equal(savingsPercent, 20, `Tier ${tier} must provide 20% annual savings (got ${savingsPercent}%)`);
  }
});

test("Pricing Formatter: Correctly formats free and paid amounts", () => {
  assert.equal(formatPrice(0), "$0");
  assert.equal(formatPrice(2900), "$29");
  assert.equal(formatPrice(7900), "$79");
  assert.equal(formatPrice(19900), "$199");
  assert.equal(formatPrice(49900), "$499");
});

test("Entitlements: Validates feature gating per plan tier", () => {
  // Free tier should not have audit logs or custom webhooks
  assert.equal(checkEntitlement("FREE", "auditLogs"), false);
  assert.equal(checkEntitlement("FREE", "customWebhooks"), false);
  assert.equal(checkEntitlement("FREE", "slaGuarantee"), false);

  // Starter tier unlocks custom webhooks and data export, but not audit logs
  assert.equal(checkEntitlement("STARTER", "customWebhooks"), true);
  assert.equal(checkEntitlement("STARTER", "dataExport"), true);
  assert.equal(checkEntitlement("STARTER", "auditLogs"), false);

  // Pro tier unlocks audit logs, advanced analytics, priority support
  assert.equal(checkEntitlement("PRO", "auditLogs"), true);
  assert.equal(checkEntitlement("PRO", "advancedAnalytics"), true);
  assert.equal(checkEntitlement("PRO", "prioritySupport"), true);
  assert.equal(checkEntitlement("PRO", "slaGuarantee"), false);

  // Business tier unlocks SLA guarantee
  assert.equal(checkEntitlement("BUSINESS", "slaGuarantee"), true);
  assert.equal(checkEntitlement("BUSINESS", "dedicatedSolutionsArchitect"), false);

  // Enterprise tier unlocks dedicated architect
  assert.equal(checkEntitlement("ENTERPRISE", "dedicatedSolutionsArchitect"), true);
});

test("Usage Limits: Server-side check permits actions within quota", () => {
  const result = checkUsageLimit("FREE", "maxWorkspaces", 0);
  assert.equal(result.allowed, true);
  assert.equal(result.currentUsage, 0);
  assert.equal(result.limit, 1);
  assert.equal(result.upgradePlan, null);
  assert.equal(result.message, undefined);
});

test("Usage Limits: Server-side check blocks actions exceeding quota with upgrade advice", () => {
  // Free limit is 1 workspace. Having 1 workspace and trying to add another (currentUsage = 1) is blocked
  const result = checkUsageLimit("FREE", "maxWorkspaces", 1);
  assert.equal(result.allowed, false);
  assert.equal(result.currentUsage, 1);
  assert.equal(result.limit, 1);
  assert.equal(result.upgradePlan, "STARTER");
  assert.ok(result.message.includes("Upgrade to STARTER"));
});

test("Usage Limits: Blocks team member exceeding tier limit and suggests correct higher tier", () => {
  // Starter limit is 5 team members
  const blockedStarter = checkUsageLimit("STARTER", "maxTeamMembers", 5);
  assert.equal(blockedStarter.allowed, false);
  assert.equal(blockedStarter.upgradePlan, "PRO");
  assert.ok(blockedStarter.message.includes("Upgrade to PRO"));
});

test("Webhook Security: Verifies valid HMAC-SHA256 signature", () => {
  const secret = "whsec_test_secret_key_1234567890";
  const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const validSignature = hmac.digest("hex");

  assert.equal(verifyWebhookSignature(payload, validSignature, secret), true);
});

test("Webhook Security: Rejects invalid or tampered webhook payload", () => {
  const secret = "whsec_test_secret_key_1234567890";
  const payload = JSON.stringify({ id: "evt_123", amount: 1000 });
  const tamperedPayload = JSON.stringify({ id: "evt_123", amount: 1 });

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const validSignature = hmac.digest("hex");

  assert.equal(verifyWebhookSignature(tamperedPayload, validSignature, secret), false);
});

test("Webhook Security: Rejects webhook with incorrect secret", () => {
  const secret = "whsec_correct_secret";
  const wrongSecret = "whsec_wrong_secret";
  const payload = JSON.stringify({ id: "evt_456" });

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  const signature = hmac.digest("hex");

  assert.equal(verifyWebhookSignature(payload, signature, wrongSecret), false);
});

test("Webhook Security: Handles Stripe-formatted signature header with timestamp verification", () => {
  const secret = "whsec_stripe_test";
  const payload = JSON.stringify({ id: "evt_stripe_test" });
  const nowSec = Math.floor(Date.now() / 1000);

  const signedPayload = `${nowSec}.${payload}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(signedPayload, "utf8");
  const v1Signature = hmac.digest("hex");

  const stripeHeader = `t=${nowSec},v1=${v1Signature}`;
  assert.equal(verifyWebhookSignature(payload, stripeHeader, secret), true);

  // Expired timestamp (> 300 seconds ago)
  const expiredSec = nowSec - 360;
  const expiredSignedPayload = `${expiredSec}.${payload}`;
  const expiredHmac = crypto.createHmac("sha256", secret);
  expiredHmac.update(expiredSignedPayload, "utf8");
  const expiredSignature = expiredHmac.digest("hex");

  const expiredHeader = `t=${expiredSec},v1=${expiredSignature}`;
  assert.equal(verifyWebhookSignature(payload, expiredHeader, secret), false);
});
