import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";

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

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            apiKeys: { where: { revoked: false } },
            events: true,
            invoices: true,
          },
        },
      },
    });

    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    return NextResponse.json({
      workspace: {
        ...workspace,
        role: perm.role,
      },
    });
  } catch (error) {
    console.error("Get workspace error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const body = await req.json();
    const { name, billingCycle } = body;

    const updated = await prisma.workspace.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(billingCycle && { billingCycle }),
      },
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "WORKSPACE_SETTINGS_UPDATED",
      details: `Workspace settings updated: ${JSON.stringify({ name, billingCycle })}`,
    });

    return NextResponse.json({ workspace: updated });
  } catch (error) {
    console.error("Update workspace error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "OWNER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "WORKSPACE_DELETED",
      details: `Workspace ${id} was deleted by ${session.email}`,
    });

    await prisma.workspace.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Workspace deleted successfully" });
  } catch (error) {
    console.error("Delete workspace error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
