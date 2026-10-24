import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, hashPassword, comparePassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        systemRole: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            orgMemberships: true,
            createdKeys: true,
          },
        },
      },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        systemRole: user.systemRole,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        stats: {
          workspacesCount: user._count.memberships,
          organizationsCount: user._count.orgMemberships,
          apiKeysCount: user._count.createdKeys,
        },
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { name, avatarUrl, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updateData: any = {};

    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl;
    }

    // Password change verification
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password" },
          { status: 400 }
        );
      }

      const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters long" },
          { status: 400 }
        );
      }

      updateData.passwordHash = await hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        systemRole: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    await recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "USER_PROFILE_UPDATED",
      details: `Profile updated${newPassword ? " including password change" : ""}`,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
