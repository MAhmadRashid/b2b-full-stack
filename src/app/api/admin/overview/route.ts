import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.systemRole !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden: Superadmin access required" }, { status: 403 });
    }

    const [userCount, workspaceCount, keyCount, eventCount, workspaces, recentAudits] =
      await Promise.all([
        prisma.user.count(),
        prisma.workspace.count(),
        prisma.apiKey.count({ where: { revoked: false } }),
        prisma.metricEvent.count(),
        prisma.workspace.findMany({
          include: {
            _count: {
              select: { members: true, apiKeys: true, events: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
      ]);

    return NextResponse.json({
      stats: {
        totalUsers: userCount,
        totalWorkspaces: workspaceCount,
        activeApiKeys: keyCount,
        totalEventsIngested: eventCount,
      },
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        plan: w.plan,
        subscriptionStatus: w.subscriptionStatus,
        requestsThisMonth: w.requestsThisMonth,
        monthlyLimit: w.monthlyRequestLimit,
        membersCount: w._count.members,
        keysCount: w._count.apiKeys,
        eventsCount: w._count.events,
        createdAt: w.createdAt,
      })),
      recentAudits,
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
