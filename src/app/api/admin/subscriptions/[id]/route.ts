import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action, reason } = body; // action: "CANCEL_IMMEDIATE" | "CANCEL_AT_PERIOD_END" | "MARK_PAST_DUE" | "REACTIVATE"

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const entityName = sub.organization?.name || sub.workspace?.name || sub.id;

    if (action === "CANCEL_IMMEDIATE") {
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          tier: "FREE",
          status: "CANCELED",
          cancelAtPeriodEnd: false,
        },
      });

      // Synchronize parent organization or workspace plan tier to FREE
      if (sub.organizationId) {
        await prisma.organization.update({
          where: { id: sub.organizationId },
          data: { plan: "FREE" },
        });
      }
      if (sub.workspaceId) {
        await prisma.workspace.update({
          where: { id: sub.workspaceId },
          data: { plan: "FREE" },
        });
      }

      await recordAuditLog({
        organizationId: sub.organizationId || undefined,
        workspaceId: sub.workspaceId || undefined,
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "SUBSCRIPTION_CANCELED",
        details: `Superadmin immediately canceled subscription for ${entityName}. Reverted to FREE tier. Reason: ${reason || "Admin intervention"}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `Subscription for ${entityName} immediately canceled and revoked to FREE`,
        subscription: updated,
      });
    }

    if (action === "CANCEL_AT_PERIOD_END") {
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          cancelAtPeriodEnd: true,
        },
      });

      await recordAuditLog({
        organizationId: sub.organizationId || undefined,
        workspaceId: sub.workspaceId || undefined,
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "SUBSCRIPTION_UPDATED",
        details: `Superadmin scheduled cancellation at period end for ${entityName}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `Subscription for ${entityName} will terminate at period end`,
        subscription: updated,
      });
    }

    if (action === "MARK_PAST_DUE") {
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: "PAST_DUE",
        },
      });

      await recordAuditLog({
        organizationId: sub.organizationId || undefined,
        workspaceId: sub.workspaceId || undefined,
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "SUBSCRIPTION_UPDATED",
        details: `Superadmin flagged subscription for ${entityName} as PAST_DUE due to payment failure`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `Subscription for ${entityName} status marked as PAST_DUE`,
        subscription: updated,
      });
    }

    if (action === "REACTIVATE") {
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
        },
      });

      await recordAuditLog({
        organizationId: sub.organizationId || undefined,
        workspaceId: sub.workspaceId || undefined,
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "SUBSCRIPTION_UPDATED",
        details: `Superadmin reactivated subscription for ${entityName}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `Subscription for ${entityName} restored to ACTIVE`,
        subscription: updated,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported: CANCEL_IMMEDIATE, CANCEL_AT_PERIOD_END, MARK_PAST_DUE, REACTIVATE" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Superadmin subscription action error:", error);
    return NextResponse.json({ error: "Failed to perform subscription action" }, { status: 500 });
  }
}
