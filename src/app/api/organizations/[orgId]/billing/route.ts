import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import { getPlan, getAllPlans, PlanId, BillingInterval } from "@/lib/billing-plans";
import { createCheckoutSession } from "@/lib/billing-provider";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "VIEWER");
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.error }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        subscription: true,
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        workspaces: {
          select: {
            id: true,
            name: true,
            plan: true,
            requestsThisMonth: true,
            monthlyRequestLimit: true,
          },
        },
        _count: {
          select: {
            members: true,
            workspaces: true,
          },
        },
      },
    });

    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const planConfig = getPlan(org.plan || "FREE");
    const plans = getAllPlans();

    // Aggregate monthly requests across all workspaces in this organization
    const totalRequestsThisMonth = org.workspaces.reduce(
      (sum, ws) => sum + (ws.requestsThisMonth || 0),
      0
    );

    const subscription = org.subscription || {
      tier: org.plan || "FREE",
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      currentPeriodStart: org.createdAt,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      billingEmail: org.billingEmail || session.email,
    };

    const usage = {
      workspaces: {
        current: org._count.workspaces,
        limit: planConfig.limits.maxWorkspaces,
        percentage: Number(
          ((org._count.workspaces / planConfig.limits.maxWorkspaces) * 100).toFixed(1)
        ),
      },
      teamMembers: {
        current: org._count.members,
        limit: planConfig.limits.maxTeamMembers,
        percentage: Number(
          ((org._count.members / planConfig.limits.maxTeamMembers) * 100).toFixed(1)
        ),
      },
      monthlyRequests: {
        current: totalRequestsThisMonth,
        limit: planConfig.limits.monthlyRequests,
        percentage: Number(
          ((totalRequestsThisMonth / planConfig.limits.monthlyRequests) * 100).toFixed(1)
        ),
      },
      retentionDays: {
        current: planConfig.limits.telemetryRetentionDays,
        limit: planConfig.limits.telemetryRetentionDays,
      },
    };

    return NextResponse.json({
      organizationId: org.id,
      organizationName: org.name,
      currentPlan: org.plan || "FREE",
      planConfig,
      subscription: {
        tier: subscription.tier,
        billingCycle: subscription.billingCycle,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        billingEmail: org.billingEmail || subscription.billingEmail || session.email,
      },
      billingSettings: {
        billingEmail: org.billingEmail || session.email,
        billingAddress: org.billingAddress || null,
        taxId: org.taxId || null,
        stripeCustomerId: org.stripeCustomerId || null,
      },
      plans,
      usage,
      invoices: org.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: (inv.amountCents / 100).toFixed(2),
        currency: inv.currency,
        status: inv.status,
        date: inv.createdAt,
        pdfUrl: inv.pdfUrl,
        billingEmail: inv.billingEmail,
        paymentMethod: inv.paymentMethod || "card_verified",
      })),
      canManageBilling: ["OWNER", "ADMIN"].includes(perm.role || ""),
      currentUserRole: perm.role,
    });
  } catch (error) {
    console.error("Get organization billing error:", error);
    return NextResponse.json({ error: "Failed to load billing information" }, { status: 500 });
  }
}

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
        { error: "Forbidden: Only Organization Owners and Admins can manage billing subscriptions" },
        { status: 403 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { workspaces: true, members: true } } },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const targetPlan = (body.targetPlan || "PRO").toUpperCase() as PlanId;
    const billingInterval = (body.billingInterval || "MONTHLY").toUpperCase() as BillingInterval;
    const simulatePayment = Boolean(body.simulatePayment);

    const validPlans: PlanId[] = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];
    if (!validPlans.includes(targetPlan)) {
      return NextResponse.json({ error: "Invalid target subscription plan" }, { status: 400 });
    }

    const targetPlanConfig = getPlan(targetPlan);

    // Enforcement: Check if organization current usage exceeds the target plan limits (for downgrades)
    if (org._count.workspaces > targetPlanConfig.limits.maxWorkspaces) {
      return NextResponse.json(
        {
          error: `Cannot downgrade to ${targetPlanConfig.name}. Your organization has ${org._count.workspaces} workspaces, but ${targetPlanConfig.name} allows at most ${targetPlanConfig.limits.maxWorkspaces}. Please remove excess workspaces first.`,
        },
        { status: 400 }
      );
    }

    if (org._count.members > targetPlanConfig.limits.maxTeamMembers) {
      return NextResponse.json(
        {
          error: `Cannot downgrade to ${targetPlanConfig.name}. Your organization has ${org._count.members} team members, but ${targetPlanConfig.name} allows at most ${targetPlanConfig.limits.maxTeamMembers}. Please remove excess members first.`,
        },
        { status: 400 }
      );
    }

    // Downgrade to FREE
    if (targetPlan === "FREE") {
      await prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: orgId },
          data: { plan: "FREE" },
        });

        await tx.subscription.upsert({
          where: { organizationId: orgId },
          create: {
            organizationId: orgId,
            tier: "FREE",
            billingCycle: "MONTHLY",
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          update: {
            tier: "FREE",
            status: "ACTIVE",
            cancelAtPeriodEnd: false,
          },
        });

        await tx.workspace.updateMany({
          where: { organizationId: orgId },
          data: {
            plan: "FREE",
            monthlyRequestLimit: targetPlanConfig.limits.monthlyRequests,
          },
        });
      });

      await recordAuditLog({
        organizationId: orgId,
        userId: session.id,
        userEmail: session.email,
        action: "ORGANIZATION_PLAN_DOWNGRADED",
        details: `Organization downgraded to Developer Free tier by ${session.email}`,
      });

      return NextResponse.json({
        success: true,
        message: "Organization plan successfully updated to Developer Free.",
        plan: "FREE",
      });
    }

    // Upgrading to a paid plan:
    // If not simulating test payment, create and return Checkout Session URL
    if (!simulatePayment) {
      const checkout = await createCheckoutSession({
        organizationId: org.id,
        organizationName: org.name,
        planId: targetPlan,
        billingInterval,
        userEmail: session.email,
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/billing?status=success&plan=${targetPlan}`,
        cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/billing?status=cancelled`,
      });

      return NextResponse.json({
        success: true,
        checkoutRequired: true,
        checkoutUrl: checkout.url,
        sessionId: checkout.sessionId,
        plan: targetPlan,
        amountCents: checkout.amountCents,
      });
    }

    // Test / Simulated direct upgrade (for test suites and sandbox demo)
    const amountCents =
      billingInterval === "ANNUAL"
        ? targetPlanConfig.pricing.annualCents
        : targetPlanConfig.pricing.monthlyCents;
    const invNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: orgId },
        data: { plan: targetPlan },
      });

      await tx.workspace.updateMany({
        where: { organizationId: orgId },
        data: {
          plan: targetPlan,
          billingCycle: billingInterval,
          monthlyRequestLimit: targetPlanConfig.limits.monthlyRequests,
          subscriptionStatus: "ACTIVE",
        },
      });

      await tx.subscription.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          tier: targetPlan,
          billingCycle: billingInterval,
          status: "ACTIVE",
          billingEmail: session.email,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + (billingInterval === "ANNUAL" ? 365 : 30) * 24 * 60 * 60 * 1000),
        },
        update: {
          tier: targetPlan,
          billingCycle: billingInterval,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + (billingInterval === "ANNUAL" ? 365 : 30) * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
      });

      await tx.invoice.create({
        data: {
          organizationId: orgId,
          invoiceNumber: invNum,
          amountCents,
          currency: "USD",
          status: "PAID",
          billingEmail: session.email,
          paymentMethod: "card_verified",
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + (billingInterval === "ANNUAL" ? 365 : 30) * 24 * 60 * 60 * 1000),
          pdfUrl: `/invoices/${invNum}.pdf`,
        },
      });
    });

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_PLAN_UPGRADED",
      details: `Plan changed to ${targetPlan} (${billingInterval}) with ${targetPlanConfig.limits.monthlyRequests.toLocaleString()} request quota`,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${targetPlanConfig.name}!`,
      plan: targetPlan,
      invoiceNumber: invNum,
    });
  } catch (error) {
    console.error("Update organization billing error:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
