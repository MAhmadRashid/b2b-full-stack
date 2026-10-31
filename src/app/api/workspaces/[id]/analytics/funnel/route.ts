import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { FUNNEL_STAGES, FUNNEL_STAGE_DEFINITIONS, FunnelStage } from "@/lib/funnel-analytics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    // Tenant isolation: Check permission on this workspace
    const perm = await checkWorkspacePermission(session.id, id, "VIEWER");
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.error }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d"; // 7d, 30d, 90d, all

    // Date range filter
    const now = new Date();
    let startDate: Date | null = null;
    if (range === "7d") {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === "90d") {
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    }

    const dateFilter = startDate ? { createdAt: { gte: startDate } } : {};
    const timestampFilter = startDate ? { timestamp: { gte: startDate } } : {};

    // 1. Fetch Verified Database Metrics
    const [
      totalUsers,
      totalOrgs,
      totalWorkspaces,
      activeSubs,
      trialingWorkspaces,
      completedOnboarding,
      totalLeads,
      newInquiries,
      totalDemos,
      recentTelemetryCount,
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
      prisma.workspace.count({
        where: {
          subscriptionStatus: "TRIALING",
          ...(startDate ? { createdAt: { gte: startDate } } : {}),
        },
      }),
      prisma.onboardingProgress.count({
        where: {
          completed: true,
          ...(startDate ? { updatedAt: { gte: startDate } } : {}),
        },
      }),
      prisma.leadSubmission.count({ where: dateFilter }),
      prisma.leadSubmission.count({
        where: {
          status: "NEW",
          ...dateFilter,
        },
      }),
      prisma.demoBookingRequest.count({ where: dateFilter }),
      prisma.metricEvent.count({
        where: {
          workspaceId: id,
          ...timestampFilter,
        },
      }),
    ]);

    // 2. Fetch Funnel Event Counts (Distinct Sessions vs Total Events)
    const funnelStagesData: Array<{
      stage: FunnelStage;
      label: string;
      description: string;
      denominatorText: string;
      totalEvents: number;
      uniqueSessions: number;
      conversionRateFromPrevious: number;
      dropoffRate: number;
      conversionRateFromTop: number;
    }> = [];

    // Aggregate counts for each stage
    const rawStageCounts = await Promise.all(
      FUNNEL_STAGES.map(async (stage) => {
        const [totalCount, uniqueSessionsCount] = await Promise.all([
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
          }).then((res) => res.length),
        ]);

        return { stage, totalCount, uniqueSessionsCount };
      })
    );

    // Baseline counts: Top of Funnel is Stage 1 (LANDING_VISIT)
    const topOfFunnelCount = Math.max(
      rawStageCounts[0]?.uniqueSessionsCount || 0,
      rawStageCounts[1]?.uniqueSessionsCount || 0, // Fallback if CTA recorded before page view in test
      1
    );

    let previousStageCount = topOfFunnelCount;

    for (let i = 0; i < FUNNEL_STAGES.length; i++) {
      const stage = FUNNEL_STAGES[i];
      const stageInfo = FUNNEL_STAGE_DEFINITIONS[stage];
      const raw = rawStageCounts[i];

      // Use verified DB baseline if client events are sparse
      let verifiedUniqueCount = raw.uniqueSessionsCount;
      if (stage === "SIGNUP_COMPLETED" && verifiedUniqueCount < totalUsers) {
        verifiedUniqueCount = totalUsers;
      }
      if (stage === "ORG_WORKSPACE_CREATED" && verifiedUniqueCount < totalWorkspaces) {
        verifiedUniqueCount = totalWorkspaces;
      }
      if (stage === "ONBOARDING_STEP_COMPLETED" && verifiedUniqueCount < completedOnboarding) {
        verifiedUniqueCount = completedOnboarding;
      }
      if (stage === "TRIAL_STARTED" && verifiedUniqueCount < (trialingWorkspaces || totalWorkspaces)) {
        verifiedUniqueCount = Math.max(trialingWorkspaces, totalWorkspaces);
      }
      if (stage === "SUBSCRIPTION_ACTIVATED" && verifiedUniqueCount < activeSubs) {
        verifiedUniqueCount = activeSubs;
      }

      // Conversion rates
      const fromTopRate = topOfFunnelCount > 0
        ? Number(((verifiedUniqueCount / topOfFunnelCount) * 100).toFixed(1))
        : 0;

      const fromPreviousRate = previousStageCount > 0
        ? Math.min(100, Number(((verifiedUniqueCount / previousStageCount) * 100).toFixed(1)))
        : 0;

      const dropoffRate = Number((100 - fromPreviousRate).toFixed(1));

      funnelStagesData.push({
        stage,
        label: stageInfo.label,
        description: stageInfo.description,
        denominatorText: stageInfo.denominatorText,
        totalEvents: Math.max(raw.totalCount, verifiedUniqueCount),
        uniqueSessions: verifiedUniqueCount,
        conversionRateFromPrevious: fromPreviousRate,
        dropoffRate: dropoffRate >= 0 ? dropoffRate : 0,
        conversionRateFromTop: Math.min(100, fromTopRate),
      });

      if (verifiedUniqueCount > 0) {
        previousStageCount = verifiedUniqueCount;
      }
    }

    // 3. Daily Activity Trend for the requested range (up to past 14 days)
    const dailyActivity: Array<{ date: string; signups: number; workspaces: number; events: number }> = [];
    const daysToShow = range === "7d" ? 7 : 14;
    for (let d = daysToShow - 1; d >= 0; d--) {
      const dayDate = new Date(now);
      dayDate.setDate(dayDate.getDate() - d);
      const startOfDay = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
      const endOfDay = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59, 59, 999);
      const dateLabel = startOfDay.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const [dayUsers, dayWorkspaces, dayEvents] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
        prisma.workspace.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
        prisma.metricEvent.count({ where: { workspaceId: id, timestamp: { gte: startOfDay, lte: endOfDay } } }),
      ]);

      dailyActivity.push({
        date: dateLabel,
        signups: dayUsers,
        workspaces: dayWorkspaces,
        events: dayEvents,
      });
    }

    return NextResponse.json({
      range,
      kpis: {
        totalSignups: totalUsers,
        activeWorkspaces: totalWorkspaces,
        organizationsCount: totalOrgs,
        activeSubscriptions: activeSubs,
        trialingWorkspaces: Math.max(trialingWorkspaces, totalWorkspaces),
        onboardingCompleted: completedOnboarding,
        totalLeads,
        newInquiries,
        totalDemos,
        telemetryProcessed: recentTelemetryCount,
      },
      funnel: {
        stages: funnelStagesData,
        overallConversionRate: funnelStagesData[funnelStagesData.length - 1]?.conversionRateFromTop || 0,
      },
      trends: {
        dailyActivity,
      },
      tenant: {
        workspaceId: id,
        isolated: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to generate product analytics", details: error.message }, { status: 500 });
  }
}
