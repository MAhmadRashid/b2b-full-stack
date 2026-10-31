import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

const STANDARD_ANALYTICS_EVENTS = [
  "landing_page_view",
  "trial_cta_clicked",
  "signup_started",
  "signup_completed",
  "organization_created",
  "workspace_created",
  "onboarding_completed",
  "trial_started",
  "subscription_activated",
  "lead_submitted",
  "demo_requested",
];

const EVENT_TO_STAGE_MAP = {
  landing_page_view: "LANDING_VISIT",
  trial_cta_clicked: "TRIAL_CTA_CLICK",
  signup_started: "SIGNUP_STARTED",
  signup_completed: "SIGNUP_COMPLETED",
  organization_created: "ORG_WORKSPACE_CREATED",
  workspace_created: "ORG_WORKSPACE_CREATED",
  onboarding_completed: "ONBOARDING_STEP_COMPLETED",
  trial_started: "TRIAL_STARTED",
  subscription_activated: "SUBSCRIPTION_ACTIVATED",
  lead_submitted: "TRIAL_CTA_CLICK",
  demo_requested: "TRIAL_CTA_CLICK",
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
    idempotencyKey = null,
    userId = null,
    organizationId = null,
    workspaceId = null,
    path = null,
    referrer = null,
    metadata = null,
    ipAddress = null,
    userAgent = null,
    isServerVerified = false,
  } = params;

  if (idempotencyKey) {
    const existingKey = await prisma.funnelEvent.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (existingKey) {
      return { skipped: true, reason: "IDEMPOTENT_KEY_EXISTS", id: existingKey.id };
    }
  }

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

  const sanitizedMeta = scrubAnalyticsMetadata({
    ...metadata,
    ...(isServerVerified ? { _serverVerified: true } : {}),
  });

  const event = await prisma.funnelEvent.create({
    data: {
      sessionId,
      stage,
      eventName,
      idempotencyKey: idempotencyKey || undefined,
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

function getUtcMidnight(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

async function aggregateDailyAnalytics(params) {
  const { date, scopeType, scopeId = null } = params;
  const startOfDay = getUtcMidnight(date);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const whereScope = {
    timestamp: { gte: startOfDay, lte: endOfDay },
  };

  if (scopeType === "ORGANIZATION" && scopeId) {
    whereScope.organizationId = scopeId;
  } else if (scopeType === "WORKSPACE" && scopeId) {
    whereScope.workspaceId = scopeId;
  }

  const [totalEvents, sessionGroups, userGroups] = await Promise.all([
    prisma.funnelEvent.count({ where: whereScope }),
    prisma.funnelEvent.groupBy({
      by: ["sessionId"],
      where: whereScope,
    }),
    prisma.funnelEvent.groupBy({
      by: ["userId"],
      where: {
        ...whereScope,
        userId: { not: null },
      },
    }),
  ]);

  const uniqueSessions = sessionGroups.length;
  const uniqueUsers = userGroups.length;

  const stageCountsMap = {};
  for (const stg of FUNNEL_STAGES) {
    const count = await prisma.funnelEvent.count({
      where: {
        ...whereScope,
        stage: stg,
      },
    });
    stageCountsMap[stg] = count;
  }

  const eventNameGroups = await prisma.funnelEvent.groupBy({
    by: ["eventName"],
    where: whereScope,
    _count: { eventName: true },
  });

  const eventCountsMap = {};
  for (const item of eventNameGroups) {
    eventCountsMap[item.eventName] = item._count.eventName;
  }

  const kpis = {
    signups: 0,
    workspaces: 0,
    activations: 0,
  };

  const record = await prisma.dailyAnalytics.upsert({
    where: {
      date_scopeType_scopeId: {
        date: startOfDay,
        scopeType,
        scopeId: scopeId || "",
      },
    },
    create: {
      date: startOfDay,
      scopeType,
      scopeId: scopeId || "",
      totalEvents,
      uniqueSessions,
      uniqueUsers,
      stageCounts: JSON.stringify(stageCountsMap),
      eventCounts: JSON.stringify(eventCountsMap),
      kpis: JSON.stringify(kpis),
    },
    update: {
      totalEvents,
      uniqueSessions,
      uniqueUsers,
      stageCounts: JSON.stringify(stageCountsMap),
      eventCounts: JSON.stringify(eventCountsMap),
      kpis: JSON.stringify(kpis),
    },
  });

  return record;
}

async function pruneOldAnalyticsEvents(retentionDays = 90) {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.funnelEvent.deleteMany({
    where: {
      timestamp: { lt: cutoffDate },
    },
  });
  return { prunedCount: result.count, cutoffDate };
}

test("Phase 19B Backend - 1. Standard Analytics Events & Auto Stage Mapping", (t) => {
  assert.equal(STANDARD_ANALYTICS_EVENTS.length, 11);
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("landing_page_view"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("trial_cta_clicked"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("signup_started"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("signup_completed"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("organization_created"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("workspace_created"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("onboarding_completed"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("trial_started"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("subscription_activated"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("lead_submitted"));
  assert.ok(STANDARD_ANALYTICS_EVENTS.includes("demo_requested"));

  // Verify all map to valid funnel stages
  for (const evt of STANDARD_ANALYTICS_EVENTS) {
    const mapped = EVENT_TO_STAGE_MAP[evt];
    assert.ok(mapped, `Event ${evt} must map to a funnel stage`);
    assert.ok(FUNNEL_STAGES.includes(mapped), `Mapped stage ${mapped} must be one of FUNNEL_STAGES`);
  }
});

test("Phase 19B Backend - 2. Idempotency Key Deduplication Safeguard", async (t) => {
  const testIdempotencyKey = `idem_key_${Date.now()}_${Math.random()}`;
  const testSession = `sess_${Date.now()}`;

  // First record with idempotency key
  const res1 = await recordFunnelEvent({
    sessionId: testSession,
    stage: "SIGNUP_COMPLETED",
    eventName: "signup_completed",
    idempotencyKey: testIdempotencyKey,
    isServerVerified: true,
  });

  assert.ok(res1.success, "First event with idempotency key must succeed");
  assert.ok(res1.id);

  // Exact same idempotency key call again
  const res2 = await recordFunnelEvent({
    sessionId: testSession,
    stage: "SIGNUP_COMPLETED",
    eventName: "signup_completed",
    idempotencyKey: testIdempotencyKey,
  });

  assert.equal(res2.skipped, true);
  assert.equal(res2.reason, "IDEMPOTENT_KEY_EXISTS");

  // Cleanup
  await prisma.funnelEvent.deleteMany({
    where: { idempotencyKey: testIdempotencyKey },
  });
});

test("Phase 19B Backend - 3. Server-Verified Event Metadata Tagging", async (t) => {
  const testSession = `sess_srv_${Date.now()}`;

  const res = await recordFunnelEvent({
    sessionId: testSession,
    stage: "SUBSCRIPTION_ACTIVATED",
    eventName: "subscription_activated",
    isServerVerified: true,
    metadata: { tier: "PRO", amount: 7900 },
  });

  assert.ok(res.success);

  const event = await prisma.funnelEvent.findUnique({
    where: { id: res.id },
  });

  assert.ok(event);
  const parsedMeta = JSON.parse(event.metadata || "{}");
  assert.equal(parsedMeta.tier, "PRO");
  assert.equal(parsedMeta.amount, 7900);
  assert.equal(parsedMeta._serverVerified, true);

  // Cleanup
  await prisma.funnelEvent.delete({ where: { id: res.id } });
});

test("Phase 19B Backend - 4. Daily Analytics Aggregation Job Idempotency", async (t) => {
  const today = new Date();
  const midnight = getUtcMidnight(today);

  // Run aggregation
  const agg1 = await aggregateDailyAnalytics({
    date: today,
    scopeType: "PLATFORM",
    scopeId: null,
  });

  assert.ok(agg1);
  assert.ok(agg1.id);
  assert.equal(agg1.scopeType, "PLATFORM");
  assert.equal(new Date(agg1.date).toISOString(), midnight.toISOString());

  // Rerun aggregation (must safely upsert/idempotently succeed without throwing duplicate key errors)
  const agg2 = await aggregateDailyAnalytics({
    date: today,
    scopeType: "PLATFORM",
    scopeId: null,
  });

  assert.equal(agg2.id, agg1.id, "Upsert should maintain identical primary key");

  // Cleanup
  await prisma.dailyAnalytics.delete({ where: { id: agg1.id } });
});

test("Phase 19B Backend - 5. Multi-Tenant Analytics Isolation across Workspaces and Organizations", async (t) => {
  const org1 = `org_test_${Date.now()}_1`;
  const org2 = `org_test_${Date.now()}_2`;
  const ws1 = `ws_test_${Date.now()}_1`;
  const ws2 = `ws_test_${Date.now()}_2`;

  await prisma.funnelEvent.createMany({
    data: [
      {
        sessionId: "tenant_sess_1",
        stage: "ORG_WORKSPACE_CREATED",
        eventName: "workspace_created",
        organizationId: org1,
        workspaceId: ws1,
      },
      {
        sessionId: "tenant_sess_2",
        stage: "ORG_WORKSPACE_CREATED",
        eventName: "workspace_created",
        organizationId: org2,
        workspaceId: ws2,
      },
    ],
  });

  const countOrg1 = await prisma.funnelEvent.count({ where: { organizationId: org1 } });
  const countOrg2 = await prisma.funnelEvent.count({ where: { organizationId: org2 } });
  const crossCount = await prisma.funnelEvent.count({
    where: { organizationId: org1, workspaceId: ws2 },
  });

  assert.equal(countOrg1, 1);
  assert.equal(countOrg2, 1);
  assert.equal(crossCount, 0, "Cross-tenant records must strictly never intersect");

  // Cleanup
  await prisma.funnelEvent.deleteMany({
    where: { organizationId: { in: [org1, org2] } },
  });
});

test("Phase 19B Backend - 6. Conversion Funnel Definitions Model and Lifecycle", async (t) => {
  const funnelName = `Test Enterprise Funnel ${Date.now()}`;
  const stages = ["LANDING_VISIT", "TRIAL_CTA_CLICK", "SIGNUP_COMPLETED", "SUBSCRIPTION_ACTIVATED"];

  const created = await prisma.conversionFunnelDefinition.create({
    data: {
      name: funnelName,
      description: "Custom conversion funnel for sales-assisted signups",
      stages: JSON.stringify(stages),
      isDefault: false,
    },
  });

  assert.ok(created.id);
  assert.equal(created.name, funnelName);
  const parsedStages = JSON.parse(created.stages);
  assert.deepEqual(parsedStages, stages);

  // Cleanup
  await prisma.conversionFunnelDefinition.delete({ where: { id: created.id } });
});

test("Phase 19B Backend - 7. Analytics Settings & Privacy Configuration", async (t) => {
  const setting = await prisma.analyticsSetting.create({
    data: {
      scopeType: "PLATFORM",
      scopeId: "",
      retentionDays: 60,
      dntRespect: true,
      ipAnonymization: true,
      captureClientEvents: true,
    },
  });

  assert.ok(setting.id);
  assert.equal(setting.retentionDays, 60);
  assert.equal(setting.dntRespect, true);

  // Cleanup
  await prisma.analyticsSetting.delete({ where: { id: setting.id } });
});

test("Phase 19B Backend - 8. Retention Pruning Policy Execution", async (t) => {
  const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000); // 120 days ago

  const oldEvt = await prisma.funnelEvent.create({
    data: {
      sessionId: "old_sess_to_prune",
      stage: "LANDING_VISIT",
      eventName: "landing_page_view",
      timestamp: oldDate,
    },
  });

  assert.ok(oldEvt.id);

  const pruneResult = await pruneOldAnalyticsEvents(90);
  assert.ok(pruneResult.prunedCount >= 1, "Should have pruned at least the old event");

  const check = await prisma.funnelEvent.findUnique({ where: { id: oldEvt.id } });
  assert.equal(check, null, "Old event must be removed by retention pruner");
});
