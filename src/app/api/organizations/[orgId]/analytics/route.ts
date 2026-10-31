import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { FUNNEL_STAGES, FUNNEL_STAGE_DEFINITIONS } from "@/lib/funnel-analytics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    // Tenant Isolation: Verify membership in this Organization
    const perm = await checkOrganizationPermission(session.id, orgId, "VIEWER");
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.error }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";

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

    // 1. Fetch Organization Workspaces and Members
    const [
      workspaces,
      memberCount,
      subscription,
      totalEvents,
    ] = await Promise.all([
      prisma.workspace.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, plan: true, createdAt: true },
      }),
      prisma.organizationMembership.count({
        where: { organizationId: orgId },
      }),
      prisma.subscription.findUnique({
        where: { organizationId: orgId },
        select: { tier: true, status: true, billingCycle: true, currentPeriodEnd: true },
      }),
      prisma.funnelEvent.count({
        where: {
          organizationId: orgId,
          ...timestampFilter,
        },
      }),
    ]);

    const workspaceIds = workspaces.map((w) => w.id);

    // 2. Fetch Funnel Stages for this Organization
    const stageCounts = await Promise.all(
      FUNNEL_STAGES.map(async (stage) => {
        const [totalCount, uniqueSessions] = await Promise.all([
          prisma.funnelEvent.count({
            where: {
              organizationId: orgId,
              stage,
              ...timestampFilter,
            },
          }),
          prisma.funnelEvent.groupBy({
            by: ["sessionId"],
            where: {
              organizationId: orgId,
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
      stageCounts[4]?.uniqueSessions || 0, // Fallback to workspace created
      workspaces.length,
      1
    );

    let previousCount = topOfFunnelCount;
    const stagesData = FUNNEL_STAGES.map((stage, idx) => {
      const def = FUNNEL_STAGE_DEFINITIONS[stage];
      const raw = stageCounts[idx];

      let verifiedSessions = raw.uniqueSessions;
      if (stage === "ORG_WORKSPACE_CREATED" && verifiedSessions < workspaces.length) {
        verifiedSessions = workspaces.length;
      }
      if (stage === "SUBSCRIPTION_ACTIVATED" && subscription?.status === "ACTIVE" && verifiedSessions === 0) {
        verifiedSessions = 1;
      }

      const conversionRateFromTop = topOfFunnelCount > 0
        ? Number(((verifiedSessions / topOfFunnelCount) * 100).toFixed(1))
        : 0;

      const conversionRateFromPrevious = previousCount > 0
        ? Math.min(100, Number(((verifiedSessions / previousCount) * 100).toFixed(1)))
        : 0;

      const dropoffRate = Number((100 - conversionRateFromPrevious).toFixed(1));

      if (verifiedSessions > 0) {
        previousCount = verifiedSessions;
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

    // 3. Daily Activity Trend across org workspaces
    const dailyActivity: Array<{ date: string; events: number }> = [];
    const daysToShow = Math.min(daysCount, 14);
    for (let d = daysToShow - 1; d >= 0; d--) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - d);
      const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
      const dateLabel = startOfDay.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const dayEvents = await prisma.funnelEvent.count({
        where: {
          organizationId: orgId,
          timestamp: { gte: startOfDay, lte: endOfDay },
        },
      });

      dailyActivity.push({
        date: dateLabel,
        events: dayEvents,
      });
    }

    return NextResponse.json({
      range,
      organizationId: orgId,
      kpis: {
        totalWorkspaces: workspaces.length,
        totalMembers: memberCount,
        activeSubscriptionTier: subscription?.tier || "FREE",
        subscriptionStatus: subscription?.status || "INACTIVE",
        totalEventsIngested: totalEvents,
      },
      funnel: {
        stages: stagesData,
        overallConversionRate: stagesData[stagesData.length - 1]?.conversionRateFromTop || 0,
      },
      workspaces,
      trends: {
        dailyActivity,
      },
      tenant: {
        organizationId: orgId,
        isolated: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate organization analytics", details: error.message },
      { status: 500 }
    );
  }
}
