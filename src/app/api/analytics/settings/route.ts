import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission, checkOrganizationPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scopeType = searchParams.get("scopeType") || "PLATFORM"; // PLATFORM, ORGANIZATION, WORKSPACE
    const scopeId = searchParams.get("scopeId");

    // Enforce Authorization:
    if (scopeType === "PLATFORM") {
      if (session.systemRole !== "SUPERADMIN") {
        return NextResponse.json({ error: "Forbidden: Platform settings require Superadmin" }, { status: 403 });
      }
    } else if (scopeType === "ORGANIZATION") {
      if (!scopeId) return NextResponse.json({ error: "scopeId required for ORGANIZATION scope" }, { status: 400 });
      const perm = await checkOrganizationPermission(session.id, scopeId, "ADMIN");
      if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });
    } else if (scopeType === "WORKSPACE") {
      if (!scopeId) return NextResponse.json({ error: "scopeId required for WORKSPACE scope" }, { status: 400 });
      const perm = await checkWorkspacePermission(session.id, scopeId, "ADMIN");
      if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });
    }

    const setting = await prisma.analyticsSetting.findUnique({
      where: {
        scopeType_scopeId: {
          scopeType,
          scopeId: scopeId || "",
        },
      },
    });

    return NextResponse.json({
      scopeType,
      scopeId: scopeId || null,
      setting: setting || {
        retentionDays: 90,
        dntRespect: true,
        ipAnonymization: true,
        captureClientEvents: true,
        isDefault: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch analytics settings", details: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { scopeType = "PLATFORM", scopeId = null, retentionDays, dntRespect, ipAnonymization, captureClientEvents } = body;

    // Enforce Authorization
    if (scopeType === "PLATFORM") {
      if (session.systemRole !== "SUPERADMIN") {
        return NextResponse.json({ error: "Forbidden: Superadmin required to modify platform analytics settings" }, { status: 403 });
      }
    } else if (scopeType === "ORGANIZATION") {
      if (!scopeId) return NextResponse.json({ error: "scopeId required for ORGANIZATION scope" }, { status: 400 });
      const perm = await checkOrganizationPermission(session.id, scopeId, "ADMIN");
      if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });
    } else if (scopeType === "WORKSPACE") {
      if (!scopeId) return NextResponse.json({ error: "scopeId required for WORKSPACE scope" }, { status: 400 });
      const perm = await checkWorkspacePermission(session.id, scopeId, "ADMIN");
      if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });
    }

    const validRetention = typeof retentionDays === "number" && retentionDays >= 7 && retentionDays <= 365 ? retentionDays : 90;

    const updated = await prisma.analyticsSetting.upsert({
      where: {
        scopeType_scopeId: {
          scopeType,
          scopeId: scopeId || "",
        },
      },
      create: {
        scopeType,
        scopeId: scopeId || null,
        retentionDays: validRetention,
        dntRespect: typeof dntRespect === "boolean" ? dntRespect : true,
        ipAnonymization: typeof ipAnonymization === "boolean" ? ipAnonymization : true,
        captureClientEvents: typeof captureClientEvents === "boolean" ? captureClientEvents : true,
      },
      update: {
        retentionDays: validRetention,
        dntRespect: typeof dntRespect === "boolean" ? dntRespect : undefined,
        ipAnonymization: typeof ipAnonymization === "boolean" ? ipAnonymization : undefined,
        captureClientEvents: typeof captureClientEvents === "boolean" ? captureClientEvents : undefined,
      },
    });

    return NextResponse.json({ success: true, setting: updated });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update analytics settings", details: error.message }, { status: 500 });
  }
}
