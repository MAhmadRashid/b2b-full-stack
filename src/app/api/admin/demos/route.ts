import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { logger } from "@/lib/logger";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
    const status = searchParams.get("status");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [demos, totalCount, pendingCount] = await Promise.all([
      prisma.demoBookingRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.demoBookingRequest.count({ where }),
      prisma.demoBookingRequest.count({ where: { status: "PENDING_REVIEW" } }),
    ]);

    return NextResponse.json({
      success: true,
      totalCount,
      pendingCount,
      demos,
    });
  } catch (error: any) {
    logger.error("Admin get demos error", error, { context: "CRM_DEMOS" });
    return NextResponse.json({ error: "Failed to retrieve demo requests" }, { status: 500 });
  }
}

// PATCH /api/admin/demos - Update demo request status (CONFIRMED/SCHEDULED, COMPLETED, CANCELLED)
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await req.json().catch(() => ({}));
    const { id, status, notes } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "A valid demo booking request ID is required" }, { status: 400 });
    }

    const validStatuses = ["PENDING_REVIEW", "SCHEDULED", "COMPLETED", "CANCELLED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.demoBookingRequest.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      action: "DEMO_REQUEST_UPDATED",
      details: `Demo request #${id} (${updated.company}) updated: status=${updated.status}`,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({
      success: true,
      message: "Demo request updated successfully",
      demo: updated,
    });
  } catch (error: any) {
    logger.error("Admin patch demo request error", error, { context: "CRM_DEMOS" });
    return NextResponse.json({ error: "Failed to update demo request" }, { status: 500 });
  }
}
