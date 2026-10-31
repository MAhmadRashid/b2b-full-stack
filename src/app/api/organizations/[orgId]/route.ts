import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { checkOrganizationPermission } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "VIEWER");
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.error }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        owner: {
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
          orderBy: { createdAt: "asc" },
        },
        workspaces: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
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
          orderBy: { createdAt: "asc" },
        },
        invitations: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const role = perm.role;
    const isOwner = role === "OWNER";
    const canManage = ["OWNER", "ADMIN"].includes(role || "");

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        ownerId: org.ownerId,
        owner: org.owner,
        role,
        isOwner,
        canManage,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        members: org.members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.createdAt,
        })),
        workspaces: org.workspaces.map((ws) => ({
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          plan: ws.plan,
          requestsThisMonth: ws.requestsThisMonth,
          monthlyRequestLimit: ws.monthlyRequestLimit,
          memberCount: ws._count.members,
          activeKeysCount: ws._count.apiKeys,
          creator: ws.creator,
          createdAt: ws.createdAt,
        })),
        pendingInvitations: org.invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          token: inv.token,
          inviteUrl: `/invite/${inv.token}`,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json({ error: "Failed to load organization" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.error }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, logoUrl, newOwnerId } = body;

    const currentOrg = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { owner: true },
    });

    if (!currentOrg) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Handle Ownership Transfer
    if (newOwnerId && newOwnerId !== currentOrg.ownerId) {
      // Only the current OWNER (or system superadmin) can transfer ownership
      if (perm.role !== "OWNER") {
        return NextResponse.json(
          { error: "Forbidden: Only the current Organization Owner can transfer ownership." },
          { status: 403 }
        );
      }

      // Verify the new owner is an active member of this organization
      const targetMembership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: newOwnerId,
            organizationId: orgId,
          },
        },
        include: { user: true },
      });

      if (!targetMembership) {
        return NextResponse.json(
          { error: "Target user must be an active member of this organization to receive ownership." },
          { status: 400 }
        );
      }

      // Perform atomic ownership transfer:
      // 1. Update organization ownerId
      // 2. Ensure new owner has role = 'OWNER'
      await prisma.$transaction([
        prisma.organization.update({
          where: { id: orgId },
          data: {
            ownerId: newOwnerId,
            ...(name && { name: name.trim() }),
            ...(logoUrl !== undefined && { logoUrl: logoUrl ? logoUrl.trim() : null }),
          },
        }),
        prisma.organizationMembership.update({
          where: { id: targetMembership.id },
          data: { role: "OWNER" },
        }),
      ]);

      await recordAuditLog({
        organizationId: orgId,
        userId: session.id,
        userEmail: session.email,
        action: "ORGANIZATION_OWNERSHIP_TRANSFERRED",
        details: `Ownership transferred from ${session.email} to ${targetMembership.user.email}`,
      });

      const updated = await prisma.organization.findUnique({
        where: { id: orgId },
        include: { owner: { select: { id: true, name: true, email: true } } },
      });

      return NextResponse.json({
        success: true,
        message: "Ownership successfully transferred.",
        organization: updated,
      });
    }

    // Standard settings update (name, logoUrl)
    const updateData: any = {};
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: "Organization name cannot be empty" }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl ? logoUrl.trim() : null;
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_SETTINGS_UPDATED",
      details: `Updated organization settings: ${JSON.stringify(updateData)}`,
    });

    return NextResponse.json({ organization: updated });
  } catch (error) {
    console.error("Update organization error:", error);
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "OWNER");
    if (!perm.allowed) {
      return NextResponse.json(
        { error: "Forbidden: Only the Organization Owner can delete this organization" },
        { status: 403 }
      );
    }

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_DELETED",
      details: `Organization ${orgId} was deleted by ${session.email}`,
    });

    await prisma.organization.delete({ where: { id: orgId } });

    return NextResponse.json({ success: true, message: "Organization deleted successfully" });
  } catch (error) {
    console.error("Delete organization error:", error);
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
  }
}
