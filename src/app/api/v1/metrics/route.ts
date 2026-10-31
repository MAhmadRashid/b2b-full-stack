import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, logApiRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const auth = await authenticateApiKey(req, { requiredScope: "metrics:read" });

  if (!auth.success || !auth.context) {
    return NextResponse.json(
      { error: auth.error, message: auth.message, expiredAt: auth.expiredAt },
      { status: auth.status, headers: auth.rateLimitHeaders }
    );
  }

  try {
    const wsId = auth.context.workspaceId;
    const orgId = auth.context.organizationId;

    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get("limit") || "50", 10)));
    const eventType = url.searchParams.get("eventType");

    const where: any = {};
    if (wsId) {
      where.workspaceId = wsId;
    }
    if (eventType) {
      where.eventType = eventType;
    }

    const [events, totalEventsCount, errorsCount] = await Promise.all([
      prisma.metricEvent.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        select: {
          id: true,
          eventType: true,
          source: true,
          status: true,
          statusCode: true,
          latencyMs: true,
          timestamp: true,
        },
      }),
      prisma.metricEvent.count({ where }),
      prisma.metricEvent.count({ where: { ...where, status: "ERROR" } }),
    ]);

    const latencies = events.map((e) => e.latencyMs).sort((a, b) => a - b);
    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    const durationMs = Date.now() - startTime;
    await logApiRequest({
      apiKeyId: auth.context.id,
      organizationId: auth.context.organizationId,
      workspaceId: auth.context.workspaceId,
      endpoint: "/api/v1/metrics",
      method: "GET",
      statusCode: 200,
      durationMs,
      req,
    });

    return NextResponse.json(
      {
        metrics: {
          totalEvents: totalEventsCount,
          errorEvents: errorsCount,
          errorRate: totalEventsCount > 0 ? Number(((errorsCount / totalEventsCount) * 100).toFixed(2)) : 0,
          latency: {
            p50Ms: p50,
            p95Ms: p95,
            p99Ms: p99,
            avgMs: avgLatency,
          },
        },
        sampleEvents: events,
      },
      { headers: auth.rateLimitHeaders }
    );
  } catch (error) {
    console.error("API v1 metrics error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to query telemetry metrics" },
      { status: 500 }
    );
  }
}
