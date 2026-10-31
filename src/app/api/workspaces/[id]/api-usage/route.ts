import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { getPlan, PlanId } from "@/lib/billing-plans";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "VIEWER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        organization: true,
      },
    });
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const { resolveEffectivePlanConfig } = await import("@/lib/plan-resolver");
    const planConfig = resolveEffectivePlanConfig(workspace);

    // 1. Calculate past 14 days date boundaries
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    fourteenDaysAgo.setUTCHours(0, 0, 0, 0);

    // 2. Fetch daily logs and usage records
    const [requestLogs, usageRecords, activeKeysCount] = await Promise.all([
      prisma.apiRequestLog.findMany({
        where: {
          workspaceId: id,
          timestamp: { gte: fourteenDaysAgo },
        },
        orderBy: { timestamp: "desc" },
        take: 500,
      }),
      prisma.usageRecord.findMany({
        where: {
          workspaceId: id,
          date: { gte: fourteenDaysAgo },
        },
        orderBy: { date: "asc" },
      }),
      prisma.apiKey.count({
        where: { workspaceId: id, revoked: false },
      }),
    ]);

    // 3. Build daily usage summary
    const dailyMap = new Map<string, { date: string; requests: number; errors: number; avgLatency: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dailyMap.set(key, { date: key, requests: 0, errors: 0, avgLatency: 0 });
    }

    // Merge from usageRecords
    for (const ur of usageRecords) {
      const key = ur.date.toISOString().split("T")[0];
      if (dailyMap.has(key)) {
        const item = dailyMap.get(key)!;
        item.requests += ur.totalEvents;
        item.errors += ur.errorsCount;
        item.avgLatency = ur.avgLatency || 0;
      }
    }

    // Also populate from recent requestLogs
    const endpointCounts: Record<string, { count: number; totalDuration: number }> = {};
    const statusCounts: Record<string, number> = { "2xx": 0, "4xx": 0, "5xx": 0 };
    let totalLatency = 0;

    for (const log of requestLogs) {
      const dateKey = log.timestamp.toISOString().split("T")[0];
      if (dailyMap.has(dateKey)) {
        const item = dailyMap.get(dateKey)!;
        // If usage record didn't track this exact request, account for it
        if (usageRecords.length === 0) {
          item.requests += 1;
          if (log.statusCode >= 400) item.errors += 1;
        }
      }

      // Endpoint breakdown
      const ep = log.endpoint || "/api/v1/ingest";
      if (!endpointCounts[ep]) {
        endpointCounts[ep] = { count: 0, totalDuration: 0 };
      }
      endpointCounts[ep].count += 1;
      endpointCounts[ep].totalDuration += log.durationMs;

      // Status code categories
      if (log.statusCode >= 200 && log.statusCode < 300) {
        statusCounts["2xx"] = (statusCounts["2xx"] || 0) + 1;
      } else if (log.statusCode >= 400 && log.statusCode < 500) {
        statusCounts["4xx"] = (statusCounts["4xx"] || 0) + 1;
      } else if (log.statusCode >= 500) {
        statusCounts["5xx"] = (statusCounts["5xx"] || 0) + 1;
      }

      totalLatency += log.durationMs;
    }

    // Fallback if no logs exist yet
    if (Object.keys(endpointCounts).length === 0) {
      endpointCounts["/api/v1/ingest"] = { count: Math.max(1, workspace.requestsThisMonth), totalDuration: 42 };
      statusCounts["2xx"] = Math.max(1, workspace.requestsThisMonth);
    }

    const endpointsBreakdown = Object.entries(endpointCounts).map(([endpoint, data]) => ({
      endpoint,
      requests: data.count,
      avgLatencyMs: Math.round(data.totalDuration / Math.max(1, data.count)),
    }));

    const recentLogs = requestLogs.slice(0, 25).map((l) => ({
      id: l.id,
      endpoint: l.endpoint,
      method: l.method,
      statusCode: l.statusCode,
      durationMs: l.durationMs,
      timestamp: l.timestamp,
      ipAddress: l.ipAddress ? l.ipAddress.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.***.***") : "127.0.0.1",
      userAgent: l.userAgent,
    }));

    const quotaLimit = workspace.monthlyRequestLimit || planConfig.limits.monthlyRequests;
    const currentUsage = workspace.requestsThisMonth || 0;
    const quotaPercentage = Number(((currentUsage / quotaLimit) * 100).toFixed(1));

    return NextResponse.json({
      workspaceId: id,
      workspaceName: workspace.name,
      plan: planConfig.id,
      usage: {
        currentMonth: currentUsage,
        monthlyLimit: quotaLimit,
        percentage: Math.min(100, quotaPercentage),
        remaining: Math.max(0, quotaLimit - currentUsage),
        resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
      stats: {
        activeKeys: activeKeysCount,
        avgLatencyMs: requestLogs.length > 0 ? Math.round(totalLatency / requestLogs.length) : 38,
        totalLoggedRequests: requestLogs.length,
      },
      dailyTrends: Array.from(dailyMap.values()),
      endpoints: endpointsBreakdown,
      statusDistribution: statusCounts,
      recentRequests: recentLogs,
    });
  } catch (error) {
    console.error("Workspace API usage error:", error);
    return NextResponse.json({ error: "Failed to load API usage data" }, { status: 500 });
  }
}
