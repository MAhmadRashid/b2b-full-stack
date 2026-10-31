import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import { parseScopes } from "@/lib/api-scopes";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const { id, keyId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "VIEWER");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const key = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    if (!key || key.workspaceId !== id) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    return NextResponse.json({
      apiKey: {
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: parseScopes(key.scopes),
        rateLimit: key.rateLimit,
        revoked: key.revoked,
        revokedAt: key.revokedAt,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
        creator: key.user.name || key.user.email,
      },
    });
  } catch (error) {
    console.error("Get API key error:", error);
    return NextResponse.json({ error: "Failed to retrieve API key" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const { id, keyId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const key = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!key || key.workspaceId !== id) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.revoked) {
      return NextResponse.json(
        { error: "Cannot modify a revoked API key." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, scopes, rateLimit } = body;

    const dataToUpdate: any = {};
    if (name && typeof name === "string" && name.trim()) {
      dataToUpdate.name = name.trim();
    }

    if (scopes !== undefined) {
      const parsed = parseScopes(scopes);
      dataToUpdate.scopes = parsed.join(",");
    }

    if (rateLimit !== undefined && typeof rateLimit === "number" && rateLimit > 0) {
      dataToUpdate.rateLimit = Math.min(1000, Math.max(10, rateLimit));
    }

    const updatedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: dataToUpdate,
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_UPDATED",
      details: `Updated API key '${key.name}' (${key.keyPrefix}): ${JSON.stringify(dataToUpdate)}`,
    });

    return NextResponse.json({
      success: true,
      message: "API key settings updated successfully.",
      apiKey: {
        id: updatedKey.id,
        name: updatedKey.name,
        keyPrefix: updatedKey.keyPrefix,
        scopes: parseScopes(updatedKey.scopes),
        rateLimit: updatedKey.rateLimit,
        expiresAt: updatedKey.expiresAt,
        createdAt: updatedKey.createdAt,
      },
    });
  } catch (error) {
    console.error("Update API key error:", error);
    return NextResponse.json({ error: "Failed to update API key" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const { id, keyId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const key = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!key || key.workspaceId !== id) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.revoked) {
      return NextResponse.json({
        success: true,
        message: "API key is already revoked.",
      });
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });

    await recordAuditLog({
      workspaceId: id,
      organizationId: key.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_REVOKED",
      details: `Revoked API key '${key.name}' (${key.keyPrefix})`,
    });

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully. Any systems using this key will immediately be denied access.",
    });
  } catch (error) {
    console.error("Revoke API key error:", error);
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}
