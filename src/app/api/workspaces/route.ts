import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.id },
      include: {
        workspace: {
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
      orderBy: { createdAt: "asc" },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      plan: m.workspace.plan,
      role: m.role,
      subscriptionStatus: m.workspace.subscriptionStatus,
      requestsThisMonth: m.workspace.requestsThisMonth,
      monthlyRequestLimit: m.workspace.monthlyRequestLimit,
      memberCount: m.workspace._count.members,
      activeKeysCount: m.workspace._count.apiKeys,
      createdAt: m.workspace.createdAt,
    }));

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error("List workspaces error:", error);
    return NextResponse.json({ error: "Failed to load workspaces" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
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
      details: `Created workspace '${newWorkspace.name}' with plan ${newWorkspace.plan}`,
    });

    return NextResponse.json({
      workspace: {
        id: newWorkspace.id,
        name: newWorkspace.name,
        slug: newWorkspace.slug,
        plan: newWorkspace.plan,
        role: "OWNER",
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Create workspace error:", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
