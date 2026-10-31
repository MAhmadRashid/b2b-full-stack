import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "VIEWER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const keys = await prisma.apiKey.findMany({
      where: { workspaceId: id },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        previousPrefix: k.previousPrefix,
        gracePeriodEndsAt: k.gracePeriodEndsAt,
        ipRestrictions: k.ipRestrictions,
        scopes: k.scopes.split(","),
        rateLimit: k.rateLimit,
        revoked: k.revoked,
        revokedAt: k.revokedAt,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
        creator: k.user.name || k.user.email,
      })),
      canManage: ["OWNER", "ADMIN"].includes(perm.role || ""),
    });
  } catch (error) {
    console.error("List keys error:", error);
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const ws = await prisma.workspace.findUnique({
      where: { id },
      include: { organization: true },
    });
    if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const { resolveEffectivePlanConfig } = await import("@/lib/plan-resolver");
    const planConfig = resolveEffectivePlanConfig(ws);

    // Active API keys quota check
    const activeKeyCount = await prisma.apiKey.count({
      where: { workspaceId: id, revoked: false },
    });

    if (activeKeyCount >= planConfig.limits.maxApiKeys) {
      return NextResponse.json(
        {
          error: "API Key Limit Reached",
          message: `Your subscription allows up to ${planConfig.limits.maxApiKeys} active API key(s). Revoke existing keys or upgrade your plan.`,
          upgradeRequired: true,
          limit: planConfig.limits.maxApiKeys,
          currentCount: activeKeyCount,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      scopes = ["metrics:read", "events:write"],
      environment = "live",
      expiresIn = "never",
      rateLimit = 120,
      ipRestrictions = null,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

    // Clean IP restrictions string
    const cleanedIpRestrictions = typeof ipRestrictions === "string" && ipRestrictions.trim()
      ? ipRestrictions.trim()
      : null;

    // Calculate expiration date
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

    // Generate a secure raw key: pfl_[live|test]_[32 random hex chars]
    const randomHex = crypto.randomBytes(16).toString("hex");
    const rawKey = `pfl_${environment === "test" ? "test" : "live"}_${randomHex}`;
    const keyPrefix = `${rawKey.substring(0, 13)}...${rawKey.substring(rawKey.length - 4)}`;

    const hashedKey = await bcrypt.hash(rawKey, 10);
    const scopeString = Array.isArray(scopes) ? scopes.join(",") : scopes;

    const apiKey = await prisma.apiKey.create({
      data: {
        workspaceId: id,
        organizationId: ws.organizationId,
        userId: session.id,
        name: name.trim(),
        keyPrefix,
        hashedKey,
        scopes: scopeString,
        ipRestrictions: cleanedIpRestrictions,
        rateLimit: Math.min(1000, Math.max(10, rateLimit)),
        expiresAt,
      },
    });

    await recordAuditLog({
      workspaceId: id,
      organizationId: ws.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_CREATED",
      details: `Generated API key '${name.trim()}' with prefix ${keyPrefix}${expiresAt ? ` (expires ${expiresAt.toISOString()})` : " (never expires)"}`,
    });

    try {
      const { triggerNotification } = await import("@/lib/notification-dispatcher");
      await triggerNotification({
        workspaceId: id,
        userId: session.id,
        recipientEmail: session.email,
        title: `API Key Created: ${name.trim()}`,
        message: `New developer API key generated with prefix ${keyPrefix}. Keep this token secure.`,
        type: "INFO",
        link: "/dashboard/api-keys",
        emailEventType: "API_KEY_CREATED",
        idempotencyKey: `apikey_created_${apiKey.id}`,
        emailDetails: {
          "Key Name": name.trim(),
          "Prefix": keyPrefix,
          "Expires": expiresAt ? expiresAt.toLocaleDateString() : "Never",
        },
      });
    } catch (e) {
      console.warn("API key notification dispatch deferred:", e);
    }

    // Note: rawKey is ONLY returned once during creation
    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes.split(","),
        rateLimit: apiKey.rateLimit,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
        rawKey, // Revealed once!
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Create key error:", error);
    return NextResponse.json({ error: "Failed to generate key" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const url = new URL(req.url);
    const keyId = url.searchParams.get("keyId");

    if (!keyId) {
      return NextResponse.json({ error: "keyId query parameter is required" }, { status: 400 });
    }

    const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key || key.workspaceId !== id) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revoked: true, revokedAt: new Date() },
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_REVOKED",
      details: `Revoked API key '${key.name}' (${key.keyPrefix})`,
    });

    return NextResponse.json({ success: true, message: "API key revoked" });
  } catch (error) {
    console.error("Revoke key error:", error);
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  }
}
