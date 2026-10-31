import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission, canAssignRole, isLastOrganizationOwner } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> }
) {
  try {
    const { orgId, memberId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { role } = body;

    const validRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
    const normalizedRole = role?.toUpperCase();
    if (!validRoles.includes(normalizedRole)) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    const targetMembership = await prisma.organizationMembership.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!targetMembership || targetMembership.organizationId !== orgId) {
      return NextResponse.json({ error: "Organization member not found" }, { status: 404 });
    }

    // Role escalation safeguard:
    // Only an OWNER can promote someone to OWNER or modify an OWNER
    if (normalizedRole === "OWNER" && perm.role !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: Only an Organization Owner can promote members to Owner." },
        { status: 403 }
      );
    }

    if (targetMembership.role === "OWNER" && perm.role !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: Only an Organization Owner can modify another Owner's role." },
        { status: 403 }
      );
    }

    // Last owner protection:
    // Prevent demoting the last owner of the organization
    if (targetMembership.role === "OWNER" && normalizedRole !== "OWNER") {
      const isLast = await isLastOrganizationOwner(orgId, targetMembership.userId);
      if (isLast) {
        return NextResponse.json(
          { error: "Cannot demote the last Owner of the organization. Transfer ownership first." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.organizationMembership.update({
      where: { id: memberId },
      data: { role: normalizedRole },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_ROLE_CHANGED",
      details: `Changed role of ${targetMembership.user.email} from ${targetMembership.role} to ${normalizedRole}`,
    });

    return NextResponse.json({
      success: true,
      membership: {
        id: updated.id,
        userId: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        role: updated.role,
      },
    });
  } catch (error) {
    console.error("Update organization member role error:", error);
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> }
) {
  try {
    const { orgId, memberId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const targetMembership = await prisma.organizationMembership.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!targetMembership || targetMembership.organizationId !== orgId) {
      return NextResponse.json({ error: "Organization member not found" }, { status: 404 });
    }

    // Protection: ADMIN cannot remove an OWNER
    if (targetMembership.role === "OWNER" && perm.role !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: Only an Organization Owner can remove an Owner." },
        { status: 403 }
      );
    }

    // Protection: Prevent removal of the last owner
    if (targetMembership.role === "OWNER") {
      const isLast = await isLastOrganizationOwner(orgId, targetMembership.userId);
      if (isLast) {
        return NextResponse.json(
          { error: "Cannot remove the last Owner of the organization." },
          { status: 400 }
        );
      }
    }

    await prisma.organizationMembership.delete({ where: { id: memberId } });

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_MEMBER_REMOVED",
      details: `Removed ${targetMembership.user.email} from organization by ${session.email}`,
    });

    return NextResponse.json({ success: true, message: "Member removed from organization." });
  } catch (error) {
    console.error("Delete organization member error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
