import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const plan = searchParams.get("plan") || "ALL";
    const status = searchParams.get("status") || "ALL"; // ALL, ACTIVE, SUSPENDED
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { billingEmail: { contains: search } },
      ];
    }

    if (plan !== "ALL") {
      where.plan = plan.toUpperCase();
    }

    if (status === "ACTIVE") {
      where.suspended = false;
    } else if (status === "SUSPENDED") {
      where.suspended = true;
    }

    const [total, orgs] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          subscription: true,
          workspaces: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              requestsThisMonth: true,
              monthlyRequestLimit: true,
            },
          },
          _count: {
            select: {
              members: true,
              workspaces: true,
              apiKeys: true,
              invoices: true,
              apiRequestLogs: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      organizations: orgs.map((org) => {
        const totalRequestsThisMonth = org.workspaces.reduce(
          (sum, ws) => sum + ws.requestsThisMonth,
          0
        );
        const totalLimit = org.workspaces.reduce(
          (sum, ws) => sum + ws.monthlyRequestLimit,
          0
        );

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          logoUrl: org.logoUrl,
          billingEmail: org.billingEmail,
          suspended: org.suspended,
          suspensionReason: org.suspensionReason,
          stripeCustomerId: org.stripeCustomerId,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          owner: org.owner,
          subscription: org.subscription
            ? {
                id: org.subscription.id,
                tier: org.subscription.tier,
                billingCycle: org.subscription.billingCycle,
                status: org.subscription.status,
                currentPeriodEnd: org.subscription.currentPeriodEnd,
                cancelAtPeriodEnd: org.subscription.cancelAtPeriodEnd,
              }
            : null,
          memberCount: org._count.members,
          workspaceCount: org._count.workspaces,
          apiKeyCount: org._count.apiKeys,
          invoiceCount: org._count.invoices,
          workspaces: org.workspaces,
          usage: {
            requestsThisMonth: totalRequestsThisMonth,
            monthlyLimit: totalLimit,
            percentUsed: totalLimit > 0 ? Math.min(100, Math.round((totalRequestsThisMonth / totalLimit) * 100)) : 0,
          },
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Superadmin organizations listing error:", error);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}
