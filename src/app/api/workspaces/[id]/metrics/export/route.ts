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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const perm = await checkWorkspacePermission(session.id, id, "VIEWER");
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.error }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const format = (searchParams.get("format") || "json").toLowerCase();
    const eventType = searchParams.get("eventType");
    const status = searchParams.get("status");
    const rawLimit = parseInt(searchParams.get("limit") || "1000", 10);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 1000 : rawLimit), 5000);

    const whereClause: any = { workspaceId: id };
    if (eventType && eventType !== "ALL") {
      whereClause.eventType = eventType;
    }
    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    const events = await prisma.metricEvent.findMany({
      where: whereClause,
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        timestamp: true,
        eventType: true,
        source: true,
        status: true,
        statusCode: true,
        latencyMs: true,
        payload: true,
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "csv") {
      const csvHeader = [
        "ID",
        "Timestamp",
        "Event Type",
        "Source",
        "Status",
        "Status Code",
        "Latency (ms)",
        "Payload",
      ].map(escapeCsvValue).join(",");

      const csvRows = events.map((e) =>
        [
          e.id,
          e.timestamp.toISOString(),
          e.eventType,
          e.source,
          e.status,
          e.statusCode,
          e.latencyMs,
          e.payload || "",
        ].map(escapeCsvValue).join(",")
      );

      const csvContent = [csvHeader, ...csvRows].join("\r\n");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pulseflow-metrics-${id.slice(0, 8)}-${timestamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Default: JSON export
    const exportData = {
      workspaceId: id,
      exportedAt: new Date().toISOString(),
      totalEvents: events.length,
      limitApplied: limit,
      filters: { eventType: eventType || "ALL", status: status || "ALL" },
      events: events.map((e) => ({
        id: e.id,
        timestamp: e.timestamp.toISOString(),
        eventType: e.eventType,
        source: e.source,
        status: e.status,
        statusCode: e.statusCode,
        latencyMs: e.latencyMs,
        payload: safeParseJson(e.payload),
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pulseflow-metrics-${id.slice(0, 8)}-${timestamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Metrics export error:", error);
    return NextResponse.json({ error: "Failed to export telemetry data" }, { status: 500 });
  }
}

function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function safeParseJson(str: string | null): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
