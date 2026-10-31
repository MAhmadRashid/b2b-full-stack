import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
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
        { error: "Forbidden: Only Organization Owners and Admins can update billing settings" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { billingEmail, billingAddress, taxId } = body;

    const dataToUpdate: any = {};
    if (billingEmail !== undefined) {
      if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())) {
        return NextResponse.json(
          { error: "Please provide a valid billing email address" },
          { status: 400 }
        );
      }
      dataToUpdate.billingEmail = billingEmail ? billingEmail.trim().toLowerCase() : null;
    }

    if (billingAddress !== undefined) {
      dataToUpdate.billingAddress = billingAddress ? billingAddress.trim() : null;
    }

    if (taxId !== undefined) {
      dataToUpdate.taxId = taxId ? taxId.trim() : null;
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: dataToUpdate,
    });

    if (dataToUpdate.billingEmail) {
      await prisma.subscription.updateMany({
        where: { organizationId: orgId },
        data: { billingEmail: dataToUpdate.billingEmail },
      });
    }

    await recordAuditLog({
      organizationId: orgId,
      userId: session.id,
      userEmail: session.email,
      action: "ORGANIZATION_BILLING_SETTINGS_UPDATED",
      details: `Updated billing contact details: ${JSON.stringify(dataToUpdate)}`,
    });

    return NextResponse.json({
      success: true,
      message: "Billing contact settings updated successfully.",
      settings: {
        billingEmail: updatedOrg.billingEmail,
        billingAddress: updatedOrg.billingAddress,
        taxId: updatedOrg.taxId,
      },
    });
  } catch (error) {
    console.error("Update organization billing settings error:", error);
    return NextResponse.json({ error: "Failed to update billing settings" }, { status: 500 });
  }
}
