import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found or has already been resolved" },
        { status: 404 }
      );
    }

    // Mark as REJECTED or delete
    await prisma.invitation.delete({
      where: { id: invitation.id },
    });

    await recordAuditLog({
      workspaceId: invitation.workspaceId,
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
