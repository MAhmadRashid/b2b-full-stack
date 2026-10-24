import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, COOKIE_NAME } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, workspaceName } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const resolvedWsName = (workspaceName || `${name.trim()}'s Team`).trim();
    const slug = resolvedWsName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + `-${Math.random().toString(36).substring(2, 6)}`;

    // Create user, workspace, and owner membership in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          systemRole: "USER",
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: resolvedWsName,
          slug,
          plan: "STARTER",
          monthlyRequestLimit: 50000,
          requestsThisMonth: 0,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      });

      return { user, workspace, membership };
    });

    await recordAuditLog({
      workspaceId: result.workspace.id,
      userId: result.user.id,
      userEmail: result.user.email,
      action: "USER_REGISTERED",
      details: `Account created and workspace '${result.workspace.name}' provisioned`,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    const token = signToken({
      userId: result.user.id,
      email: result.user.email,
      systemRole: result.user.systemRole,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        systemRole: result.user.systemRole,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
        role: "OWNER",
        plan: result.workspace.plan,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Register API error:", error);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
