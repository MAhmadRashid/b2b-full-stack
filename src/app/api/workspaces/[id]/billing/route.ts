import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "VIEWER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const { getAllPlans, getPlan } = await import("@/lib/billing-plans");
    const plans = getAllPlans();

    return NextResponse.json({
      currentPlan: workspace.plan,
      billingCycle: workspace.billingCycle,
      subscriptionStatus: workspace.subscriptionStatus,
      requestsThisMonth: workspace.requestsThisMonth,
      monthlyLimit: workspace.monthlyRequestLimit,
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceMonthly: p.pricing.monthlyCents / 100,
        priceAnnual: p.pricing.annualMonthlyEquivalentCents / 100,
        requestLimit: p.limits.monthlyRequests,
        features: p.features,
      })),
      invoices: workspace.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: (inv.amountCents / 100).toFixed(2),
        currency: inv.currency,
        status: inv.status,
        date: inv.createdAt,
        pdfUrl: inv.pdfUrl,
      })),
      canManageBilling: ["OWNER", "ADMIN"].includes(perm.role || ""),
    });
  } catch (error) {
    console.error("Get billing error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: "Only the workspace owner can modify billing plans" }, { status: 403 });
    }

    const body = await req.json();
    const { targetPlan, billingCycle = "MONTHLY" } = body;

    const { getPlan } = await import("@/lib/billing-plans");
    const planConfig = getPlan(targetPlan);

    const priceCents =
      billingCycle === "ANNUAL"
        ? planConfig.pricing.annualCents
        : planConfig.pricing.monthlyCents;

    const updatedWorkspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.update({
        where: { id },
        data: {
          plan: planConfig.id,
          billingCycle,
          monthlyRequestLimit: planConfig.limits.monthlyRequests,
        },
      });

      // If paid plan, generate an invoice receipt
      if (priceCents > 0) {
        const invNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await tx.invoice.create({
          data: {
            workspaceId: id,
            organizationId: ws.organizationId,
            invoiceNumber: invNum,
            amountCents: priceCents,
            currency: "USD",
            status: "PAID",
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + (billingCycle === "ANNUAL" ? 365 : 30) * 24 * 60 * 60 * 1000),
            pdfUrl: `/invoices/${invNum}.pdf`,
          },
        });
      }

      return ws;
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "WORKSPACE_PLAN_CHANGED",
      details: `Plan changed to ${targetPlan} (${billingCycle}) with limit ${planConfig.limits.monthlyRequests.toLocaleString()} requests/month`,
    });

    return NextResponse.json({
      success: true,
      workspace: updatedWorkspace,
      message: `Successfully upgraded to ${targetPlan} plan`,
    });
  } catch (error) {
    console.error("Update billing error:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
