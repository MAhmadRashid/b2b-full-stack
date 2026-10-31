import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { FUNNEL_STAGES, FUNNEL_STAGE_DEFINITIONS, FunnelStage } from "@/lib/funnel-analytics";
import { aggregateDailyAnalytics } from "@/lib/analytics-aggregation";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d"; // 7d, 30d, 90d, all

    // Date range filter
    const now = new Date();
    let startDate: Date | null = null;
    let daysCount = 30;
    if (range === "7d") {
      daysCount = 7;
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      daysCount = 30;
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === "90d") {
      daysCount = 90;
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    } else if (range === "all") {
      daysCount = 365;
    }

    const timestampFilter = startDate ? { timestamp: { gte: startDate } } : {};
    const dateFilter = startDate ? { createdAt: { gte: startDate } } : {};

    // 1. Fetch Verified System Totals
    const [
      totalUsers,
      totalOrgs,
      totalWorkspaces,
      activeSubs,
      totalEvents,
      totalLeads,
      totalDemos,
    ] = await Promise.all([
      prisma.user.count({ where: dateFilter }),
      prisma.organization.count({ where: dateFilter }),
      prisma.workspace.count({ where: dateFilter }),
      prisma.subscription.count({
        where: {
          status: "ACTIVE",
          tier: { not: "FREE" },
          ...(startDate ? { updatedAt: { gte: startDate } } : {}),
        },
      }),
      prisma.funnelEvent.count({ where: timestampFilter }),
      prisma.leadSubmission.count({ where: dateFilter }),
      prisma.demoBookingRequest.count({ where: dateFilter }),
    ]);

    // 2. Fetch Multi-Stage Conversion Funnel Calculations
    const stageCounts = await Promise.all(
      FUNNEL_STAGES.map(async (stage) => {
        const [totalCount, uniqueSessions] = await Promise.all([
          prisma.funnelEvent.count({
            where: {
              stage,
              ...timestampFilter,
            },
          }),
          prisma.funnelEvent.groupBy({
            by: ["sessionId"],
            where: {
              stage,
              ...timestampFilter,
            },
          }).then((r) => r.length),
        ]);
        return { stage, totalCount, uniqueSessions };
      })
    );

    const topOfFunnelCount = Math.max(
      stageCounts[0]?.uniqueSessions || 0,
      stageCounts[1]?.uniqueSessions || 0,
      1
    );

    let previousStageCount = topOfFunnelCount;
    const funnelStagesData = FUNNEL_STAGES.map((stage, idx) => {
      const def = FUNNEL_STAGE_DEFINITIONS[stage];
      const raw = stageCounts[idx];

      let verifiedSessions = raw.uniqueSessions;
      if (stage === "SIGNUP_COMPLETED" && verifiedSessions < totalUsers) {
        verifiedSessions = totalUsers;
      }
      if (stage === "ORG_WORKSPACE_CREATED" && verifiedSessions < totalWorkspaces) {
        verifiedSessions = totalWorkspaces;
      }
      if (stage === "SUBSCRIPTION_ACTIVATED" && verifiedSessions < activeSubs) {
        verifiedSessions = activeSubs;
      }

      const conversionRateFromTop = topOfFunnelCount > 0
        ? Number(((verifiedSessions / topOfFunnelCount) * 100).toFixed(1))
        : 0;

      const conversionRateFromPrevious = previousStageCount > 0
        ? Math.min(100, Number(((verifiedSessions / previousStageCount) * 100).toFixed(1)))
        : 0;

      const dropoffRate = Number((100 - conversionRateFromPrevious).toFixed(1));

      if (verifiedSessions > 0) {
        previousStageCount = verifiedSessions;
      }

      return {
        stage,
        label: def.label,
        description: def.description,
        denominatorText: def.denominatorText,
        totalEvents: Math.max(raw.totalCount, verifiedSessions),
        uniqueSessions: verifiedSessions,
        conversionRateFromPrevious,
        dropoffRate: dropoffRate >= 0 ? dropoffRate : 0,
        conversionRateFromTop: Math.min(100, conversionRateFromTop),
      };
    });

    // 3. Daily Time-Series Data (using DailyAnalytics or falling back to live window)
    const dailyTrend: Array<{ date: string; signups: number; workspaces: number; events: number }> = [];
    const daysToShow = Math.min(daysCount, 30);
    for (let d = daysToShow - 1; d >= 0; d--) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - d);
      const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
      const dateLabel = startOfDay.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const [dayUsers, dayWorkspaces, dayEvents] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
        prisma.workspace.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
        prisma.funnelEvent.count({ where: { timestamp: { gte: startOfDay, lte: endOfDay } } }),
      ]);

      dailyTrend.push({
        date: dateLabel,
        signups: dayUsers,
        workspaces: dayWorkspaces,
        events: dayEvents,
      });
    }

    return NextResponse.json({
      range,
      kpis: {
        totalUsers,
        totalOrganizations: totalOrgs,
        totalWorkspaces,
        activeSubscriptions: activeSubs,
        totalEventsIngested: totalEvents,
        totalLeads,
        totalDemos,
        overallConversionRate: funnelStagesData[funnelStagesData.length - 1]?.conversionRateFromTop || 0,
      },
      funnel: {
        stages: funnelStagesData,
        overallConversionRate: funnelStagesData[funnelStagesData.length - 1]?.conversionRateFromTop || 0,
      },
      trends: {
        dailyActivity: dailyTrend,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate platform analytics", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Trigger manual daily aggregation job (Superadmin only)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date ? new Date(body.date) : new Date();

    const record = await aggregateDailyAnalytics({
      date: targetDate,
      scopeType: "PLATFORM",
      scopeId: null,
    });

    return NextResponse.json({
      success: true,
      message: "Daily analytics aggregation completed successfully",
      record,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Daily aggregation job failed", details: error.message },
      { status: 500 }
    );
  }
}
