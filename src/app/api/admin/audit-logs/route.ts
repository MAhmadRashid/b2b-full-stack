import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const action = searchParams.get("action") || "ALL";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (action !== "ALL") {
      where.action = action.toUpperCase();
    }

    if (search) {
      where.OR = [
        { details: { contains: search } },
        { userEmail: { contains: search } },
        { action: { contains: search } },
      ];
    }

    const [total, audits, actionTypes] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          organization: { select: { name: true, slug: true } },
          workspace: { select: { name: true, slug: true } },
        },
      }),
      prisma.auditLog.groupBy({
        by: ["action"],
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      auditLogs: audits.map((a) => ({
        id: a.id,
        action: a.action,
        details: a.details,
        userEmail: a.userEmail,
        ipAddress: a.ipAddress,
        createdAt: a.createdAt,
        entityName: a.organization?.name || a.workspace?.name || null,
      })),
      actionTypes: actionTypes.map((at) => ({ action: at.action, count: at._count.id })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Superadmin audit logs fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
