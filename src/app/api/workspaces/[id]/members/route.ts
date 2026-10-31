import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission, canAssignRole } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/email";
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
      where: {
        workspaceId: id,
        status: "PENDING",
      },
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
    console.error("List workspace members error:", error);
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

    const body = await req.json().catch(() => ({}));
    const { email, role = "MEMBER" } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const assignedRole = role.toUpperCase();

    // Prevent unauthorized privilege escalation:
    // Only an OWNER can invite or assign another OWNER
    if (!canAssignRole(perm.role || "MEMBER", assignedRole)) {
      return NextResponse.json(
        { error: `Forbidden: As ${perm.role}, you cannot assign the ${assignedRole} role.` },
        { status: 403 }
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { id: true, name: true, organizationId: true },
    });
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

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
          { error: "This user is already an active member of this workspace." },
          { status: 400 }
        );
      }
    }

    // Prevent duplicate pending invitations for the same email in this workspace
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        workspaceId: id,
        email: normalizedEmail,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        {
          error: "A pending invitation already exists for this email in this workspace.",
          invitationId: existingInvitation.id,
        },
        { status: 409 }
      );
    }

    // Generate secure token and SHA-256 hash
    const rawToken = `inv_ws_${crypto.randomBytes(24).toString("hex")}`;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day validity

    const invitation = await prisma.invitation.create({
      data: {
        workspaceId: id,
        organizationId: workspace.organizationId,
        email: normalizedEmail,
        role: assignedRole,
        token: rawToken,
        tokenHash,
        expiresAt,
        status: "PENDING",
        inviterEmail: session.email,
      },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${rawToken}`;

    const emailResult = await sendInvitationEmail({
      to: normalizedEmail,
      inviterName: session.name,
      inviterEmail: session.email,
      targetName: workspace.name,
      targetType: "workspace",
      role: assignedRole,
      inviteUrl,
    });

    await recordAuditLog({
      workspaceId: id,
      organizationId: workspace.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "TEAM_MEMBER_INVITED",
      details: `Generated invitation for ${normalizedEmail} as ${assignedRole} in workspace '${workspace.name}'`,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Invitation sent successfully.",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          inviteUrl: `/invite/${invitation.token}`,
          expiresAt: invitation.expiresAt,
          emailDelivered: emailResult.delivered,
          emailDeliveryStatus: emailResult.simulated ? "simulated" : emailResult.delivered ? "delivered" : "failed",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Invite workspace member error:", error);
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

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    await recordAuditLog({
      workspaceId: id,
      organizationId: invitation.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "INVITATION_REVOKED",
      details: `Revoked pending workspace invitation for ${invitation.email}`,
    });

    return NextResponse.json({ success: true, message: "Invitation cancelled and revoked." });
  } catch (error) {
    console.error("Delete workspace invitation error:", error);
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}
