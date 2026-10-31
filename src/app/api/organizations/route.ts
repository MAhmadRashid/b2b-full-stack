import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isSuperAdmin = session.systemRole === "SUPERADMIN";

    let organizations;

    if (isSuperAdmin) {
      // Superadmins can see all organizations
      const allOrgs = await prisma.organization.findMany({
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          workspaces: {
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
          members: {
            where: { userId: session.id },
            select: { role: true },
          },
          _count: {
            select: {
              members: true,
              workspaces: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      organizations = allOrgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        ownerId: org.ownerId,
        owner: org.owner,
        role: org.members[0]?.role || "OWNER",
        memberCount: org._count.members,
        workspaceCount: org._count.workspaces,
        workspaces: org.workspaces,
        createdAt: org.createdAt,
      }));
    } else {
      const memberships = await prisma.organizationMembership.findMany({
        where: { userId: session.id },
        include: {
          organization: {
            include: {
              owner: {
                select: { id: true, name: true, email: true },
              },
              workspaces: {
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
              _count: {
                select: {
                  members: true,
                  workspaces: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      organizations = memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logoUrl: m.organization.logoUrl,
        ownerId: m.organization.ownerId,
        owner: m.organization.owner,
        role: m.role,
        memberCount: m.organization._count.members,
        workspaceCount: m.organization._count.workspaces,
        workspaces: m.organization.workspaces,
        createdAt: m.organization.createdAt,
      }));
    }

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("List organizations error:", error);
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { name, logoUrl } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const slug =
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + `-${Math.random().toString(36).substring(2, 6)}`;

    const newOrg = await prisma.$transaction(async (tx) => {
      // 1. Create Organization with owner
      const org = await tx.organization.create({
        data: {
          name: trimmedName,
          slug,
          logoUrl: logoUrl && logoUrl.trim() ? logoUrl.trim() : null,
          ownerId: session.id,
        },
      });

      // 2. Add creator as Organization OWNER
      await tx.organizationMembership.create({
        data: {
          userId: session.id,
          organizationId: org.id,
          role: "OWNER",
        },
      });

      // 3. Automatically provision initial Workspace within the Organization
      const defaultWsSlug = `${slug}-main`;
      const defaultWs = await tx.workspace.create({
        data: {
          organizationId: org.id,
          creatorId: session.id,
          name: `${trimmedName} Production`,
          slug: defaultWsSlug,
          plan: "STARTER",
          monthlyRequestLimit: 50000,
          requestsThisMonth: 0,
        },
      });

      // 4. Bind creator as Workspace OWNER
      await tx.membership.create({
        data: {
          userId: session.id,
          workspaceId: defaultWs.id,
          role: "OWNER",
        },
      });

      return { org, defaultWs };
    });

    await recordAuditLog({
      organizationId: newOrg.org.id,
      workspaceId: newOrg.defaultWs.id,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_CREATED",
      details: `Created organization '${newOrg.org.name}' with initial workspace '${newOrg.defaultWs.name}'`,
    });

    return NextResponse.json(
      {
        organization: {
          id: newOrg.org.id,
          name: newOrg.org.name,
          slug: newOrg.org.slug,
          logoUrl: newOrg.org.logoUrl,
          ownerId: newOrg.org.ownerId,
          role: "OWNER",
          defaultWorkspaceId: newOrg.defaultWs.id,
          createdAt: newOrg.org.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create organization error:", error);
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }
}
