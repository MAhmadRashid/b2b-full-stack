import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, comparePassword, signToken, COOKIE_NAME, getSessionUser } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.invitation.findFirst({
      where: {
        OR: [{ token }, { tokenHash }],
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
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
      },
    });

    if (!invitation || invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Invitation not found, or has already been accepted or revoked" },
        { status: 404 }
      );
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "This invitation link has expired", expired: true },
        { status: 410 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, name: true, email: true },
    });

    // Check if the current user is logged in
    const session = await getSessionUser(req);
    const isCurrentUserInvited = session ? session.email.toLowerCase() === invitation.email.toLowerCase() : null;

    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspace?.name || null,
        workspaceSlug: invitation.workspace?.slug || null,
        organizationId: invitation.organizationId,
        organizationName: invitation.organization?.name || null,
        organizationLogo: invitation.organization?.logoUrl || null,
        inviterEmail: invitation.inviterEmail,
        expiresAt: invitation.expiresAt,
      },
      userExists: !!existingUser,
      existingName: existingUser?.name || null,
      currentUserLoggedIn: !!session,
      currentUserEmail: session?.email || null,
      isCurrentUserInvited,
    });
  } catch (error) {
    console.error("Fetch invitation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`accept_invite_${ip}`, { limit: 30, windowMs: 15 * 60 * 1000 });
    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many invitation acceptance attempts. Please try again later."
      );
    }

    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.invitation.findFirst({
      where: {
        OR: [{ token }, { tokenHash }],
      },
      include: {
        workspace: true,
        organization: true,
      },
    });

    if (!invitation || invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Invitation not found or has already been used or revoked" },
        { status: 404 }
      );
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "This invitation link has expired", expired: true },
        { status: 410 }
      );
    }

    // Check if user is currently logged in
    const session = await getSessionUser(req);
    if (session && session.email.toLowerCase() !== invitation.email.toLowerCase()) {
      // Unauthorized acceptance prevention: Cannot accept an invitation addressed to another email
      return NextResponse.json(
        {
          error: `Unauthorized: You are signed in as ${session.email}, but this invitation was sent to ${invitation.email}. Please switch accounts to accept.`,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { password, name } = body;

    let user = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      if (!password || password.length < 8) {
        return NextResponse.json(
          { error: "Please enter a secure password of at least 8 characters" },
          { status: 400 }
        );
      }
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          email: invitation.email,
          name: name && name.trim() ? name.trim() : invitation.email.split("@")[0],
          passwordHash,
          systemRole: "USER",
        },
      });
    } else {
      // Account Takeover Prevention:
      // If user account already exists and is not already logged in with valid session,
      // verify their existing account password before granting membership.
      if (!session) {
        if (!password) {
          return NextResponse.json(
            { error: "An account already exists for this email. Please sign in or enter your account password to accept this invitation." },
            { status: 401 }
          );
        }
        const isValid = await comparePassword(password, user.passwordHash);
        if (!isValid) {
          return NextResponse.json(
            { error: "Incorrect password for this account. Please sign in or verify your password." },
            { status: 401 }
          );
        }
      }
      // Never overwrite existing user passwordHash upon invite acceptance!
    }

    // Process Workspace and/or Organization Membership
    await prisma.$transaction(async (tx) => {
      // 1. Workspace membership if invitation is for a workspace
      if (invitation.workspaceId) {
        await tx.membership.upsert({
          where: {
            userId_workspaceId: {
              userId: user.id,
              workspaceId: invitation.workspaceId,
            },
          },
          update: {
            role: invitation.role,
          },
          create: {
            userId: user.id,
            workspaceId: invitation.workspaceId,
            role: invitation.role,
            invitedBy: invitation.inviterEmail,
          },
        });

        // Ensure user is also a member of the workspace's organization if applicable
        if (invitation.workspace?.organizationId) {
          const existingOrgMember = await tx.organizationMembership.findUnique({
            where: {
              userId_organizationId: {
                userId: user.id,
                organizationId: invitation.workspace.organizationId,
              },
            },
          });

          if (!existingOrgMember) {
            await tx.organizationMembership.create({
              data: {
                userId: user.id,
                organizationId: invitation.workspace.organizationId,
                role: "MEMBER",
              },
            });
          }
        }
      }

      // 2. Organization membership if invitation is for an organization
      if (invitation.organizationId) {
        await tx.organizationMembership.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: invitation.organizationId,
            },
          },
          update: {
            role: invitation.role,
          },
          create: {
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });
      }

      // 3. Mark invitation as ACCEPTED (or delete) to invalidate token and prevent reuse
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });
    });

    const targetDesc = invitation.workspace?.name
      ? `workspace '${invitation.workspace.name}'`
      : `organization '${invitation.organization?.name}'`;

    await recordAuditLog({
      workspaceId: invitation.workspaceId || null,
      organizationId: invitation.organizationId || invitation.workspace?.organizationId || null,
      userId: user.id,
      userEmail: user.email,
      action: "INVITATION_ACCEPTED",
      details: `${user.email} joined ${targetDesc} as ${invitation.role}`,
    });

    // Create session token and authenticate user
    const sessionToken = signToken({
      userId: user.id,
      email: user.email,
      systemRole: user.systemRole,
    });

    const response = NextResponse.json({
      success: true,
      message: `Welcome to PulseFlow! Membership activated for ${targetDesc}.`,
      workspaceId: invitation.workspaceId,
      organizationId: invitation.organizationId || invitation.workspace?.organizationId,
    });

    response.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
