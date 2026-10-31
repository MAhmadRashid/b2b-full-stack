import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission, canAssignRole } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/email";
import crypto from "crypto";

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

    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
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
        organizationId: orgId,
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
    console.error("List organization members error:", error);
    return NextResponse.json({ error: "Failed to list organization members" }, { status: 500 });
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
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { email, role = "MEMBER" } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const assignedRole = role.toUpperCase();

    // Prevent unauthorized role escalation:
    // Only an OWNER (or Superadmin) can assign the OWNER role
    if (!canAssignRole(perm.role || "MEMBER", assignedRole)) {
      return NextResponse.json(
        { error: `Forbidden: As ${perm.role}, you cannot assign the ${assignedRole} role.` },
        { status: 403 }
      );
    }

    // Check if user is already an active member of this organization
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const existingMembership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: orgId,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "This user is already a member of this organization." },
          { status: 400 }
        );
      }
    }

    // Check for duplicate pending invitations:
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organizationId: orgId,
        email: normalizedEmail,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        {
          error: "A pending invitation already exists for this email address.",
          invitationId: existingInvitation.id,
        },
        { status: 409 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            members: true,
            invitations: { where: { status: "PENDING" } },
          },
        },
      },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const { getPlan } = await import("@/lib/billing-plans");
    const planConfig = getPlan(org.plan || "FREE");
    const totalMembersAndPending = org._count.members + org._count.invitations;

    if (totalMembersAndPending >= planConfig.limits.maxTeamMembers) {
      return NextResponse.json(
        {
          error: "Team member limit reached",
          message: `Your organization on the ${planConfig.name} plan allows up to ${planConfig.limits.maxTeamMembers} team members (including active and pending invites). Please upgrade your subscription to invite additional members.`,
          upgradeRequired: true,
          limit: planConfig.limits.maxTeamMembers,
          currentUsage: totalMembersAndPending,
        },
        { status: 403 }
      );
    }

    // Generate secure unique token and SHA-256 hash
    const rawToken = `inv_org_${crypto.randomBytes(24).toString("hex")}`;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiration

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: orgId,
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

    // Dispatch email if configured
    const emailResult = await sendInvitationEmail({
      to: normalizedEmail,
      inviterName: session.name,
      inviterEmail: session.email,
      targetName: org.name,
      targetType: "organization",
      role: assignedRole,
      inviteUrl,
    });

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_MEMBER_INVITED",
      details: `Invited ${normalizedEmail} to ${org.name} as ${assignedRole}`,
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
    console.error("Invite organization member error:", error);
    return NextResponse.json({ error: "Failed to create organization invitation" }, { status: 500 });
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

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const url = new URL(req.url);
    const invitationId = url.searchParams.get("invitationId");

    if (!invitationId) {
      return NextResponse.json({ error: "invitationId query parameter is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.organizationId !== orgId) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_INVITATION_REVOKED",
      details: `Revoked organization invitation for ${invitation.email}`,
    });

    return NextResponse.json({ success: true, message: "Invitation revoked successfully." });
  } catch (error) {
    console.error("Revoke organization invitation error:", error);
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}
