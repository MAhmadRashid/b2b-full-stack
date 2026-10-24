import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handleVerification(req);
}

export async function POST(req: NextRequest) {
  return handleVerification(req);
}

async function handleVerification(req: NextRequest) {
  try {
    let token = req.nextUrl.searchParams.get("token");

    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    const verificationRecord = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationRecord) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      );
    }

    if (new Date(verificationRecord.expiresAt) < new Date()) {
      await prisma.verificationToken.delete({ where: { id: verificationRecord.id } });
      return NextResponse.json(
        { error: "Verification link has expired. Please request a new verification email." },
        { status: 410 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: verificationRecord.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Associated user not found" }, { status: 404 });
    }

    const verifiedDate = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: verifiedDate },
      }),
      prisma.verificationToken.delete({
        where: { id: verificationRecord.id },
      }),
    ]);

    await recordAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: "EMAIL_VERIFIED",
      details: `Email ${user.email} marked as verified at ${verifiedDate.toISOString()}`,
    });

    return NextResponse.json({
      success: true,
      message: "Email address verified successfully!",
      verifiedAt: verifiedDate.toISOString(),
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email address" },
      { status: 500 }
    );
  }
}
