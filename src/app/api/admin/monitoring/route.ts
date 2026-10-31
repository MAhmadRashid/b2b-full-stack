import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculatePercentiles, getSlowRequests } from "@/lib/performance-monitor";
import { validateEnvironment } from "@/lib/env-check";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required." },
        { status: 401 }
      );
    }

    if (session.systemRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Superadmin / SRE privileges required." },
        { status: 403 }
      );
    }

    // 1. Process & Memory Metrics
    const memoryUsage = process.memoryUsage();
    const memory = {
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
      externalMb: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
    };

    // 2. Database Health & Inventory Counts
    const dbStart = Date.now();
    const [userCount, orgCount, wsCount, keyCount, logCount, auditCount] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.workspace.count(),
      prisma.apiKey.count({ where: { revoked: false } }),
      prisma.apiRequestLog.count(),
      prisma.auditLog.count(),
    ]);
    const dbLatencyMs = Date.now() - dbStart;

    // 3. Performance & Latency Telemetry
    const percentiles = calculatePercentiles();
    const slowRequests = getSlowRequests();
    const recentErrors = logger.getRecentErrors();
    const envCheck = validateEnvironment();

    const durationMs = Date.now() - startTime;
    logger.info("Admin SRE monitoring report generated", {
      context: "SRE_MONITORING",
      durationMs,
      data: { adminEmail: session.email, dbLatencyMs },
    });

    return NextResponse.json({
      status: "HEALTHY",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || "development",
        memory,
      },
      database: {
        status: "CONNECTED",
        latencyMs: dbLatencyMs,
        type: envCheck.features.database.type,
        inventory: {
          users: userCount,
          organizations: orgCount,
          workspaces: wsCount,
          activeApiKeys: keyCount,
          totalApiRequestLogs: logCount,
          totalAuditLogs: auditCount,
        },
      },
      performance: {
        percentiles,
        slowRequestsCount: slowRequests.length,
        recentSlowRequests: slowRequests.slice(0, 5),
      },
      reliability: {
        recentErrorsCount: recentErrors.length,
        recentErrors: recentErrors.slice(0, 5),
        alerts: {
          databaseDegraded: dbLatencyMs > 50,
          slowRequestsSpike: slowRequests.length > 10,
          memoryPressure: memory.heapUsedMb > 500,
        },
      },
    });
  } catch (error) {
    logger.error("Admin SRE monitoring endpoint failure", error, { context: "SRE_MONITORING" });
    return NextResponse.json(
      { error: "Internal Server Error in SRE monitoring endpoint" },
      { status: 500 }
    );
  }
}
