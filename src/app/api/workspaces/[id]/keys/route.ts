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
        scopes: k.scopes.split(","),
        revoked: k.revoked,
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

    const body = await req.json();
    const { name, scopes = ["metrics:read", "events:write"], environment = "live", expiresIn = "never" } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

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
        userId: session.id,
        name: name.trim(),
        keyPrefix,
        hashedKey,
        scopes: scopeString,
        expiresAt,
      },
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_CREATED",
      details: `Generated API key '${name.trim()}' with prefix ${keyPrefix}${expiresAt ? ` (expires ${expiresAt.toISOString()})` : " (never expires)"}`,
    });

    // Note: rawKey is ONLY returned once during creation
    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes.split(","),
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
      data: { revoked: true },
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
