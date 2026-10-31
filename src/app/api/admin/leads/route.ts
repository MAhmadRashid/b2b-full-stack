import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 15, 1), 100);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "ALL";
    const priority = searchParams.get("priority") || "ALL";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const overdueOnly = searchParams.get("overdueOnly") === "true";

    const where: any = {};

    if (status !== "ALL") {
      where.status = status;
    }

    if (priority !== "ALL") {
      where.priority = priority;
    }

    if (overdueOnly) {
      where.followUpDate = {
        lt: new Date(),
      };
      // Only pending or in-progress statuses can be overdue
      where.status = {
        in: ["NEW", "CONTACTED", "QUALIFIED"],
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { workEmail: { contains: search } },
        { company: { contains: search } },
        { message: { contains: search } },
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === "followUpDate") {
      orderBy.followUpDate = sortOrder;
    } else if (sortBy === "company") {
      orderBy.company = sortOrder;
    } else if (sortBy === "priority") {
      orderBy.priority = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [leads, totalCount, statusCounts, overdueCount, demoCount] = await Promise.all([
      prisma.leadSubmission.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leadSubmission.count({ where }),
      prisma.leadSubmission.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.leadSubmission.count({
        where: {
          followUpDate: { lt: new Date() },
          status: { in: ["NEW", "CONTACTED", "QUALIFIED"] },
        },
      }),
      prisma.demoBookingRequest.count({
        where: { status: "PENDING_REVIEW" },
      }),
    ]);

    // Format metrics summary
    const statusMap: Record<string, number> = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      CONVERTED: 0,
      LOST: 0,
    };
    statusCounts.forEach((s) => {
      statusMap[s.status] = s._count._all;
    });

    return NextResponse.json({
      success: true,
      leads,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      metrics: {
        totalLeads: Object.values(statusMap).reduce((a, b) => a + b, 0),
        newLeads: statusMap.NEW,
        contacted: statusMap.CONTACTED,
        qualified: statusMap.QUALIFIED,
        converted: statusMap.CONVERTED,
        lost: statusMap.LOST,
        overdueFollowUps: overdueCount,
        pendingDemos: demoCount,
      },
    });
  } catch (error: any) {
    logger.error("Admin get leads error", error, { context: "CRM_LEADS" });
    return NextResponse.json({ error: "Failed to retrieve lead submissions" }, { status: 500 });
  }
}
