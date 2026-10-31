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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const stage = searchParams.get("stage") || undefined;
    const eventName = searchParams.get("eventName") || undefined;
    const range = searchParams.get("range") || "30d";

    let startDate: Date | null = null;
    if (range === "7d") startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    else if (range === "30d") startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    else if (range === "90d") startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const where: any = {
      workspaceId: id,
      ...(startDate ? { timestamp: { gte: startDate } } : {}),
      ...(stage ? { stage } : {}),
      ...(eventName ? { eventName } : {}),
    };

    const [events, total] = await Promise.all([
      prisma.funnelEvent.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.funnelEvent.count({ where }),
    ]);

    const sanitizedEvents = events.map((ev) => ({
      id: ev.id,
      sessionId: ev.sessionId,
      stage: ev.stage,
      eventName: ev.eventName,
      path: ev.path,
      referrer: ev.referrer,
      metadata: ev.metadata ? JSON.parse(ev.metadata) : null,
      timestamp: ev.timestamp,
    }));

    return NextResponse.json({
      events: sanitizedEvents,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      tenant: {
        workspaceId: id,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to query analytics events", details: error.message }, { status: 500 });
  }
}
