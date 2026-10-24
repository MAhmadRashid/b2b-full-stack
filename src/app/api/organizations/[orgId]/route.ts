import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.id,
          organizationId: orgId,
        },
      },
    });

    // Check system superadmin bypass
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    const isSuperAdmin = user?.systemRole === "SUPERADMIN";

    if (!membership && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this organization" },
        { status: 403 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        workspaces: {
          include: {
            _count: {
              select: {
                members: true,
                apiKeys: { where: { revoked: false } },
                events: true,
              },
            },
          },
        },
      },
    });

    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const role = isSuperAdmin ? "OWNER" : membership?.role;

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role,
        createdAt: org.createdAt,
        members: org.members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          joinedAt: m.createdAt,
        })),
        workspaces: org.workspaces.map((ws) => ({
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          plan: ws.plan,
          requestsThisMonth: ws.requestsThisMonth,
          monthlyRequestLimit: ws.monthlyRequestLimit,
          memberCount: ws._count.members,
          activeKeysCount: ws._count.apiKeys,
        })),
        canManage: ["OWNER", "ADMIN"].includes(role || ""),
      },
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json({ error: "Failed to load organization" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.id,
          organizationId: orgId,
        },
      },
    });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    const isSuperAdmin = user?.systemRole === "SUPERADMIN";

    if (!isSuperAdmin && (!membership || !["OWNER", "ADMIN"].includes(membership.role))) {
      return NextResponse.json(
        { error: "Forbidden: Only Organization Admins or Owners can update settings" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { name: name.trim() },
    });

    await recordAuditLog({
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_SETTINGS_UPDATED",
      details: `Updated organization name to '${updated.name}'`,
    });

    return NextResponse.json({ organization: updated });
  } catch (error) {
    console.error("Update organization error:", error);
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.id,
          organizationId: orgId,
        },
      },
    });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    const isSuperAdmin = user?.systemRole === "SUPERADMIN";

    if (!isSuperAdmin && (!membership || membership.role !== "OWNER")) {
      return NextResponse.json(
        { error: "Forbidden: Only the Organization Owner can delete this organization" },
        { status: 403 }
      );
    }

    await prisma.organization.delete({ where: { id: orgId } });

    await recordAuditLog({
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_DELETED",
      details: `Organization ${orgId} deleted by ${session.email}`,
    });

    return NextResponse.json({ success: true, message: "Organization deleted successfully" });
  } catch (error) {
    console.error("Delete organization error:", error);
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
  }
}
