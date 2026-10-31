import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "ALL"; // ALL, ACTIVE, SUSPENDED
    const role = searchParams.get("role") || "ALL"; // ALL, SUPERADMIN, USER
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }

    if (status === "ACTIVE") {
      where.suspended = false;
    } else if (status === "SUSPENDED") {
      where.suspended = true;
    }

    if (role === "SUPERADMIN") {
      where.systemRole = "SUPERADMIN";
    } else if (role === "USER") {
      where.systemRole = "USER";
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          suspended: true,
          suspensionReason: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          orgMemberships: {
            include: {
              organization: {
                select: { id: true, name: true, slug: true, plan: true, suspended: true },
              },
            },
          },
          memberships: {
            include: {
              workspace: {
                select: { id: true, name: true, slug: true, plan: true },
              },
            },
          },
          _count: {
            select: {
              createdKeys: true,
              auditLogs: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        systemRole: u.systemRole,
        suspended: u.suspended,
        suspensionReason: u.suspensionReason,
        emailVerified: !!u.emailVerified,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        organizationCount: u.orgMemberships.length,
        workspaceCount: u.memberships.length,
        apiKeysCount: u._count.createdKeys,
        auditLogsCount: u._count.auditLogs,
        organizations: u.orgMemberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
          plan: m.organization.plan,
          suspended: m.organization.suspended,
        })),
        workspaces: u.memberships.map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          role: m.role,
          plan: m.workspace.plan,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Superadmin users listing error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
