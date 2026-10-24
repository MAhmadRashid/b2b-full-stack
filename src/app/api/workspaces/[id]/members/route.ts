import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";

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
      currentUserRole: perm.role,
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
    const { email, role = "MEMBER", name } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists or provision an invitation profile
    let targetUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!targetUser) {
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

    // Check if membership already exists
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUser.id,
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

    const validRoles = ["ADMIN", "MEMBER", "VIEWER"];
    const assignedRole = validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : "MEMBER";

    const newMembership = await prisma.membership.create({
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

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "TEAM_MEMBER_INVITED",
      details: `Added ${normalizedEmail} as ${assignedRole} by ${session.email}`,
    });

    return NextResponse.json({
      member: {
        id: newMembership.id,
        userId: newMembership.user.id,
        name: newMembership.user.name,
        email: newMembership.user.email,
        avatarUrl: newMembership.user.avatarUrl,
        role: newMembership.role,
        joinedAt: newMembership.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Invite member error:", error);
    return NextResponse.json({ error: "Failed to add team member" }, { status: 500 });
  }
}
