import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) {
      return NextResponse.json(
        { error: "Forbidden: Only Organization Owners and Admins can cancel subscriptions" },
        { status: 403 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { subscription: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!org.subscription || org.plan === "FREE") {
      return NextResponse.json(
        { error: "This organization is already on the Free tier and has no active paid subscription." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const immediate = Boolean(body.immediate);

    if (immediate) {
      // Immediate cancellation
      await prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: orgId },
          data: { plan: "FREE" },
        });

        await tx.subscription.updateMany({
          where: { organizationId: orgId },
          data: {
            tier: "FREE",
            status: "CANCELED",
            cancelAtPeriodEnd: false,
          },
        });

        await tx.workspace.updateMany({
          where: { organizationId: orgId },
          data: {
            plan: "FREE",
            monthlyRequestLimit: 10000,
            subscriptionStatus: "CANCELED",
          },
        });
      });

      await recordAuditLog({
        organizationId: orgId,
        userId: session.id,
        userEmail: session.email,
        action: "ORGANIZATION_SUBSCRIPTION_CANCELED_IMMEDIATE",
        details: `Subscription immediately canceled and reverted to Free tier by ${session.email}`,
      });

      return NextResponse.json({
        success: true,
        message: "Your subscription has been canceled immediately and your account reverted to the Developer Free plan.",
        cancelAtPeriodEnd: false,
        status: "CANCELED",
      });
    }

    // Schedule cancellation at period end (standard SaaS cancellation flow)
    const updatedSub = await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_SUBSCRIPTION_CANCEL_SCHEDULED",
      details: `Scheduled subscription cancellation at period end (${updatedSub.currentPeriodEnd.toISOString()}) by ${session.email}`,
    });

    return NextResponse.json({
      success: true,
      message: `Your subscription is scheduled for cancellation at the end of the billing period on ${new Date(
        updatedSub.currentPeriodEnd
      ).toLocaleDateString()}. You retain full access until then.`,
      cancelAtPeriodEnd: true,
      periodEnd: updatedSub.currentPeriodEnd,
    });
  } catch (error) {
    console.error("Cancel organization subscription error:", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
