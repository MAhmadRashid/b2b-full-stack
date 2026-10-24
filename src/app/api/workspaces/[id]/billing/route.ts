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

    const plans = [
      {
        id: "STARTER",
        name: "Developer Starter",
        priceMonthly: 0,
        priceAnnual: 0,
        requestLimit: 50000,
        features: ["50K Requests / mo", "Single Workspace", "1 Active API Key", "24-Hour Telemetry Retention", "Community Support"],
      },
      {
        id: "PRO",
        name: "Growth Pro",
        priceMonthly: 99,
        priceAnnual: 79,
        requestLimit: 250000,
        features: ["250K Requests / mo", "Up to 10 Team Members", "10 Active API Keys", "30-Day Telemetry Retention", "Granular RBAC", "Priority Email Support"],
      },
      {
        id: "ENTERPRISE",
        name: "Scale Enterprise",
        priceMonthly: 399,
        priceAnnual: 319,
        requestLimit: 1000000,
        features: ["1M+ Requests / mo", "Unlimited Team Members", "Unlimited API Keys", "1-Year Data Retention", "99.99% SLA Uptime", "Dedicated Solutions Architect", "Custom Webhook Dispatchers"],
      },
    ];

    return NextResponse.json({
      currentPlan: workspace.plan,
      billingCycle: workspace.billingCycle,
      subscriptionStatus: workspace.subscriptionStatus,
      requestsThisMonth: workspace.requestsThisMonth,
      monthlyLimit: workspace.monthlyRequestLimit,
      plans,
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

    const planLimits: Record<string, number> = {
      STARTER: 50000,
      PRO: 250000,
      ENTERPRISE: 1000000,
    };

    const planPrices: Record<string, number> = {
      STARTER: 0,
      PRO: 9900,
      ENTERPRISE: 39900,
    };

    if (!planLimits[targetPlan]) {
      return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
    }

    const updatedWorkspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.update({
        where: { id },
        data: {
          plan: targetPlan,
          billingCycle,
          monthlyRequestLimit: planLimits[targetPlan],
        },
      });

      // If paid plan, generate an invoice receipt
      if (planPrices[targetPlan] > 0) {
        const invNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await tx.invoice.create({
          data: {
            workspaceId: id,
            invoiceNumber: invNum,
            amountCents: planPrices[targetPlan],
            currency: "USD",
            status: "PAID",
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
      details: `Plan changed to ${targetPlan} (${billingCycle}) with limit ${planLimits[targetPlan].toLocaleString()}`,
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
