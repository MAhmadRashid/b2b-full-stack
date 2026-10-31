import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { logger } from "@/lib/logger";
import { recordAuditLog } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/leads/[id] - Full details for a single lead record
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireSuperAdmin(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { id } = await params;
    const lead = await prisma.leadSubmission.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead record not found" }, { status: 404 });
    }

    // Check if an existing user/account is associated with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: lead.workEmail.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        createdAt: true,
        memberships: {
          select: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
              },
            },
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      lead,
      existingAccount: existingUser || null,
    });
  } catch (error: any) {
    logger.error("Admin get lead detail error", error, { context: "CRM_LEADS" });
    return NextResponse.json({ error: "Failed to fetch lead details" }, { status: 500 });
  }
}

// PATCH /api/admin/leads/[id] - Update status, priority, internal notes, follow-up date, or add contact history entry
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireSuperAdmin(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, priority, internalNotes, followUpDate, newContactNote } = body;

    const lead = await prisma.leadSubmission.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead record not found" }, { status: 404 });
    }

    const validStatuses = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];
    const validPriorities = ["LOW", "MEDIUM", "HIGH"];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (followUpDate !== undefined) {
      updateData.followUpDate = followUpDate ? new Date(followUpDate) : null;
    }

    // Parse and append contact history
    let history: any[] = [];
    try {
      history = JSON.parse(lead.contactHistory || "[]");
    } catch {
      history = [];
    }

    if (newContactNote && typeof newContactNote === "string" && newContactNote.trim()) {
      history.unshift({
        timestamp: new Date().toISOString(),
        author: authResult.user.name || authResult.user.email,
        note: newContactNote.trim(),
        action: status ? `Status: ${status}` : "Note Added",
      });
      updateData.contactHistory = JSON.stringify(history);
    } else if (status && status !== lead.status) {
      history.unshift({
        timestamp: new Date().toISOString(),
        author: authResult.user.name || authResult.user.email,
        note: `Status updated from ${lead.status} to ${status}`,
        action: `Status Change`,
      });
      updateData.contactHistory = JSON.stringify(history);
    }

    const updated = await prisma.leadSubmission.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog({
      userId: authResult.user.id,
      userEmail: authResult.user.email,
      action: "LEAD_UPDATED",
      details: `Lead #${id} (${lead.company}) updated: status=${updated.status}, priority=${updated.priority}`,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({
      success: true,
      message: "Lead record updated successfully",
      lead: updated,
    });
  } catch (error: any) {
    logger.error("Admin patch lead error", error, { context: "CRM_LEADS" });
    return NextResponse.json({ error: "Failed to update lead record" }, { status: 500 });
  }
}
