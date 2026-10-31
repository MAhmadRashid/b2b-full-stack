import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * POST /api/v1/keys
 * Accepts organization ("For Console's Team" or ID), workspace ("Default Workspace" or ID),
 * and key name, returning a hashed high-entropy bearer token once per creation.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", message: "User session required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      organization = "For Console's Team",
      workspace = "Default Workspace",
      scopes = ["metrics:read", "events:write"],
      environment = "live",
      expiresIn = "never",
      rateLimit = 120,
      ipRestrictions = null,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Validation Error", message: "Key 'name' is required" },
        { status: 400 }
      );
    }

    // 1. Resolve organization by ID or Name
    let targetOrg = await prisma.organization.findFirst({
      where: {
        OR: [{ id: organization }, { name: organization }, { slug: organization.toLowerCase().replace(/\s+/g, "-") }],
        members: { some: { userId: session.id } },
      },
    });

    if (!targetOrg) {
      // Fallback to first accessible organization of user
      targetOrg = await prisma.organization.findFirst({
        where: { members: { some: { userId: session.id } } },
      });
    }

    // 2. Resolve workspace by ID or Name
    let targetWs = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspace }, { name: workspace }, { slug: workspace.toLowerCase().replace(/\s+/g, "-") }],
        ...(targetOrg ? { organizationId: targetOrg.id } : {}),
        members: { some: { userId: session.id } },
      },
      include: { organization: true },
    });

    if (!targetWs) {
      // Fallback to primary accessible workspace
      targetWs = await prisma.workspace.findFirst({
        where: { members: { some: { userId: session.id } } },
        include: { organization: true },
      });
    }

    if (!targetWs) {
      return NextResponse.json(
        { error: "Not Found", message: `Workspace '${workspace}' not found or inaccessible for your account.` },
        { status: 404 }
      );
    }

    // 3. Check RBAC permissions (ADMIN or OWNER required)
    const perm = await checkWorkspacePermission(session.id, targetWs.id, "ADMIN");
    if (!perm.allowed) {
      return NextResponse.json({ error: "Forbidden", message: perm.error }, { status: 403 });
    }

    // 4. Check active API key quotas
    const { resolveEffectivePlanConfig } = await import("@/lib/plan-resolver");
    const planConfig = resolveEffectivePlanConfig(targetWs);
    const activeKeyCount = await prisma.apiKey.count({
      where: { workspaceId: targetWs.id, revoked: false },
    });

    if (activeKeyCount >= planConfig.limits.maxApiKeys) {
      return NextResponse.json(
        {
          error: "API Key Limit Reached",
          message: `Workspace tier allows up to ${planConfig.limits.maxApiKeys} active API key(s). Revoke existing keys or upgrade.`,
          limit: planConfig.limits.maxApiKeys,
          currentCount: activeKeyCount,
        },
        { status: 403 }
      );
    }

    // 5. Generate high-entropy secret token (prefix pfl_live_ or pfl_test_)
    const entropyHex = crypto.randomBytes(24).toString("hex");
    const envPrefix = environment === "test" ? "pfl_test_" : "pfl_live_";
    const rawKey = `${envPrefix}${entropyHex}`;
    const keyPrefix = `${rawKey.substring(0, 13)}...${rawKey.substring(rawKey.length - 4)}`;

    // Hash secret using bcrypt
    const hashedKey = await bcrypt.hash(rawKey, 10);

    let expiresAt: Date | null = null;
    if (expiresIn === "30d") {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (expiresIn === "90d") {
      expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    } else if (expiresIn === "1y") {
      expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }

    const sanitizedScopes = Array.isArray(scopes) ? scopes.join(",") : "metrics:read,events:write";

    const newApiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        keyPrefix,
        hashedKey,
        scopes: sanitizedScopes,
        rateLimit: Number(rateLimit) || 120,
        ipRestrictions: ipRestrictions ? String(ipRestrictions).trim() : null,
        expiresAt,
        workspaceId: targetWs.id,
        userId: session.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "API Key generated successfully. Save this secret token now; it cannot be retrieved again.",
        apiKey: {
          id: newApiKey.id,
          name: newApiKey.name,
          keyPrefix: newApiKey.keyPrefix,
          rawKey,
          scopes: newApiKey.scopes.split(","),
          rateLimit: newApiKey.rateLimit,
          expiresAt: newApiKey.expiresAt,
          createdAt: newApiKey.createdAt,
          workspace: {
            id: targetWs.id,
            name: targetWs.name,
          },
          organization: targetWs.organization
            ? {
                id: targetWs.organization.id,
                name: targetWs.organization.name,
              }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/v1/keys error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", message: err.message || "Failed to provision API key" },
      { status: 500 }
    );
  }
}
