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
      organizations: userWithWorkspaces.orgMemberships?.map((om) => ({
        id: om.organization.id,
        name: om.organization.name,
        slug: om.organization.slug,
        role: om.role,
      })) || [],
      workspaces: userWithWorkspaces.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        organizationId: m.workspace.organizationId,
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
