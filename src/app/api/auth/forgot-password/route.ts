import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const isLoopback = ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";
    const rl = checkRateLimit(`forgot_password_${ip}`, {
      limit: isLoopback ? 2000 : 15,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many password reset requests. Please wait before trying again."
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Return a safe response so email enumeration is mitigated
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been created.",
      });
    }

    // Invalidate any existing reset tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: normalizedEmail },
    });

    // Generate secure token with 1-hour expiration
    const token = `rst_${crypto.randomBytes(24).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt,
      },
    });

    await recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "PASSWORD_RESET_REQUESTED",
      details: `Password reset token generated for ${user.email}`,
    });

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been created.",
      ...(process.env.NODE_ENV !== "production"
        ? {
            resetUrl: `/reset-password?token=${token}`,
            token, // Only available for automated tests & dev simulation
          }
        : {}),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}
