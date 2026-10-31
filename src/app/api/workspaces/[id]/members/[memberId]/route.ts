import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission, isLastWorkspaceOwner } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { role } = body;

    const validRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
    const normalizedRole = role?.toUpperCase();
    if (!validRoles.includes(normalizedRole)) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    const targetMembership = await prisma.membership.findUnique({
      where: { id: memberId },
      include: { user: true, workspace: true },
    });

    if (!targetMembership || targetMembership.workspaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Role escalation safeguard:
    // Only workspace OWNER can promote someone to OWNER or modify an OWNER
    if (normalizedRole === "OWNER" && perm.role !== "OWNER") {
      return NextResponse.json({ error: "Only the workspace owner can promote a user to owner" }, { status: 403 });
    }

    if (targetMembership.role === "OWNER" && perm.role !== "OWNER") {
      return NextResponse.json({ error: "Only the workspace owner can modify an owner's role" }, { status: 403 });
    }

    // Last owner protection:
    // Prevent demoting the last owner of the workspace
    if (targetMembership.role === "OWNER" && normalizedRole !== "OWNER") {
      const isLast = await isLastWorkspaceOwner(id, targetMembership.userId);
      if (isLast) {
        return NextResponse.json(
          { error: "Cannot demote the last Owner of the workspace. Promote another member first." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.membership.update({
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
      workspaceId: id,
      organizationId: targetMembership.workspace.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "ROLE_CHANGED",
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
    console.error("Update member role error:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const targetMembership = await prisma.membership.findUnique({
      where: { id: memberId },
      include: { user: true, workspace: true },
    });

    if (!targetMembership || targetMembership.workspaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Role safeguard: ADMIN cannot remove an OWNER
    if (targetMembership.role === "OWNER" && perm.role !== "OWNER") {
      return NextResponse.json({ error: "Only the workspace owner can remove an owner" }, { status: 403 });
    }

    // Last owner protection: Prevent removing the last owner
    if (targetMembership.role === "OWNER") {
      const isLast = await isLastWorkspaceOwner(id, targetMembership.userId);
      if (isLast) {
        return NextResponse.json(
          { error: "Cannot remove the last Owner of the workspace." },
          { status: 400 }
        );
      }
    }

    await prisma.membership.delete({ where: { id: memberId } });

    await recordAuditLog({
      workspaceId: id,
      organizationId: targetMembership.workspace.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "MEMBER_REMOVED",
      details: `Removed ${targetMembership.user.email} from workspace by ${session.email}`,
    });

    return NextResponse.json({ success: true, message: "Member removed from workspace" });
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
