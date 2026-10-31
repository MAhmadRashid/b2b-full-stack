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
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
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
        canManage: ["OWNER", "ADMIN"].includes(perm.role || ""),
        isOwner: perm.role === "OWNER",
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

    const body = await req.json().catch(() => ({}));
    const { name, billingCycle, plan } = body;

    const currentWs = await prisma.workspace.findUnique({ where: { id } });
    if (!currentWs) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const updateData: any = {};
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: "Workspace name cannot be empty" }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (billingCycle !== undefined) {
      updateData.billingCycle = billingCycle;
    }
    if (plan !== undefined) {
      // Only owners can change plan
      if (perm.role !== "OWNER") {
        return NextResponse.json({ error: "Only workspace owners can alter the subscription plan" }, { status: 403 });
      }
      updateData.plan = plan.toUpperCase();
      const limits: Record<string, number> = {
        STARTER: 50000,
        PRO: 250000,
        ENTERPRISE: 1000000,
      };
      updateData.monthlyRequestLimit = limits[plan.toUpperCase()] || 50000;
    }

    const updated = await prisma.workspace.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog({
      workspaceId: id,
      organizationId: updated.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "WORKSPACE_SETTINGS_UPDATED",
      details: `Workspace settings updated: ${JSON.stringify(updateData)}`,
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

    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    await recordAuditLog({
      workspaceId: id,
      organizationId: ws.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "WORKSPACE_DELETED",
      details: `Workspace '${ws.name}' (${id}) was deleted by ${session.email}`,
    });

    await prisma.workspace.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Workspace deleted successfully" });
  } catch (error) {
    console.error("Delete workspace error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
