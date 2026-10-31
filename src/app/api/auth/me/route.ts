import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const userWithWorkspaces = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        systemRole: true,
        emailVerified: true,
        createdAt: true,
        orgMemberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                ownerId: true,
              },
            },
          },
        },
        memberships: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
                organizationId: true,
                creatorId: true,
                creator: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
                subscriptionStatus: true,
                requestsThisMonth: true,
                monthlyRequestLimit: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!userWithWorkspaces) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    // If SUPERADMIN, also make sure all organizations and workspaces are discoverable
    let organizations = userWithWorkspaces.orgMemberships?.map((om) => ({
      id: om.organization.id,
      name: om.organization.name,
      slug: om.organization.slug,
      logoUrl: om.organization.logoUrl,
      ownerId: om.organization.ownerId,
      role: om.role,
    })) || [];

    if (userWithWorkspaces.systemRole === "SUPERADMIN" && organizations.length === 0) {
      const allOrgs = await prisma.organization.findMany({
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          ownerId: true,
        },
      });
      organizations = allOrgs.map((o) => ({
        ...o,
        role: "OWNER",
      }));
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: userWithWorkspaces.id,
        email: userWithWorkspaces.email,
        name: userWithWorkspaces.name,
        avatarUrl: userWithWorkspaces.avatarUrl,
        systemRole: userWithWorkspaces.systemRole,
        emailVerified: userWithWorkspaces.emailVerified,
        createdAt: userWithWorkspaces.createdAt,
      },
      organizations,
      workspaces: userWithWorkspaces.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        organizationId: m.workspace.organizationId,
        creatorId: m.workspace.creatorId,
        creator: m.workspace.creator,
        plan: m.workspace.plan,
        subscriptionStatus: m.workspace.subscriptionStatus,
        requestsThisMonth: m.workspace.requestsThisMonth,
        monthlyRequestLimit: m.workspace.monthlyRequestLimit,
      })),
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
