import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOrganizationPermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import { parseScopes } from "@/lib/api-scopes";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; keyId: string }> }
) {
  try {
    const { orgId, keyId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkOrganizationPermission(session.id, orgId, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const existingKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: { workspace: true },
    });

    if (!existingKey || (existingKey.organizationId !== orgId && existingKey.workspace?.organizationId !== orgId)) {
      return NextResponse.json({ error: "API key not found in organization" }, { status: 404 });
    }

    if (existingKey.revoked) {
      return NextResponse.json(
        { error: "Cannot rotate a revoked API key. Generate a new key instead." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { expiresIn } = body;

    let newExpiresAt = existingKey.expiresAt;
    if (expiresIn === "30d") {
      newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (expiresIn === "90d") {
      newExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    } else if (expiresIn === "1y" || expiresIn === "365d") {
      newExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else if (expiresIn === "never") {
      newExpiresAt = null;
    }

    const environment = existingKey.keyPrefix.includes("pfl_test_") ? "test" : "live";
    const randomHex = crypto.randomBytes(16).toString("hex");
    const newRawKey = `pfl_${environment}_${randomHex}`;
    const newKeyPrefix = `${newRawKey.substring(0, 13)}...${newRawKey.substring(newRawKey.length - 4)}`;
    const newHashedKey = await bcrypt.hash(newRawKey, 10);

    const oldPrefix = existingKey.keyPrefix;

    const updatedKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        keyPrefix: newKeyPrefix,
        hashedKey: newHashedKey,
        expiresAt: newExpiresAt,
        lastUsedAt: null,
      },
    });

    await recordAuditLog({
      organizationId: orgId,
      workspaceId: existingKey.workspaceId,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_ROTATED",
      details: `Rotated credentials for API key '${existingKey.name}' from ${oldPrefix} to ${newKeyPrefix}`,
    });

    return NextResponse.json({
      success: true,
      message: "API key secret rotated successfully.",
      apiKey: {
        id: updatedKey.id,
        name: updatedKey.name,
        keyPrefix: updatedKey.keyPrefix,
        scopes: parseScopes(updatedKey.scopes),
        createdAt: updatedKey.createdAt,
        expiresAt: updatedKey.expiresAt,
        rawKey: newRawKey, // Revealed once!
      },
    });
  } catch (error) {
    console.error("Rotate organization key error:", error);
    return NextResponse.json({ error: "Failed to rotate API key" }, { status: 500 });
  }
}
