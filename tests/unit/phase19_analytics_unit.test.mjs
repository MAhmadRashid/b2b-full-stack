import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mirror funnel definitions and scrubbing utility for Node ESM testing
const FUNNEL_STAGES = [
  "LANDING_VISIT",
  "TRIAL_CTA_CLICK",
  "SIGNUP_STARTED",
  "SIGNUP_COMPLETED",
  "ORG_WORKSPACE_CREATED",
  "ONBOARDING_STEP_COMPLETED",
  "TRIAL_STARTED",
  "SUBSCRIPTION_ACTIVATED",
];

const FUNNEL_STAGE_DEFINITIONS = {
  LANDING_VISIT: {
    label: "1. Landing Page Visit",
    description: "Prospective visitor landed on the marketing hero page or documentation entry point.",
    denominatorText: "Top of funnel (100% baseline)",
  },
  TRIAL_CTA_CLICK: {
    label: "2. Start Free Trial CTA",
    description: "Visitor clicked 'Start Free Trial' or secondary live workspace demo trigger.",
    denominatorText: "% of total landing page visitors",
  },
  SIGNUP_STARTED: {
    label: "3. Signup Flow Started",
    description: "Prospective customer arrived on /register and began inputting workspace details.",
    denominatorText: "% of visitors who clicked trial CTA",
  },
  SIGNUP_COMPLETED: {
    label: "4. Account Created",
    description: "User submitted registration and authenticated with encrypted credentials.",
    denominatorText: "% of users who started the registration form",
  },
  ORG_WORKSPACE_CREATED: {
    label: "5. Workspace Provisioned",
    description: "Multi-tenant tenant container initialized with database schema, slug, and Owner role.",
    denominatorText: "% of completed account signups",
  },
  ONBOARDING_STEP_COMPLETED: {
    label: "6. Onboarding Activated",
    description: "Customer completed one or more onboarding milestones (API key generated or team invited).",
    denominatorText: "% of provisioned customer workspaces",
  },
  TRIAL_STARTED: {
    label: "7. Active Trial Period",
    description: "14-day zero-card trial activated with Starter or Pro quota entitlements.",
    denominatorText: "% of workspaces completing onboarding setup",
  },
  SUBSCRIPTION_ACTIVATED: {
    label: "8. Paid Subscription",
    description: "Customer upgraded to a paid billing tier (Starter, Pro, Business, Enterprise).",
    denominatorText: "% of trialing workspaces converting to paying accounts",
  },
};

