import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
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

    const body = await req.json();
    const { role } = body;

    const targetMembership = await prisma.membership.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!targetMembership || targetMembership.workspaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMembership.role === "OWNER" && perm.role !== "OWNER") {
      return NextResponse.json({ error: "Only the workspace owner can modify an owner's role" }, { status: 403 });
    }

    const validRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    const updated = await prisma.membership.update({
      where: { id: memberId },
      data: { role },
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "ROLE_CHANGED",
      details: `Changed role of ${targetMembership.user.email} from ${targetMembership.role} to ${role}`,
    });

    return NextResponse.json({ membership: updated });
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
      include: { user: true },
    });

    if (!targetMembership || targetMembership.workspaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMembership.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove workspace owner" }, { status: 400 });
    }

    await prisma.membership.delete({ where: { id: memberId } });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "MEMBER_REMOVED",
      details: `Removed ${targetMembership.user.email} from workspace by ${session.email}`,
    });

    return NextResponse.json({ success: true, message: "Member removed" });
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
