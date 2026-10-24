import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";

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
      select: {
        id: true,
        name: true,
        plan: true,
        monthlyRequestLimit: true,
        requestsThisMonth: true,
      },
    });

    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    // 1. Fetch recent events for latency percentiles and distribution
    const recentEvents = await prisma.metricEvent.findMany({
      where: { workspaceId: id },
      orderBy: { timestamp: "desc" },
      take: 500,
    });

    const totalSampled = recentEvents.length;
    let totalLatency = 0;
    let errorsCount = 0;
    const latencies: number[] = [];
    const statusBreakdown = { "2xx": 0, "4xx": 0, "5xx": 0 };
    const sourceBreakdown: Record<string, number> = {};
    const latencyBuckets = { "<50ms": 0, "50-100ms": 0, "100-250ms": 0, "250ms+": 0 };

    recentEvents.forEach((ev) => {
      totalLatency += ev.latencyMs;
      latencies.push(ev.latencyMs);

      if (ev.statusCode < 400) statusBreakdown["2xx"]++;
      else if (ev.statusCode < 500) {
        statusBreakdown["4xx"]++;
        errorsCount++;
      } else {
        statusBreakdown["5xx"]++;
        errorsCount++;
      }

      sourceBreakdown[ev.source] = (sourceBreakdown[ev.source] || 0) + 1;

      if (ev.latencyMs < 50) latencyBuckets["<50ms"]++;
      else if (ev.latencyMs <= 100) latencyBuckets["50-100ms"]++;
      else if (ev.latencyMs <= 250) latencyBuckets["100-250ms"]++;
      else latencyBuckets["250ms+"]++;
    });

    // Calculate percentiles
    latencies.sort((a, b) => a - b);
    const p50 = totalSampled > 0 ? latencies[Math.floor(totalSampled * 0.5)] : 0;
    const p95 = totalSampled > 0 ? latencies[Math.floor(totalSampled * 0.95)] : 0;
    const p99 = totalSampled > 0 ? latencies[Math.floor(totalSampled * 0.99)] : 0;
    const avgLatency = totalSampled > 0 ? Math.round(totalLatency / totalSampled) : 0;
    const successRate = totalSampled > 0 ? Number((((totalSampled - errorsCount) / totalSampled) * 100).toFixed(1)) : 100;

    // 2. Daily aggregate usage records
    const usageRecords = await prisma.usageRecord.findMany({
      where: { workspaceId: id },
      orderBy: { date: "asc" },
      take: 14,
    });

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        requestsThisMonth: workspace.requestsThisMonth,
        monthlyRequestLimit: workspace.monthlyRequestLimit,
        quotaUsedPercent: Number(
          ((workspace.requestsThisMonth / workspace.monthlyRequestLimit) * 100).toFixed(1)
        ),
      },
      kpis: {
        successRate,
        avgLatencyMs: avgLatency,
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        p99LatencyMs: p99,
        sampleCount: totalSampled,
      },
      summary: {
        totalRequests: totalSampled,
        avgLatency,
        p50,
        p95,
        p99,
        successRate,
        errorRate: totalSampled > 0 ? Number(((errorsCount / totalSampled) * 100).toFixed(1)) : 0,
      },
      statusDistribution: statusBreakdown,
      statusBreakdown,
      latencyDistribution: latencyBuckets,
      latencyBuckets: Object.entries(latencyBuckets).map(([bucket, count]) => ({ bucket, count })),
      topSources: Object.entries(sourceBreakdown).map(([source, count]) => ({
        source,
        count,
        percent: totalSampled > 0 ? Number(((count / totalSampled) * 100).toFixed(1)) : 0,
      })),
      sourceDistribution: Object.entries(sourceBreakdown).map(([source, count]) => ({
        source,
        count,
        percent: totalSampled > 0 ? Number(((count / totalSampled) * 100).toFixed(1)) : 0,
      })),
      dailyUsage: usageRecords.map((r) => ({
        date: r.date.toISOString().split("T")[0],
        totalEvents: r.totalEvents,
        errorsCount: r.errorsCount,
        avgLatency: r.avgLatency,
      })),
    });
  } catch (error) {
    console.error("Get analytics overview error:", error);
    return NextResponse.json({ error: "Failed to generate analytics overview" }, { status: 500 });
  }
}
