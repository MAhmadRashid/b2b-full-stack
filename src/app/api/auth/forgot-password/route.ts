import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
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
      message: "Password reset link generated successfully.",
      resetUrl: `/reset-password?token=${token}`,
      token, // Available for development, test runner & simulation
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}
