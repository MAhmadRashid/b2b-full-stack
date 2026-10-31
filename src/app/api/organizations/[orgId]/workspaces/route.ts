import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "VIEWER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const workspaces = await prisma.workspace.findMany({
      where: { organizationId: orgId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
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
        },
        _count: {
          select: {
            members: true,
            apiKeys: { where: { revoked: false } },
            events: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      workspaces: workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        plan: ws.plan,
        organizationId: ws.organizationId,
        subscriptionStatus: ws.subscriptionStatus,
        requestsThisMonth: ws.requestsThisMonth,
        monthlyRequestLimit: ws.monthlyRequestLimit,
        creator: ws.creator,
        memberCount: ws._count.members,
        activeKeysCount: ws._count.apiKeys,
        members: ws.members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
        })),
        createdAt: ws.createdAt,
      })),
    });
  } catch (error) {
    console.error("List organization workspaces error:", error);
    return NextResponse.json({ error: "Failed to load workspaces" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) {
      return NextResponse.json(
        { error: "Forbidden: Only Organization Admins or Owners can provision workspaces" },
        { status: 403 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { workspaces: true } } },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { name, plan } = body;

    const { getPlan } = await import("@/lib/billing-plans");
    const effectivePlanId =
      plan && ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(plan.toUpperCase())
        ? plan.toUpperCase()
        : org.plan || "FREE";
    const planConfig = getPlan(effectivePlanId);

    if (org._count.workspaces >= planConfig.limits.maxWorkspaces) {
      return NextResponse.json(
        {
          error: "Workspace limit reached",
          message: `Your organization on the ${planConfig.name} plan is limited to ${planConfig.limits.maxWorkspaces} workspace(s). Please upgrade your subscription to create additional workspaces.`,
          upgradeRequired: true,
          limit: planConfig.limits.maxWorkspaces,
          currentUsage: org._count.workspaces,
        },
        { status: 403 }
      );
    }

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
      FREE: 10000,
      STARTER: 50000,
      PRO: 250000,
      BUSINESS: 1000000,
      ENTERPRISE: 5000000,
    };

    const chosenPlan = (plan ? plan.toUpperCase() : org.plan || "STARTER");

    const newWorkspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          organizationId: orgId,
          creatorId: session.id,
          name: trimmedName,
          slug,
          plan: chosenPlan,
          monthlyRequestLimit: limits[chosenPlan] || planConfig.limits.monthlyRequests || 50000,
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
      organizationId: orgId,
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
          createdAt: newWorkspace.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create workspace in organization error:", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
