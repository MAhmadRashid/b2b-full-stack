import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    // 1. Extract API key from Authorization header or x-api-key
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-api-key");
    let rawKey = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      rawKey = authHeader.replace("Bearer ", "").trim();
    } else if (customHeader) {
      rawKey = customHeader.trim();
    }

    if (!rawKey) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Missing API Key. Provide via 'Authorization: Bearer pfl_...' or 'x-api-key' header.",
        },
        { status: 401 }
      );
    }

    // 2. High-performance O(1) indexed lookup using keyPrefix (or previousPrefix during zero-downtime rotation)
    let candidateKeys: any[] = [];
    if (rawKey.length >= 17) {
      const candidatePrefix = `${rawKey.substring(0, 13)}...${rawKey.substring(rawKey.length - 4)}`;
      candidateKeys = await prisma.apiKey.findMany({
        where: {
          revoked: false,
          OR: [
            { keyPrefix: candidatePrefix },
            { previousPrefix: candidatePrefix },
          ],
        },
        include: { workspace: true },
      });
    }

    // Safe fallback for legacy keys
    if (candidateKeys.length === 0) {
      candidateKeys = await prisma.apiKey.findMany({
        where: { revoked: false },
        take: 20,
        include: { workspace: true },
      });
    }

    let matchedKey: (typeof candidateKeys)[0] | null = null;
    let usedPreviousKey = false;

    for (const key of candidateKeys) {
      // Primary active secret comparison
      const isMatch = await bcrypt.compare(rawKey, key.hashedKey);
      if (isMatch) {
        matchedKey = key;
        break;
      }

      // Zero-downtime rotation: check previous secret if grace period is active
      if (
        key.previousHashedKey &&
        key.gracePeriodEndsAt &&
        new Date(key.gracePeriodEndsAt) > new Date()
      ) {
        const isPrevMatch = await bcrypt.compare(rawKey, key.previousHashedKey);
        if (isPrevMatch) {
          matchedKey = key;
          usedPreviousKey = true;
          break;
        }
      }
    }

    if (!matchedKey) {
      return NextResponse.json(
        { error: "Forbidden", message: "Invalid or revoked API key" },
        { status: 403 }
      );
    }

    // Check key expiration
    if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
      return NextResponse.json(
        {
          error: "Expired",
          message: "API key has expired. Please rotate or generate a new key in the dashboard.",
          expiredAt: matchedKey.expiresAt,
        },
        { status: 401 }
      );
    }

    // Check IP Whitelist / CIDR restrictions
    const { extractClientIp, validateIpRestriction } = await import("@/lib/ip-guard");
    const clientIp = extractClientIp(
      req.headers.get("x-forwarded-for"),
      req.headers.get("x-real-ip"),
      req.headers.get("cf-connecting-ip")
    );

    const ipCheck = validateIpRestriction(clientIp, matchedKey.ipRestrictions);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: ipCheck.reason || "Client IP is not permitted to use this API key.",
          clientIp,
        },
        { status: 403 }
      );
    }

    // Rate Limiting Check (120 requests/minute per active API key)
    const rl = checkRateLimit(`ingest_${matchedKey.id}`, { limit: 120, windowMs: 60000 });
    if (!rl.success) {
      return NextResponse.json(
        {
          error: "Rate Limit Exceeded",
          message: "Exceeded limit of 120 ingest requests per minute. Back off before retrying.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rl.resetMs / 1000).toString(),
            "X-RateLimit-Limit": rl.limit.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const workspace = matchedKey.workspace;

    // 3. Check Quota / Rate Limiting
    if (workspace.requestsThisMonth >= workspace.monthlyRequestLimit) {
      return NextResponse.json(
        {
          error: "Quota Exceeded",
          message: `Workspace monthly limit of ${workspace.monthlyRequestLimit.toLocaleString()} requests reached. Please upgrade your plan.`,
          currentUsage: workspace.requestsThisMonth,
          limit: workspace.monthlyRequestLimit,
        },
        { status: 429 }
      );
    }

    // 4. Parse incoming event payload
    const body = await req.json().catch(() => ({}));
    const eventType = body.eventType || "telemetry_ping";
    const source = body.source || req.headers.get("user-agent") || "external-client";
    const latencyMs = Math.max(4, Date.now() - startTime);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 5. Persist MetricEvent, increment workspace usage, log API request, and update usage record
    const [event] = await prisma.$transaction([
      prisma.metricEvent.create({
        data: {
          workspaceId: workspace.id,
          eventType,
          source: source.substring(0, 100),
          status: "SUCCESS",
          statusCode: 201,
          latencyMs,
          payload: JSON.stringify(body.payload || body),
        },
      }),
      prisma.apiRequestLog.create({
        data: {
          apiKeyId: matchedKey.id,
          workspaceId: workspace.id,
          organizationId: workspace.organizationId,
          endpoint: "/api/v1/ingest",
          method: "POST",
          statusCode: 201,
          durationMs: latencyMs,
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
          userAgent: source.substring(0, 100),
        },
      }),
      prisma.workspace.update({
        where: { id: workspace.id },
        data: { requestsThisMonth: { increment: 1 } },
      }),
      prisma.apiKey.update({
        where: { id: matchedKey.id },
        data: { lastUsedAt: new Date() },
      }),
      prisma.usageRecord.upsert({
        where: {
          workspaceId_date: {
            workspaceId: workspace.id,
            date: today,
          },
        },
        create: {
          workspaceId: workspace.id,
          date: today,
          totalEvents: 1,
          errorsCount: 0,
          avgLatency: latencyMs,
        },
        update: {
          totalEvents: { increment: 1 },
        },
      }),
    ]);

    const response = NextResponse.json(
      {
        success: true,
        eventId: event.id,
        workspaceId: workspace.id,
        eventType: event.eventType,
        recordedAt: event.timestamp,
        latencyMs,
        usage: {
          requestsThisMonth: workspace.requestsThisMonth + 1,
          monthlyLimit: workspace.monthlyRequestLimit,
          remaining: Math.max(0, workspace.monthlyRequestLimit - (workspace.requestsThisMonth + 1)),
        },
      },
      { status: 201 }
    );

    response.headers.set("X-RateLimit-Limit", rl.limit.toString());
    response.headers.set("X-RateLimit-Remaining", rl.remaining.toString());

    return response;
  } catch (error) {
    console.error("Ingest API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to record event" },
      { status: 500 }
    );
  }
}
