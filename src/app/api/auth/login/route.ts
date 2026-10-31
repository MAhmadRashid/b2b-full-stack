import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, COOKIE_NAME } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Allow higher threshold in testing or development to ensure multi-test regression sweeps succeed
    const isTest = process.env.NODE_ENV === "test" || process.env.CI === "true";
    const limit = isTest ? 200 : 60;
    const rl = checkRateLimit(`login_${ip}`, { limit, windowMs: 60000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rl.resetMs / 1000).toString(),
            "X-RateLimit-Limit": rl.limit.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    const rateLimitHeaders = {
      "X-RateLimit-Limit": rl.limit.toString(),
      "X-RateLimit-Remaining": rl.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(rl.resetMs / 1000).toString(),
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: rateLimitHeaders }
      );
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: rateLimitHeaders }
      );
    }

    if (user.suspended) {
      return NextResponse.json(
        { 
          error: "Your account has been suspended by a platform administrator.",
          reason: user.suspensionReason || "Violation of platform policies or administrative hold."
        },
        { status: 403, headers: rateLimitHeaders }
      );
    }

    // Sign session token
    const token = signToken({
      userId: user.id,
      email: user.email,
      systemRole: user.systemRole,
    });

    // Record login audit log
    const primaryWorkspaceId = user.memberships[0]?.workspaceId;
    await recordAuditLog({
      workspaceId: primaryWorkspaceId,
      userId: user.id,
      userEmail: user.email,
      action: "USER_LOGIN",
      details: `User ${user.email} signed in successfully`,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        systemRole: user.systemRole,
      },
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        plan: m.workspace.plan,
      })),
    });

    // Set secure HTTP-only cookie
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    response.headers.set("X-RateLimit-Limit", rl.limit.toString());
    response.headers.set("X-RateLimit-Remaining", rl.remaining.toString());

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Internal server error occurred during login" },
      { status: 500 }
    );
  }
}
