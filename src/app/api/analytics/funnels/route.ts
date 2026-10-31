import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission, checkOrganizationPermission } from "@/lib/rbac";
import { FUNNEL_STAGES } from "@/lib/funnel-analytics";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const organizationId = searchParams.get("organizationId");

    const where: any = {};
    if (workspaceId) {
      const perm = await checkWorkspacePermission(session.id, workspaceId, "VIEWER");
      if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });
      where.workspaceId = workspaceId;
    } else if (organizationId) {
      const perm = await checkOrganizationPermission(session.id, organizationId, "VIEWER");
      if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });
      where.organizationId = organizationId;
    } else {
      if (session.systemRole !== "SUPERADMIN") {
        return NextResponse.json({ error: "Forbidden: Superadmin required for platform funnels" }, { status: 403 });
      }
    }

    const funnels = await prisma.conversionFunnelDefinition.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      funnels: funnels.map((f) => ({
        ...f,
        stages: JSON.parse(f.stages || "[]"),
      })),
      defaultStages: FUNNEL_STAGES,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to list funnels", details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { name, description, stages, workspaceId, organizationId, isDefault = false } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Valid name is required" }, { status: 400 });
    }

    if (!Array.isArray(stages) || stages.length < 2) {
      return NextResponse.json({ error: "At least 2 stages are required for a funnel" }, { status: 400 });
    }

    // RBAC validation
    if (workspaceId) {
      const perm = await checkWorkspacePermission(session.id, workspaceId, "ADMIN");
      if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });
    } else if (organizationId) {
      const perm = await checkOrganizationPermission(session.id, organizationId, "ADMIN");
      if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });
    } else {
      if (session.systemRole !== "SUPERADMIN") {
        return NextResponse.json({ error: "Superadmin required for platform default funnels" }, { status: 403 });
      }
    }

    const created = await prisma.conversionFunnelDefinition.create({
      data: {
        name: name.trim(),
        description: description ? String(description).slice(0, 300) : null,
        stages: JSON.stringify(stages),
        workspaceId: workspaceId || null,
        organizationId: organizationId || null,
        isDefault: Boolean(isDefault),
        createdById: session.id,
      },
    });

    return NextResponse.json({
      success: true,
      funnel: {
        ...created,
        stages: JSON.parse(created.stages),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to create funnel definition", details: error.message }, { status: 500 });
  }
}
