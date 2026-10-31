import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { FUNNEL_STAGES, FunnelStage } from "@/lib/funnel-analytics";

export interface AggregationParams {
  date: Date;
  scopeType: "PLATFORM" | "ORGANIZATION" | "WORKSPACE";
  scopeId?: string | null;
}

/**
 * Normalizes any date to 00:00:00.000 UTC
 */
export function getUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Calculates and idempotently persists DailyAnalytics aggregation record for a given day and scope.
 */
export async function aggregateDailyAnalytics(params: AggregationParams) {
  const { date, scopeType, scopeId = null } = params;
  const startOfDay = getUtcMidnight(date);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Build Prisma filter for the target scope
  const whereScope: any = {
    timestamp: { gte: startOfDay, lte: endOfDay },
  };

  if (scopeType === "ORGANIZATION" && scopeId) {
    whereScope.organizationId = scopeId;
  } else if (scopeType === "WORKSPACE" && scopeId) {
    whereScope.workspaceId = scopeId;
  }

  // 1. Fetch raw events count and distinct sessions
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

  // 2. Fetch stage breakdown
  const stageCountsMap: Record<string, number> = {};
  for (const stg of FUNNEL_STAGES) {
    const count = await prisma.funnelEvent.count({
      where: {
        ...whereScope,
        stage: stg,
      },
    });
    stageCountsMap[stg] = count;
  }

  // 3. Fetch top event names counts
  const eventNameGroups = await prisma.funnelEvent.groupBy({
    by: ["eventName"],
    where: whereScope,
    _count: { eventName: true },
  });

  const eventCountsMap: Record<string, number> = {};
  for (const item of eventNameGroups) {
    eventCountsMap[item.eventName] = item._count.eventName;
  }

  // 4. Calculate Verified DB KPIs for this scope and date
  const dateRangeFilter = { gte: startOfDay, lte: endOfDay };
  let newSignups = 0;
  let newWorkspaces = 0;
  let newActivations = 0;

  if (scopeType === "PLATFORM") {
    const [signups, wsCount, subs] = await Promise.all([
      prisma.user.count({ where: { createdAt: dateRangeFilter } }),
      prisma.workspace.count({ where: { createdAt: dateRangeFilter } }),
      prisma.subscription.count({
        where: {
          status: "ACTIVE",
          tier: { not: "FREE" },
          updatedAt: dateRangeFilter,
        },
      }),
    ]);
    newSignups = signups;
    newWorkspaces = wsCount;
    newActivations = subs;
  } else if (scopeType === "ORGANIZATION" && scopeId) {
    const [wsCount, subs] = await Promise.all([
      prisma.workspace.count({
        where: { organizationId: scopeId, createdAt: dateRangeFilter },
      }),
      prisma.subscription.count({
        where: {
          organizationId: scopeId,
          status: "ACTIVE",
          tier: { not: "FREE" },
          updatedAt: dateRangeFilter,
        },
      }),
    ]);
    newWorkspaces = wsCount;
    newActivations = subs;
  } else if (scopeType === "WORKSPACE" && scopeId) {
    const subs = await prisma.subscription.count({
      where: {
        workspaceId: scopeId,
        status: "ACTIVE",
        tier: { not: "FREE" },
        updatedAt: dateRangeFilter,
      },
    });
    newActivations = subs;
  }

  const kpis = {
    signups: newSignups,
    workspaces: newWorkspaces,
    activations: newActivations,
  };

  // Upsert into DailyAnalytics (safe and idempotent to retry anytime)
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

/**
 * Prunes raw analytics events older than the specified retention days.
 */
export async function pruneOldAnalyticsEvents(retentionDays = 90) {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.funnelEvent.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });
    return { prunedCount: result.count, cutoffDate };
  } catch (error) {
    logger.error("Failed to prune old analytics events", error, { context: "ANALYTICS" });
    throw error;
  }
}
