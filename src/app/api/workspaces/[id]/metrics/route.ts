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

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "7d";

    let durationMs = 7 * 24 * 60 * 60 * 1000;
    if (range === "24h") durationMs = 24 * 60 * 60 * 1000;
    if (range === "30d") durationMs = 30 * 24 * 60 * 60 * 1000;

    const sinceDate = new Date(Date.now() - durationMs);

    // Fetch workspace stats
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

    // Fetch events in range (bounded to prevent memory exhaustion)
    const events = await prisma.metricEvent.findMany({
      where: {
        workspaceId: id,
        timestamp: { gte: sinceDate },
      },
      orderBy: { timestamp: "desc" },
      take: 2500,
    });

    const totalEvents = events.length;
    let totalLatency = 0;
    let errorCount = 0;
    const statusCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};

    events.forEach((e) => {
      totalLatency += e.latencyMs;
      if (e.statusCode >= 400) errorCount++;
      statusCounts[e.statusCode] = (statusCounts[e.statusCode] || 0) + 1;
      sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
    });

    const avgLatency = totalEvents > 0 ? Math.round(totalLatency / totalEvents) : 0;
    const errorRate = totalEvents > 0 ? Number(((errorCount / totalEvents) * 100).toFixed(1)) : 0;
    const successRate = totalEvents > 0 ? Number((100 - errorRate).toFixed(1)) : 100;

    // Time-series bucketing
    const bucketCount = range === "24h" ? 12 : 7;
    const bucketDurationMs = durationMs / bucketCount;
    const timeSeries = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketStart = new Date(Date.now() - (i + 1) * bucketDurationMs);
      const bucketEnd = new Date(Date.now() - i * bucketDurationMs);

      const bucketEvents = events.filter(
        (e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd
      );
      const bucketErrors = bucketEvents.filter((e) => e.statusCode >= 400).length;

      const label =
        range === "24h"
          ? bucketEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : bucketEnd.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });

      timeSeries.push({
        label,
        timestamp: bucketEnd.toISOString(),
        total: bucketEvents.length,
        successful: bucketEvents.length - bucketErrors,
        errors: bucketErrors,
        avgLatency:
          bucketEvents.length > 0
            ? Math.round(bucketEvents.reduce((acc, curr) => acc + curr.latencyMs, 0) / bucketEvents.length)
            : 0,
      });
    }

    // Top recent events
    const recentEvents = events.slice(0, 25).map((e) => ({
      id: e.id,
      eventType: e.eventType,
      source: e.source,
      status: e.status,
      statusCode: e.statusCode,
      latencyMs: e.latencyMs,
      timestamp: e.timestamp,
      payload: e.payload ? JSON.parse(e.payload) : null,
    }));

    return NextResponse.json({
      workspace,
      range,
      overview: {
        totalEvents,
        avgLatency,
        errorRate,
        successRate,
        requestsThisMonth: workspace.requestsThisMonth,
        monthlyLimit: workspace.monthlyRequestLimit,
        usagePercentage: Number(
          ((workspace.requestsThisMonth / workspace.monthlyRequestLimit) * 100).toFixed(1)
        ),
      },
      timeSeries,
      statusDistribution: Object.entries(statusCounts).map(([code, count]) => ({
        code: parseInt(code),
        count,
        percentage: Number(((count / totalEvents) * 100).toFixed(1)),
      })),
      sourceDistribution: Object.entries(sourceCounts).map(([source, count]) => ({
        source,
        count,
      })),
      recentEvents,
    });
  } catch (error) {
    console.error("Fetch metrics error:", error);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "MEMBER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const eventType = body.eventType || "telemetry_ping";
    const source = body.source || "dashboard_quick_ping";
    const latencyMs = Math.floor(Math.random() * 45) + 15;

    const [event] = await prisma.$transaction([
      prisma.metricEvent.create({
        data: {
          workspaceId: id,
          eventType,
          source,
          status: "SUCCESS",
          statusCode: 200,
          latencyMs,
          payload: JSON.stringify(body.payload || { user: session.email, origin: "dashboard" }),
        },
      }),
      prisma.workspace.update({
        where: { id },
        data: { requestsThisMonth: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    console.error("Create metric event error:", error);
    return NextResponse.json({ error: "Failed to emit metric event" }, { status: 500 });
  }
}
