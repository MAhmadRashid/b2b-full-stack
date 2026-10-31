import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, COOKIE_NAME } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const isLoopback = ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";
    const rl = checkRateLimit(`register_${ip}`, {
      limit: isLoopback ? 2000 : 50,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many registration attempts from this IP. Please try again later."
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, email, password, workspaceName } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "A valid name is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: "Password must not exceed 128 characters" },
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

      const onboarding = await tx.onboardingProgress.create({
        data: {
          userId: user.id,
          currentStep: 1,
          completed: false,
          skipped: false,
          tourCompleted: false,
          tourDismissed: false,
          completedSteps: JSON.stringify([]),
        },
      });

      return { user, workspace, membership, onboarding };
    });

    await recordAuditLog({
      workspaceId: result.workspace.id,
      userId: result.user.id,
      userEmail: result.user.email,
      action: "USER_REGISTERED",
      details: `Account created and workspace '${result.workspace.name}' provisioned`,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    // Record verified conversion funnel stages
    try {
      const { recordFunnelEvent } = await import("@/lib/funnel-analytics");
      const userIp = req.headers.get("x-forwarded-for") || "127.0.0.1";
      const sessId = `usr_${result.user.id}`;
      // Stage 4: Signup Completed
      await recordFunnelEvent({
        sessionId: sessId,
        stage: "SIGNUP_COMPLETED",
        eventName: "account_registered",
        userId: result.user.id,
        workspaceId: result.workspace.id,
        path: "/register",
        ipAddress: userIp,
      });
      // Stage 5: Workspace Provisioned
      await recordFunnelEvent({
        sessionId: sessId,
        stage: "ORG_WORKSPACE_CREATED",
        eventName: "workspace_provisioned",
        userId: result.user.id,
        workspaceId: result.workspace.id,
        path: "/register",
        metadata: { plan: result.workspace.plan },
        ipAddress: userIp,
      });
      // Stage 7: Trial Started (14-day starter trial)
      await recordFunnelEvent({
        sessionId: sessId,
        stage: "TRIAL_STARTED",
        eventName: "trial_initiated",
        userId: result.user.id,
        workspaceId: result.workspace.id,
        path: "/register",
        metadata: { plan: "STARTER", durationDays: 14 },
        ipAddress: userIp,
      });
    } catch {
      // Analytics non-blocking
    }

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

    // Asynchronously dispatch welcome notification & email
    try {
      const { triggerNotification } = await import("@/lib/notification-dispatcher");
      await triggerNotification({
        workspaceId: result.workspace.id,
        userId: result.user.id,
        recipientEmail: result.user.email,
        title: `Welcome to PulseFlow, ${result.user.name}!`,
        message: `Your workspace "${result.workspace.name}" is now ready. Start ingesting telemetry or invite your team.`,
        type: "SUCCESS",
        link: "/dashboard",
        emailEventType: "WELCOME",
        idempotencyKey: `welcome_${result.user.id}`,
        emailDetails: {
          "Account Name": result.user.name,
          "Primary Workspace": result.workspace.name,
          "Tier": result.workspace.plan,
        },
      });
    } catch (e) {
      console.warn("Welcome notification dispatch deferred:", e);
    }

    return response;
  } catch (error) {
    console.error("Register API error:", error);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
