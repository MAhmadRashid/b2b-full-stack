import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { organization: true },
    });

    if (!invitation || invitation.organizationId !== orgId) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Refresh token and extend validity by 7 days
    const rawToken = `inv_org_${crypto.randomBytes(24).toString("hex")}`;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token: rawToken,
        tokenHash,
        expiresAt,
        status: "PENDING",
      },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${rawToken}`;

    const emailResult = await sendInvitationEmail({
      to: updated.email,
      inviterName: session.name,
      inviterEmail: session.email,
      targetName: invitation.organization?.name || "Organization",
      targetType: "organization",
      role: updated.role,
      inviteUrl,
    });

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_INVITATION_RESENT",
      details: `Renewed invitation for ${updated.email} (Expires: ${expiresAt.toISOString()})`,
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
        emailDelivered: emailResult.delivered,
        emailDeliveryStatus: emailResult.simulated ? "simulated" : emailResult.delivered ? "delivered" : "failed",
      },
    });
  } catch (error) {
    console.error("Resend organization invitation error:", error);
    return NextResponse.json({ error: "Failed to renew invitation" }, { status: 500 });
  }
}
