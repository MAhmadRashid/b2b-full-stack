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
    const { action, reason } = body; // action: "SUSPEND" | "REACTIVATE" | "UPDATE_ROLE"

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, systemRole: true, suspended: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Safety guard: Superadmin cannot suspend their own active account
    if (targetUser.id === auth.user.id && action === "SUSPEND") {
      return NextResponse.json(
        { error: "Operation denied: You cannot suspend your own superadmin account." },
        { status: 400 }
      );
    }

    if (action === "SUSPEND") {
      const suspensionReason = reason?.trim() || "Administrative action by Superadmin";
      const updated = await prisma.user.update({
        where: { id },
        data: {
          suspended: true,
          suspensionReason,
        },
      });

      await recordAuditLog({
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "USER_SUSPENDED",
        details: `Superadmin suspended user account ${targetUser.email}. Reason: ${suspensionReason}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `User ${targetUser.email} has been suspended`,
        user: { id: updated.id, email: updated.email, suspended: updated.suspended, suspensionReason },
      });
    }

    if (action === "REACTIVATE") {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          suspended: false,
          suspensionReason: null,
        },
      });

      await recordAuditLog({
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "USER_REACTIVATED",
        details: `Superadmin reactivated user account ${targetUser.email}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `User ${targetUser.email} has been reactivated`,
        user: { id: updated.id, email: updated.email, suspended: updated.suspended },
      });
    }

    if (action === "UPDATE_ROLE") {
      const newRole = body.systemRole?.toUpperCase();
      if (!["USER", "SUPERADMIN"].includes(newRole)) {
        return NextResponse.json(
          { error: "Invalid role. Allowed values: USER, SUPERADMIN" },
          { status: 400 }
        );
      }

      // Safeguard: Prevent removing superadmin role from self
      if (targetUser.id === auth.user.id && newRole !== "SUPERADMIN") {
        return NextResponse.json(
          { error: "Operation denied: You cannot demote your own superadmin account." },
          { status: 400 }
        );
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { systemRole: newRole },
      });

      await recordAuditLog({
        userId: auth.user.id,
        userEmail: auth.user.email,
        action: "ROLE_CHANGED",
        details: `Superadmin altered systemRole for ${targetUser.email} to ${newRole}`,
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return NextResponse.json({
        success: true,
        message: `System role for ${targetUser.email} updated to ${newRole}`,
        user: { id: updated.id, email: updated.email, systemRole: updated.systemRole },
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: SUSPEND, REACTIVATE, UPDATE_ROLE" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Superadmin user action error:", error);
    return NextResponse.json({ error: "Failed to perform user action" }, { status: 500 });
  }
}
