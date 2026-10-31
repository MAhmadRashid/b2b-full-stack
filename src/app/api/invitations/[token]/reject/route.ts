import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.invitation.findFirst({
      where: {
        OR: [{ token }, { tokenHash }],
      },
      include: { workspace: true, organization: true },
    });

    if (!invitation || invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Invitation not found or has already been resolved" },
        { status: 404 }
      );
    }

    // Mark as REJECTED to invalidate token
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "REJECTED" },
    });

    await recordAuditLog({
      workspaceId: invitation.workspaceId || null,
      organizationId: invitation.organizationId || invitation.workspace?.organizationId || null,
      action: "INVITATION_REJECTED",
      details: `Invitation for ${invitation.email} was declined by recipient`,
    });

    return NextResponse.json({
      success: true,
      message: "Invitation declined successfully.",
    });
  } catch (error) {
    console.error("Reject invitation error:", error);
    return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
  }
}
