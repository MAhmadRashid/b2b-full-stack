import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, COOKIE_NAME } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found or already accepted" },
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

    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        workspaceName: invitation.workspace.name,
        workspaceSlug: invitation.workspace.slug,
        inviterEmail: invitation.inviterEmail,
        expiresAt: invitation.expiresAt,
      },
      userExists: !!existingUser,
      existingName: existingUser?.name || null,
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
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found or has already been used" },
        { status: 404 }
      );
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "This invitation link has expired" },
        { status: 410 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { password, name } = body;

    let user = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      if (!password || password.length < 6) {
        return NextResponse.json(
          { error: "Please enter a secure password of at least 6 characters" },
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
    } else if (password && password.length >= 6) {
      const passwordHash = await hashPassword(password);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          name: name && name.trim() ? name.trim() : user.name,
        },
      });
    }

    // Activate membership
    await prisma.membership.upsert({
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

    // Clean up pending invitation record once membership is confirmed
    await prisma.invitation.delete({
      where: { id: invitation.id },
    });

    await recordAuditLog({
      workspaceId: invitation.workspaceId,
      userId: user.id,
      userEmail: user.email,
      action: "INVITATION_ACCEPTED",
      details: `${user.email} joined workspace '${invitation.workspace.name}' as ${invitation.role}`,
    });

    // Create session token and authenticate user
    const sessionToken = signToken({
      userId: user.id,
      email: user.email,
      systemRole: user.systemRole,
    });

    const response = NextResponse.json({
      success: true,
      message: "Welcome to PulseFlow! Workspace membership activated.",
      workspaceId: invitation.workspaceId,
      workspaceSlug: invitation.workspace.slug,
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
