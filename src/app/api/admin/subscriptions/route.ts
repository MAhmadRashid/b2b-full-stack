import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const tier = searchParams.get("tier") || "ALL";
    const status = searchParams.get("status") || "ALL"; // ALL, ACTIVE, PAST_DUE, CANCELED
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (tier !== "ALL") {
      where.tier = tier.toUpperCase();
    }

    if (status !== "ALL") {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { billingEmail: { contains: search } },
        { stripeSubscriptionId: { contains: search } },
        { organization: { name: { contains: search } } },
        { workspace: { name: { contains: search } } },
      ];
    }

    const [total, subscriptions, invoiceStats] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, plan: true, suspended: true },
          },
          workspace: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { amountCents: true },
      }),
    ]);

    // Fetch recent 10 invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { name: true, slug: true } },
        workspace: { select: { name: true, slug: true } },
      },
    });

    return NextResponse.json({
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        tier: sub.tier,
        billingCycle: sub.billingCycle,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        stripeCustomerId: sub.stripeCustomerId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        billingEmail: sub.billingEmail,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        organization: sub.organization,
        workspace: sub.workspace,
      })),
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amountCents: inv.amountCents,
        amountFormatted: `$${(inv.amountCents / 100).toFixed(2)}`,
        currency: inv.currency,
        status: inv.status,
        billingEmail: inv.billingEmail,
        paymentMethod: inv.paymentMethod,
        createdAt: inv.createdAt,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        entityName: inv.organization?.name || inv.workspace?.name || "System Account",
      })),
      stats: {
        invoiceBreakdown: invoiceStats,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Superadmin subscriptions listing error:", error);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}