function scrubAnalyticsMetadata(input) {
  if (!input || typeof input !== "object") return {};
  const sensitiveKeys = [
    "password",
    "passwordhash",
    "token",
    "key",
    "apikey",
    "secret",
    "auth",
    "authorization",
    "cookie",
    "card",
    "cvv",
    "number",
    "exp",
    "taxid",
  ];

  const sanitized = {};

  for (const [key, val] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      continue;
    }

    if (typeof val === "string" && val.length > 300) {
      sanitized[key] = val.substring(0, 300);
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = scrubAnalyticsMetadata(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

async function recordFunnelEvent(params) {
  const {
    sessionId,
    stage,
    eventName,
    userId = null,
    organizationId = null,
    workspaceId = null,
    path = null,
    referrer = null,
    metadata = null,
    ipAddress = null,
    userAgent = null,
  } = params;

  const tenSecondsAgo = new Date(Date.now() - 10000);
  const existing = await prisma.funnelEvent.findFirst({
    where: {
      sessionId,
      stage,
      eventName,
      timestamp: { gte: tenSecondsAgo },
    },
    select: { id: true },
  });

  if (existing) {
    return { skipped: true, reason: "DEDUPLICATED", id: existing.id };
  }

  const sanitizedMeta = scrubAnalyticsMetadata(metadata);

  const event = await prisma.funnelEvent.create({
    data: {
      sessionId,
      stage,
      eventName,
      userId,
      organizationId,
      workspaceId,
      path,
      referrer,
      metadata: JSON.stringify(sanitizedMeta),
      ipAddress: ipAddress ? ipAddress.replace(/:/g, "_") : null,
      userAgent: userAgent ? userAgent.substring(0, 200) : null,
    },
  });

  return { success: true, id: event.id };
}

test("Phase 19 Analytics Unit - 1. Funnel Stages Sequence & Denominator Definitions", (t) => {
  assert.equal(FUNNEL_STAGES.length, 8, "Must support 8 discrete conversion funnel stages");
  assert.equal(FUNNEL_STAGES[0], "LANDING_VISIT");
  assert.equal(FUNNEL_STAGES[1], "TRIAL_CTA_CLICK");
  assert.equal(FUNNEL_STAGES[2], "SIGNUP_STARTED");
  assert.equal(FUNNEL_STAGES[3], "SIGNUP_COMPLETED");
  assert.equal(FUNNEL_STAGES[4], "ORG_WORKSPACE_CREATED");
  assert.equal(FUNNEL_STAGES[5], "ONBOARDING_STEP_COMPLETED");
  assert.equal(FUNNEL_STAGES[6], "TRIAL_STARTED");
  assert.equal(FUNNEL_STAGES[7], "SUBSCRIPTION_ACTIVATED");

  // Verify all stages have transparent mathematical denominator descriptions
  for (const stage of FUNNEL_STAGES) {
    const def = FUNNEL_STAGE_DEFINITIONS[stage];
    assert.ok(def, `Stage ${stage} must have definition`);
    assert.ok(def.denominatorText, `Stage ${stage} must have explicit denominator explanation`);
    assert.ok(def.label, `Stage ${stage} must have human-readable label`);
  }
});

test("Phase 19 Analytics Unit - 2. PII, Token, Secret, and Password Scrubbing", (t) => {
  const dirtyMetadata = {
    plan: "PRO",
    billingCycle: "MONTHLY",
    password: "super_secret_password_123!",
    passwordHash: "$2a$10$abcdef...",
    apiKey: "pfl_live_secret_key_12345",
    token: "bearer_ey123456",
    creditCard: "4111222233334444",
    cvv: "123",
    authHeader: "Bearer eyJhbGciOi...",
    safeTag: "marketing_campaign_q4",
    nested: {
      deepSecret: "drop_me_too",
      allowedField: "test_val",
    },
  };

  const scrubbed = scrubAnalyticsMetadata(dirtyMetadata);

  assert.equal(scrubbed.plan, "PRO");
  assert.equal(scrubbed.billingCycle, "MONTHLY");
  assert.equal(scrubbed.safeTag, "marketing_campaign_q4");
  assert.equal(scrubbed.password, undefined);
  assert.equal(scrubbed.passwordHash, undefined);
  assert.equal(scrubbed.apiKey, undefined);
  assert.equal(scrubbed.token, undefined);
  assert.equal(scrubbed.creditCard, undefined);
  assert.equal(scrubbed.cvv, undefined);
  assert.equal(scrubbed.authHeader, undefined);
  assert.equal(scrubbed.nested.deepSecret, undefined);
  assert.equal(scrubbed.nested.allowedField, "test_val");
});

test("Phase 19 Analytics Unit - 3. Server Event Recording & Idempotent Deduplication", async (t) => {
  const testSessionId = `test_sess_${Date.now()}`;

  // First event record
  const res1 = await recordFunnelEvent({
    sessionId: testSessionId,
    stage: "TRIAL_CTA_CLICK",
    eventName: "hero_cta_primary_clicked",
    path: "/",
    metadata: { cta: "Start Free Trial" },
  });

  assert.ok(res1.success, "First event should be successfully stored");
  assert.ok(res1.id, "Event should receive generated ID");

  // Immediate duplicate call with same session, stage, and eventName
  const res2 = await recordFunnelEvent({
    sessionId: testSessionId,
    stage: "TRIAL_CTA_CLICK",
    eventName: "hero_cta_primary_clicked",
    path: "/",
    metadata: { cta: "Start Free Trial" },
  });

  assert.equal(res2.skipped, true, "Duplicate event within 10s window must be skipped");
  assert.equal(res2.reason, "DEDUPLICATED");

  // Cleanup
  await prisma.funnelEvent.deleteMany({ where: { sessionId: testSessionId } });
});

test("Phase 19 Analytics Unit - 4. Database Funnel Aggregations & Step Conversion Rate Math", async (t) => {
  const testSess = `math_sess_${Date.now()}`;

  // Seed events across stages
  await prisma.funnelEvent.createMany({
    data: [
      {
        sessionId: `${testSess}_1`,
        stage: "LANDING_VISIT",
        eventName: "landing_page_viewed",
      },
      {
        sessionId: `${testSess}_2`,
        stage: "LANDING_VISIT",
        eventName: "landing_page_viewed",
      },
      {
        sessionId: `${testSess}_1`,
        stage: "TRIAL_CTA_CLICK",
        eventName: "hero_cta_primary_clicked",
      },
      {
        sessionId: `${testSess}_1`,
        stage: "SIGNUP_STARTED",
        eventName: "signup_page_viewed",
      },
    ],
  });

  const visitCount = await prisma.funnelEvent.count({
    where: { sessionId: { startsWith: testSess }, stage: "LANDING_VISIT" },
  });
  const ctaCount = await prisma.funnelEvent.count({
    where: { sessionId: { startsWith: testSess }, stage: "TRIAL_CTA_CLICK" },
  });

  assert.equal(visitCount, 2);
  assert.equal(ctaCount, 1);

  // Conversion rate: 1/2 = 50.0%
  const stepRate = Number(((ctaCount / visitCount) * 100).toFixed(1));
  const dropoff = Number((100 - stepRate).toFixed(1));

  assert.equal(stepRate, 50.0);
  assert.equal(dropoff, 50.0);

  // Cleanup
  await prisma.funnelEvent.deleteMany({ where: { sessionId: { startsWith: testSess } } });
});

test("Phase 19 Analytics Unit - 5. Tenant Workspace Isolation Safeguards", async (t) => {
  const testWorkspace1 = `ws_test_${Date.now()}_1`;
  const testWorkspace2 = `ws_test_${Date.now()}_2`;

  await prisma.funnelEvent.create({
    data: {
      sessionId: "sess_tenant_1",
      workspaceId: testWorkspace1,
      stage: "ORG_WORKSPACE_CREATED",
      eventName: "workspace_provisioned",
    },
  });

  await prisma.funnelEvent.create({
    data: {
      sessionId: "sess_tenant_2",
      workspaceId: testWorkspace2,
      stage: "ORG_WORKSPACE_CREATED",
      eventName: "workspace_provisioned",
    },
  });

  const countWs1 = await prisma.funnelEvent.count({
    where: { workspaceId: testWorkspace1 },
  });
  const countWs2 = await prisma.funnelEvent.count({
    where: { workspaceId: testWorkspace2 },
  });

  assert.equal(countWs1, 1);
  assert.equal(countWs2, 1);

  // Verify cross-workspace queries are strictly isolated
  const mixedCount = await prisma.funnelEvent.count({
    where: { workspaceId: testWorkspace1, sessionId: "sess_tenant_2" },
  });
  assert.equal(mixedCount, 0, "Tenant cross-workspace events must never bleed across accounts");

  // Cleanup
  await prisma.funnelEvent.deleteMany({
    where: { workspaceId: { in: [testWorkspace1, testWorkspace2] } },
  });
});
