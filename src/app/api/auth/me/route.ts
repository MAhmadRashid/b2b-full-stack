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
        createdAt: true,
        memberships: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
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
        createdAt: userWithWorkspaces.createdAt,
      },
      workspaces: userWithWorkspaces.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
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
