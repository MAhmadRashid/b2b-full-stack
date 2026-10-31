import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { checkOrganizationPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");

    const isSuperAdmin = session.systemRole === "SUPERADMIN";

    const whereClause: any = {};
    if (orgId) {
      // If filtering by organization, enforce that the user belongs to that organization (or is superadmin)
      if (!isSuperAdmin) {
        const orgMembership = await prisma.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: session.id,
              organizationId: orgId,
            },
          },
        });
        if (!orgMembership) {
          return NextResponse.json({ error: "Forbidden: You are not a member of this organization" }, { status: 403 });
        }
      }
      whereClause.organizationId = orgId;
    }

    if (!isSuperAdmin) {
      // Normal user can only see workspaces where they have a membership
      whereClause.members = {
        some: { userId: session.id },
      };
    }

    const workspaces = await prisma.workspace.findMany({
      where: whereClause,
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

    const result = workspaces.map((ws) => {
      const userMembership = ws.members.find((m) => m.userId === session.id);
      const role = isSuperAdmin ? "OWNER" : userMembership?.role || "VIEWER";

      return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        plan: ws.plan,
        role,
        organizationId: ws.organizationId,
        organization: ws.organization,
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
          joinedAt: m.createdAt,
        })),
        createdAt: ws.createdAt,
      };
    });

    return NextResponse.json({ workspaces: result });
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

    const body = await req.json().catch(() => ({}));
    const { name, plan = "STARTER", organizationId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    // If an organizationId is specified, verify user has permission (ADMIN or OWNER) in that organization
    let targetOrgId = organizationId;
    if (targetOrgId) {
      const perm = await checkOrganizationPermission(session.id, targetOrgId, "ADMIN");
      if (!perm.allowed) {
        return NextResponse.json(
          { error: "Forbidden: You must be an Admin or Owner of the organization to create workspaces within it." },
          { status: 403 }
        );
      }
    } else {
      // Find user's default organization if not explicitly supplied
      const firstOrg = await prisma.organizationMembership.findFirst({
        where: { userId: session.id },
        select: { organizationId: true },
      });
      if (firstOrg) {
        targetOrgId = firstOrg.organizationId;
      }
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
          organizationId: targetOrgId || null,
          creatorId: session.id,
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
      organizationId: targetOrgId || null,
      workspaceId: newWorkspace.id,
      userId: session.id,
      userEmail: session.email,
      action: "WORKSPACE_CREATED",
      details: `Created workspace '${newWorkspace.name}' with plan ${newWorkspace.plan}`,
    });

    return NextResponse.json(
      {
        workspace: {
          id: newWorkspace.id,
          name: newWorkspace.name,
          slug: newWorkspace.slug,
          plan: newWorkspace.plan,
          organizationId: newWorkspace.organizationId,
          role: "OWNER",
          createdAt: newWorkspace.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create workspace error:", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
