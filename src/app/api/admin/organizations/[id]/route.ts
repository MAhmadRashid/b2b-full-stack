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
    const { action, reason, plan } = body; // action: "SUSPEND" | "REACTIVATE" | "CHANGE_PLAN"

    const targetOrg = await prisma.organization.findUnique({
      where: { id },
      include: {
        subscription: true,
      },
    });

    if (!targetOrg) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (action === "SUSPEND") {
      const suspensionReason = reason?.trim() || "Organization suspended by platform administration";
      const updated = await prisma.organization.update({
        where: { id },
        data: {
          suspended: true,
          suspensionReason,
        },
      });

      await recordAuditLog({
        organizationId: id,
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "ORGANIZATION_SUSPENDED",
        details: `Superadmin suspended organization ${targetOrg.name} (${targetOrg.slug}). Reason: ${suspensionReason}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `Organization ${targetOrg.name} has been suspended`,
        organization: { id: updated.id, name: updated.name, suspended: updated.suspended, suspensionReason },
      });
    }

    if (action === "REACTIVATE") {
      const updated = await prisma.organization.update({
        where: { id },
        data: {
          suspended: false,
          suspensionReason: null,
        },
      });

      await recordAuditLog({
        organizationId: id,
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "ORGANIZATION_REACTIVATED",
        details: `Superadmin reactivated organization ${targetOrg.name} (${targetOrg.slug})`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `Organization ${targetOrg.name} has been reactivated`,
        organization: { id: updated.id, name: updated.name, suspended: updated.suspended },
      });
    }

    if (action === "CHANGE_PLAN") {
      const validPlans = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];
      const newPlan = plan?.toUpperCase();
      if (!validPlans.includes(newPlan)) {
        return NextResponse.json(
          { error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` },
          { status: 400 }
        );
      }

      const updated = await prisma.organization.update({
        where: { id },
        data: { plan: newPlan },
      });

      if (targetOrg.subscription) {
        await prisma.subscription.update({
          where: { organizationId: id },
          data: { tier: newPlan },
        });
      }

      await recordAuditLog({
        organizationId: id,
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "PLAN_CHANGED",
        details: `Superadmin adjusted organization ${targetOrg.name} plan from ${targetOrg.plan} to ${newPlan}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `Organization ${targetOrg.name} plan updated to ${newPlan}`,
        organization: { id: updated.id, name: updated.name, plan: updated.plan },
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: SUSPEND, REACTIVATE, CHANGE_PLAN" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Superadmin organization action error:", error);
    return NextResponse.json({ error: "Failed to perform organization action" }, { status: 500 });
  }
}
