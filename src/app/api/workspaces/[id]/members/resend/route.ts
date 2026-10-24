import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";

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

    const body = await req.json().catch(() => ({}));
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    }

    const existing = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!existing || existing.workspaceId !== id) {
      return NextResponse.json({ error: "Invitation record not found" }, { status: 404 });
    }

    // Refresh token and extend validity by 7 days
    const newToken = `inv_${crypto.randomBytes(24).toString("hex")}`;
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        status: "PENDING",
      },
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "INVITATION_RESENT",
      details: `Renewed invitation for ${existing.email} (New Token: ${newToken.slice(0, 10)}...)`,
    });

    return NextResponse.json({
      success: true,
      message: "Invitation refreshed and renewed successfully.",
      invitation: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        token: updated.token,
        inviteUrl: `/invite/${updated.token}`,
        expiresAt: updated.expiresAt,
      },
    });
  } catch (error) {
    console.error("Resend invitation error:", error);
    return NextResponse.json({ error: "Failed to renew invitation" }, { status: 500 });
  }
}
