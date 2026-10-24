import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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

    const members = await prisma.membership.findMany({
      where: { workspaceId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            systemRole: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const pendingInvitations = await prisma.invitation.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      pendingInvitations: pendingInvitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        inviteUrl: `/invite/${inv.token}`,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
      currentUserRole: perm.role,
      canManage: ["OWNER", "ADMIN"].includes(perm.role || ""),
    });
  } catch (error) {
    console.error("List members error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const body = await req.json();
    const { email, role = "MEMBER", name, sendInviteLink = true } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if target user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId: id,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "This user is already a member of this workspace" },
          { status: 400 }
        );
      }
    }

    const validRoles = ["ADMIN", "MEMBER", "VIEWER"];
    const assignedRole = validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : "MEMBER";

    // Generate invitation token
    const token = `inv_${crypto.randomBytes(24).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day validity

    // Upsert pending invitation record
    const invitation = await prisma.invitation.create({
      data: {
        workspaceId: id,
        email: normalizedEmail,
        role: assignedRole,
        token,
        expiresAt,
        inviterEmail: session.email,
      },
    });

    // Also provision default member record if direct add is desired or user exists
    let newMembership: any = null;
    let targetUser = existingUser;

    if (!targetUser && !sendInviteLink) {
      const tempHash = await bcrypt.hash("Password123!", 10);
      targetUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name ? name.trim() : normalizedEmail.split("@")[0],
          passwordHash: tempHash,
          systemRole: "USER",
        },
      });
    }

    if (targetUser && !sendInviteLink) {
      newMembership = await prisma.membership.create({
        data: {
          userId: targetUser.id,
          workspaceId: id,
          role: assignedRole,
          invitedBy: session.email,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });
    }

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "TEAM_MEMBER_INVITED",
      details: `Generated invitation for ${normalizedEmail} as ${assignedRole} (Token: ${token.slice(0, 10)}...)`,
    });

    return NextResponse.json(
      {
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          inviteUrl: `/invite/${invitation.token}`,
          expiresAt: invitation.expiresAt,
        },
        member: newMembership
          ? {
              id: newMembership.id,
              userId: newMembership.user.id,
              name: newMembership.user.name,
              email: newMembership.user.email,
              avatarUrl: newMembership.user.avatarUrl,
              role: newMembership.role,
              joinedAt: newMembership.createdAt,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Invite member error:", error);
    return NextResponse.json({ error: "Failed to create team invitation" }, { status: 500 });
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

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const url = new URL(req.url);
    const invitationId = url.searchParams.get("invitationId");

    if (!invitationId) {
      return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.workspaceId !== id) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    await prisma.invitation.delete({ where: { id: invitationId } });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "INVITATION_REVOKED",
      details: `Revoked pending invitation for ${invitation.email}`,
    });

    return NextResponse.json({ success: true, message: "Invitation cancelled" });
  } catch (error) {
    console.error("Delete invitation error:", error);
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}
