import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const [
      userCount,
      orgCount,
      workspaceCount,
      activeSubs,
      totalEvents,
      activeApiKeys,
      paidInvoices,
      allSubscriptions,
      recentUsers,
      recentSubscriptions,
      recentAudits,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.workspace.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.metricEvent.count(),
      prisma.apiKey.count({ where: { revoked: false } }),
      prisma.invoice.findMany({
        where: { status: "PAID" },
        select: { amountCents: true, createdAt: true },
      }),
      prisma.subscription.findMany({
        select: { tier: true, billingCycle: true, status: true },
      }),
      prisma.user.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          suspended: true,
          createdAt: true,
          _count: { select: { orgMemberships: true, memberships: true } },
        },
      }),
      prisma.subscription.findMany({
        take: 8,
        orderBy: { updatedAt: "desc" },
        include: {
          organization: { select: { name: true, slug: true } },
          workspace: { select: { name: true, slug: true } },
        },
      }),
      prisma.auditLog.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Calculate MRR from active subscriptions and total historical paid revenue
    const tierMonthlyPricing: Record<string, number> = {
      FREE: 0,
      STARTER: 2900,
      PRO: 7900,
      BUSINESS: 19900,
      ENTERPRISE: 49900,
    };

    let calculatedMrrCents = 0;
    for (const sub of allSubscriptions) {
      if (sub.status === "ACTIVE" && sub.tier !== "FREE") {
        const baseMonthly = tierMonthlyPricing[sub.tier] || 0;
        calculatedMrrCents += sub.billingCycle === "ANNUAL" ? Math.round(baseMonthly * 0.8) : baseMonthly;
      }
    }

    const totalRevenueCents = paidInvoices.reduce((sum, inv) => sum + inv.amountCents, 0);

    // Aggregate daily registrations for the past 7 days using real data
    const now = new Date();
    const past7Days: { date: string; users: number; events: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const dateStr = startOfDay.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const [usersRegistered, dayEvents] = await Promise.all([
        prisma.user.count({
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        }),
        prisma.metricEvent.count({
          where: {
            timestamp: { gte: startOfDay, lte: endOfDay },
          },
        }),
      ]);

      past7Days.push({
        date: dateStr,
        users: usersRegistered,
        events: dayEvents,
      });
    }

    return NextResponse.json({
      metrics: {
        totalUsers: userCount,
        totalOrganizations: orgCount,
        totalWorkspaces: workspaceCount,
        activeSubscriptions: activeSubs,
        totalEventsIngested: totalEvents,
        activeApiKeys,
        mrrCents: calculatedMrrCents,
        mrrFormatted: `$${(calculatedMrrCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalRevenueCents,
        totalRevenueFormatted: `$${(totalRevenueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      // Backwards-compatibility alias for existing test suites and integrations
      stats: {
        totalUsers: userCount,
        totalWorkspaces: workspaceCount,
        activeApiKeys,
        totalEventsIngested: totalEvents,
      },
      charts: {
        past7Days,
      },
      recentRegistrations: recentUsers,
      recentSubscriptions,
      recentAudits,
    });
  } catch (error) {
    console.error("Superadmin overview error:", error);
    return NextResponse.json({ error: "Failed to load superadmin overview" }, { status: 500 });
  }
}
