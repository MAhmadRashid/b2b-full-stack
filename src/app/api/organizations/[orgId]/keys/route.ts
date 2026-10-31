import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import { parseScopes } from "@/lib/api-scopes";
import { getPlan, PlanId } from "@/lib/billing-plans";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "VIEWER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { workspaces: { select: { id: true, name: true } } },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const workspaceIds = org.workspaces.map((w) => w.id);

    const keys = await prisma.apiKey.findMany({
      where: {
        OR: [
          { organizationId: orgId },
          { workspaceId: { in: workspaceIds } },
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
        workspace: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      organizationId: orgId,
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: parseScopes(k.scopes),
        rateLimit: k.rateLimit,
        revoked: k.revoked,
        revokedAt: k.revokedAt,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
        creator: k.user.name || k.user.email,
        workspaceId: k.workspaceId,
        workspaceName: k.workspace?.name || "Organization Wide",
      })),
      canManage: ["OWNER", "ADMIN"].includes(perm.role || ""),
    });
  } catch (error) {
    console.error("List organization keys error:", error);
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
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
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        workspaces: true,
        _count: { select: { apiKeys: true } },
      },
    });
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const planConfig = getPlan((org.plan || "FREE") as PlanId);

    // Check active API key quotas
    const activeKeyCount = await prisma.apiKey.count({
      where: {
        OR: [
          { organizationId: orgId },
          { workspaceId: { in: org.workspaces.map((w) => w.id) } },
        ],
        revoked: false,
      },
    });

    if (activeKeyCount >= planConfig.limits.maxApiKeys) {
      return NextResponse.json(
        {
          error: "API Key Limit Reached",
          message: `Your organization on the ${planConfig.name} plan is limited to ${planConfig.limits.maxApiKeys} active API key(s). Revoke existing keys or upgrade your plan.`,
          upgradeRequired: true,
          limit: planConfig.limits.maxApiKeys,
          currentCount: activeKeyCount,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      workspaceId,
      scopes = ["metrics:read", "events:write"],
      environment = "live",
      expiresIn = "never",
      rateLimit = 120,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

    // Determine target workspace if specified, otherwise fall back to first workspace or null
    let targetWorkspaceId: string | null = null;
    if (workspaceId) {
      const ws = org.workspaces.find((w) => w.id === workspaceId);
      if (!ws) {
        return NextResponse.json({ error: "Target workspace does not belong to this organization" }, { status: 400 });
      }
      targetWorkspaceId = ws.id;
    } else if (org.workspaces.length > 0) {
      targetWorkspaceId = org.workspaces[0].id;
    }

    // Expiration calculation
    let expiresAt: Date | null = null;
    if (expiresIn === "30d") {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (expiresIn === "90d") {
      expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    } else if (expiresIn === "1y" || expiresIn === "365d") {
      expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else if (expiresIn && expiresIn !== "never") {
      const days = parseInt(expiresIn, 10);
      if (!isNaN(days) && days > 0) {
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    }

    const randomHex = crypto.randomBytes(16).toString("hex");
    const rawKey = `pfl_${environment === "test" ? "test" : "live"}_${randomHex}`;
    const keyPrefix = `${rawKey.substring(0, 13)}...${rawKey.substring(rawKey.length - 4)}`;
    const hashedKey = await bcrypt.hash(rawKey, 10);
    const parsedScopes = parseScopes(scopes);

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        workspaceId: targetWorkspaceId,
        userId: session.id,
        name: name.trim(),
        keyPrefix,
        hashedKey,
        scopes: parsedScopes.join(","),
        rateLimit: Math.min(1000, Math.max(10, rateLimit)),
        expiresAt,
      },
    });

    await recordAuditLog({
      organizationId: orgId,
      workspaceId: targetWorkspaceId,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_CREATED",
      details: `Generated API key '${name.trim()}' with prefix ${keyPrefix}${expiresAt ? ` (expires ${expiresAt.toISOString()})` : " (never expires)"}`,
    });

    return NextResponse.json(
      {
        success: true,
        message: "API key created successfully. Save your secret key now—it will not be displayed again.",
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          scopes: parsedScopes,
          rateLimit: apiKey.rateLimit,
          createdAt: apiKey.createdAt,
          expiresAt: apiKey.expiresAt,
          rawKey, // Revealed ONCE!
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create organization key error:", error);
    return NextResponse.json({ error: "Failed to generate organization API key" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const url = new URL(req.url);
    const keyId = url.searchParams.get("keyId");
    if (!keyId) return NextResponse.json({ error: "keyId query parameter is required" }, { status: 400 });

    const key = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { workspace: true },
    });

    if (!key || (key.organizationId !== orgId && key.workspace?.organizationId !== orgId)) {
      return NextResponse.json({ error: "API key not found in organization" }, { status: 404 });
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revoked: true, revokedAt: new Date() },
    });

    await recordAuditLog({
      organizationId: orgId,
      workspaceId: key.workspaceId,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_REVOKED",
      details: `Revoked API key '${key.name}' (${key.keyPrefix})`,
    });

    return NextResponse.json({ success: true, message: "API key revoked successfully." });
  } catch (error) {
    console.error("Revoke organization key error:", error);
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}
