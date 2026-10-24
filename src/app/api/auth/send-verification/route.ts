import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const targetEmail = (body.email || session?.email)?.toLowerCase().trim();

    if (!targetEmail || !targetEmail.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "This email address is already verified.",
        alreadyVerified: true,
      });
    }

    // Invalidate prior verification tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { email: targetEmail },
    });

    // 24-hour expiration token
    const token = `vfy_${crypto.randomBytes(24).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.verificationToken.create({
      data: {
        email: targetEmail,
        token,
        expiresAt,
      },
    });

    await recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "VERIFICATION_EMAIL_DISPATCHED",
      details: `Generated verification token for ${user.email}`,
    });

    return NextResponse.json({
      success: true,
      message: "Verification link generated.",
      verificationUrl: `/verify-email?token=${token}`,
      token,
    });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json(
      { error: "Failed to create verification token" },
      { status: 500 }
    );
  }
}
