import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const { id, keyId } = await params;
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perm = await checkWorkspacePermission(session.id, id, "ADMIN");
    if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 });

    const existingKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!existingKey || existingKey.workspaceId !== id) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (existingKey.revoked) {
      return NextResponse.json(
        { error: "Cannot rotate a revoked API key. Generate a new key instead." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { expiresIn, gracePeriodHours = 24 } = body;

    // Calculate new expiration date if requested, otherwise retain current
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

    // Zero-downtime rotation: keep previous credentials valid for gracePeriodHours only if explicitly provided > 0
    let gracePeriodEndsAt: Date | null = null;
    let validGraceHours = 0;
    if (body.gracePeriodHours !== undefined && body.gracePeriodHours !== null) {
      const hours = parseInt(body.gracePeriodHours, 10);
      if (!isNaN(hours) && hours > 0) {
        validGraceHours = hours;
        gracePeriodEndsAt = new Date(Date.now() + validGraceHours * 60 * 60 * 1000);
      }
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
        previousHashedKey: existingKey.hashedKey,
        previousPrefix: oldPrefix,
        gracePeriodEndsAt,
        expiresAt: newExpiresAt,
        lastUsedAt: null, // Reset last used on secret rotation
      },
    });

    await recordAuditLog({
      workspaceId: id,
      organizationId: existingKey.organizationId,
      userId: session.id,
      userEmail: session.email,
      action: "API_KEY_ROTATED",
      details: `Rotated credentials for API key '${existingKey.name}' with ${validGraceHours}h zero-downtime grace period. New prefix: ${newKeyPrefix}, previous prefix: ${oldPrefix}`,
    });

    return NextResponse.json({
      success: true,
      message: `API key secret rotated with ${validGraceHours}-hour zero-downtime grace period. Both new and old keys will authenticate until grace period expires.`,
      apiKey: {
        id: updatedKey.id,
        name: updatedKey.name,
        keyPrefix: updatedKey.keyPrefix,
        previousPrefix: updatedKey.previousPrefix,
        gracePeriodEndsAt: updatedKey.gracePeriodEndsAt,
        scopes: updatedKey.scopes.split(","),
        createdAt: updatedKey.createdAt,
        expiresAt: updatedKey.expiresAt,
        rawKey: newRawKey, // Revealed once!
      },
    });
  } catch (error) {
    console.error("Rotate API key error:", error);
    return NextResponse.json({ error: "Failed to rotate API key" }, { status: 500 });
  }
}
