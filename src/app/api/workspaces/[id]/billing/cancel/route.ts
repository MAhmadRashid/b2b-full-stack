import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "OWNER");
    if (!perm.allowed) {
      return NextResponse.json(
        { error: "Forbidden: Only the workspace OWNER can cancel a subscription" },
        { status: 403 }
      );
    }

    let subscription = await prisma.subscription.findUnique({
      where: { workspaceId: id },
    });

    if (!subscription) {
      const ws = await prisma.workspace.findUnique({ where: { id } });
      if (ws) {
        subscription = await prisma.subscription.create({
          data: {
            workspaceId: id,
            tier: ws.plan || "PRO",
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            cancelAtPeriodEnd: false,
          },
        });
      }
    }

    if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status.toUpperCase())) {
      return NextResponse.json(
        { error: "No active paid subscription found to cancel" },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction([
      prisma.subscription.update({
        where: { workspaceId: id },
        data: { cancelAtPeriodEnd: true },
      }),
      prisma.notification.create({
        data: {
          workspaceId: id,
          title: "Subscription Scheduled for Cancellation",
          message: `Your subscription will remain active until ${subscription.currentPeriodEnd.toLocaleDateString()}, after which it will revert to Starter.`,
          type: "WARNING",
          link: "/dashboard/billing",
        },
      }),
    ]);

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
      details: `Scheduled cancellation for end of period (${subscription.currentPeriodEnd.toISOString()})`,
    });

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: updated[0].cancelAtPeriodEnd,
      message: "Subscription scheduled for cancellation at period end",
      subscription: updated[0],
    });
  } catch (error) {
    console.error("Cancel billing error:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
