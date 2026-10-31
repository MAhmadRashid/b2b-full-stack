import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { getPlan, PlanId } from "@/lib/billing-plans";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "VIEWER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        workspaces: true,
      },
    });
    if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const planConfig = getPlan((organization.plan || "FREE") as PlanId);

    // Sum monthly requests across all workspaces
    const totalRequestsThisMonth = organization.workspaces.reduce(
      (sum, ws) => sum + (ws.requestsThisMonth || 0),
      0
    );

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    fourteenDaysAgo.setUTCHours(0, 0, 0, 0);

    const [requestLogs, activeKeysCount] = await Promise.all([
      prisma.apiRequestLog.findMany({
        where: {
          OR: [
            { organizationId: orgId },
            { workspaceId: { in: organization.workspaces.map((w) => w.id) } },
          ],
          timestamp: { gte: fourteenDaysAgo },
        },
        orderBy: { timestamp: "desc" },
        take: 500,
      }),
      prisma.apiKey.count({
        where: {
          OR: [
            { organizationId: orgId },
            { workspaceId: { in: organization.workspaces.map((w) => w.id) } },
          ],
          revoked: false,
        },
      }),
    ]);

    const dailyMap = new Map<string, { date: string; requests: number; errors: number; avgLatency: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dailyMap.set(key, { date: key, requests: 0, errors: 0, avgLatency: 0 });
    }

    const endpointCounts: Record<string, { count: number; totalDuration: number }> = {};
    const statusCounts: Record<string, number> = { "2xx": 0, "4xx": 0, "5xx": 0 };
    let totalLatency = 0;

    for (const log of requestLogs) {
      const dateKey = log.timestamp.toISOString().split("T")[0];
      if (dailyMap.has(dateKey)) {
        const item = dailyMap.get(dateKey)!;
        item.requests += 1;
        if (log.statusCode >= 400) item.errors += 1;
      }

      const ep = log.endpoint || "/api/v1/ingest";
      if (!endpointCounts[ep]) {
        endpointCounts[ep] = { count: 0, totalDuration: 0 };
      }
      endpointCounts[ep].count += 1;
      endpointCounts[ep].totalDuration += log.durationMs;

      if (log.statusCode >= 200 && log.statusCode < 300) {
        statusCounts["2xx"] = (statusCounts["2xx"] || 0) + 1;
      } else if (log.statusCode >= 400 && log.statusCode < 500) {
        statusCounts["4xx"] = (statusCounts["4xx"] || 0) + 1;
      } else if (log.statusCode >= 500) {
        statusCounts["5xx"] = (statusCounts["5xx"] || 0) + 1;
      }

      totalLatency += log.durationMs;
    }

    const endpointsBreakdown = Object.entries(endpointCounts).map(([endpoint, data]) => ({
      endpoint,
      requests: data.count,
      avgLatencyMs: Math.round(data.totalDuration / Math.max(1, data.count)),
    }));

    const quotaLimit = planConfig.limits.monthlyRequests;
    const quotaPercentage = Number(((totalRequestsThisMonth / quotaLimit) * 100).toFixed(1));

    return NextResponse.json({
      organizationId: orgId,
      organizationName: organization.name,
      plan: organization.plan || "FREE",
      usage: {
        currentMonth: totalRequestsThisMonth,
        monthlyLimit: quotaLimit,
        percentage: Math.min(100, quotaPercentage),
        remaining: Math.max(0, quotaLimit - totalRequestsThisMonth),
        resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
      stats: {
        activeKeys: activeKeysCount,
        avgLatencyMs: requestLogs.length > 0 ? Math.round(totalLatency / requestLogs.length) : 38,
        totalWorkspaces: organization.workspaces.length,
      },
      dailyTrends: Array.from(dailyMap.values()),
      endpoints: endpointsBreakdown,
      statusDistribution: statusCounts,
      recentRequests: requestLogs.slice(0, 25).map((l) => ({
        id: l.id,
        endpoint: l.endpoint,
        method: l.method,
        statusCode: l.statusCode,
        durationMs: l.durationMs,
        timestamp: l.timestamp,
        ipAddress: l.ipAddress ? l.ipAddress.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.***.***") : "127.0.0.1",
        userAgent: l.userAgent,
      })),
    });
  } catch (error) {
    console.error("Organization API usage error:", error);
    return NextResponse.json({ error: "Failed to load organization API usage" }, { status: 500 });
  }
}
