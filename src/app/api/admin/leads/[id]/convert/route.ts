import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { logger } from "@/lib/logger";
import { recordAuditLog } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/leads/[id]/convert
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireSuperAdmin(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { targetPlan = "PRO", customWorkspaceName } = body;

    const lead = await prisma.leadSubmission.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead record not found" }, { status: 404 });
    }

    if (lead.status === "CONVERTED") {
      return NextResponse.json(
        { error: "This lead has already been converted to a customer workspace.", isConverted: true },
        { status: 400 }
      );
    }

    const normalizedEmail = lead.workEmail.toLowerCase().trim();

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { memberships: true },
    });

    let workspace: any = null;

    if (user) {
      // User exists. Look for an existing workspace or provision an enterprise/pro workspace
      const existingMembership = await prisma.membership.findFirst({
        where: { userId: user.id, role: "OWNER" },
        include: { workspace: true },
      });

      if (existingMembership && existingMembership.workspace) {
        workspace = existingMembership.workspace;
        // Upgrade workspace plan if needed
        if (workspace.plan !== targetPlan) {
          workspace = await prisma.workspace.update({
            where: { id: workspace.id },
            data: { plan: targetPlan },
          });
        }
      } else {
        // Provision workspace for existing user
        const wsName = customWorkspaceName || `${lead.company} Workspace`;
        const slug = wsName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") + `-${Math.random().toString(36).substring(2, 6)}`;

        workspace = await prisma.workspace.create({
          data: {
            name: wsName,
            slug,
            plan: targetPlan,
            creatorId: user.id,
            monthlyRequestLimit: targetPlan === "BUSINESS" ? 1000000 : 250000,
          },
        });

        await prisma.membership.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            role: "OWNER",
          },
        });
      }
    } else {
      // User does not exist yet. Check if caller wants an invitation dispatch link or account linking
      return NextResponse.json(
        {
          error: "No registered user account found for this lead's work email. The lead must first sign up via verified invitation or registration before linking as a converted customer.",
          actionRequired: "INVITE_OR_SIGNUP",
          email: lead.workEmail,
        },
        { status: 422 }
      );
    }

    // Update lead record to CONVERTED with linked customer IDs and history
    let history: any[] = [];
    try {
      history = JSON.parse(lead.contactHistory || "[]");
    } catch {
      history = [];
    }

    history.unshift({
      timestamp: new Date().toISOString(),
      author: authResult.user.name || authResult.user.email,
      note: `Converted lead to customer on ${targetPlan} plan (Workspace: ${workspace.name})`,
      action: "CONVERTED",
    });

    const updatedLead = await prisma.leadSubmission.update({
      where: { id },
      data: {
        status: "CONVERTED",
        convertedAt: new Date(),
        convertedUserId: user.id,
        convertedWorkspaceId: workspace.id,
        contactHistory: JSON.stringify(history),
      },
    });

    await recordAuditLog({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      workspaceId: workspace.id,
      action: "LEAD_CONVERTED",
      details: `Lead #${id} (${lead.company}) converted into customer workspace '${workspace.name}' (${targetPlan})`,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    // Notify user of plan upgrade/workspace provisioning if notification service available
    try {
      const { triggerNotification } = await import("@/lib/notification-dispatcher");
      await triggerNotification({
        workspaceId: workspace.id,
        userId: user.id,
        recipientEmail: user.email,
        title: `Welcome to PulseFlow Enterprise!`,
        message: `Your account for "${lead.company}" has been successfully converted and upgraded to the ${targetPlan} tier.`,
        type: "SUCCESS",
        link: "/dashboard/billing",
        idempotencyKey: `lead_convert_${lead.id}`,
      });
    } catch (e) {
      logger.info("Conversion notification dispatch deferred or provider not configured");
    }

    return NextResponse.json({
      success: true,
      message: `Lead converted successfully. Linked to workspace "${workspace.name}" on ${targetPlan} plan.`,
      lead: updatedLead,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
      },
    });
  } catch (error: any) {
    logger.error("Admin convert lead error", error, { context: "CRM_LEADS" });
    return NextResponse.json({ error: "Failed to convert lead record" }, { status: 500 });
  }
}
