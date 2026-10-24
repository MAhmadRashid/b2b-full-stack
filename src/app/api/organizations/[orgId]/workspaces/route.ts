import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function POST(
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
        { error: "Forbidden: Only Organization Admins or Owners can provision workspaces" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, plan = "STARTER" } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const slug =
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + `-${Math.random().toString(36).substring(2, 6)}`;

    const limits: Record<string, number> = {
      STARTER: 50000,
      PRO: 250000,
      ENTERPRISE: 1000000,
    };

    const newWorkspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          organizationId: orgId,
          name: trimmedName,
          slug,
          plan: plan.toUpperCase(),
          monthlyRequestLimit: limits[plan.toUpperCase()] || 50000,
          requestsThisMonth: 0,
        },
      });

      await tx.membership.create({
        data: {
          userId: session.id,
          workspaceId: ws.id,
          role: "OWNER",
        },
      });

      return ws;
    });

    await recordAuditLog({
      workspaceId: newWorkspace.id,
      userId: session.id,
      userEmail: session.email,
      action: "WORKSPACE_CREATED",
      details: `Created workspace '${newWorkspace.name}' within organization ${orgId}`,
    });

    return NextResponse.json(
      {
        workspace: {
          id: newWorkspace.id,
          organizationId: newWorkspace.organizationId,
          name: newWorkspace.name,
          slug: newWorkspace.slug,
          plan: newWorkspace.plan,
          role: "OWNER",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create workspace in organization error:", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
