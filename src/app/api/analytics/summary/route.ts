import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FUNNEL_STAGES, FUNNEL_STAGE_DEFINITIONS } from "@/lib/funnel-analytics";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";

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

    // Get all workspaces user is a member of
    const memberships = await prisma.membership.findMany({
      where: { userId: session.id },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    // Get all organizations user is a member of
    const orgMemberships = await prisma.organizationMembership.findMany({
      where: { userId: session.id },
      select: { organizationId: true },
    });
    const orgIds = orgMemberships.map((m) => m.organizationId);

    const isSuperAdmin = session.systemRole === "SUPERADMIN";

    // Build tenant-filtered or system-wide query filter
    const tenantFilter: any = isSuperAdmin
      ? {}
      : {
          OR: [
            { workspaceId: { in: workspaceIds } },
            { organizationId: { in: orgIds } },
            { userId: session.id },
          ],
        };

    const [totalEvents, uniqueSessionsCount] = await Promise.all([
      prisma.funnelEvent.count({
        where: {
          ...tenantFilter,
          ...timestampFilter,
        },
      }),
      prisma.funnelEvent.groupBy({
        by: ["sessionId"],
        where: {
          ...tenantFilter,
          ...timestampFilter,
        },
      }).then((r) => r.length),
    ]);

    // Stage breakdown for authorized tenant scope
    const stageBreakdown = await Promise.all(
      FUNNEL_STAGES.map(async (stage) => {
        const count = await prisma.funnelEvent.count({
          where: {
            stage,
            ...tenantFilter,
            ...timestampFilter,
          },
        });
        return { stage, count };
      })
    );

    const stageMap: Record<string, number> = {};
    stageBreakdown.forEach((s) => {
      stageMap[s.stage] = s.count;
    });

    return NextResponse.json({
      range,
      userScope: {
        userId: session.id,
        isSuperAdmin,
        accessibleWorkspacesCount: workspaceIds.length,
        accessibleOrgsCount: orgIds.length,
      },
      summary: {
        totalEvents,
        uniqueSessions: uniqueSessionsCount,
        stageBreakdown: stageMap,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to generate analytics summary", details: error.message }, { status: 500 });
  }
}
