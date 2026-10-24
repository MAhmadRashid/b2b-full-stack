import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

    // 2. Locate active API keys
    const activeKeys = await prisma.apiKey.findMany({
      where: { revoked: false },
      include: { workspace: true },
    });

    let matchedKey: (typeof activeKeys)[0] | null = null;

    for (const key of activeKeys) {
      const isMatch = await bcrypt.compare(rawKey, key.hashedKey);
      if (isMatch) {
        matchedKey = key;
        break;
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

    // 5. Persist MetricEvent and increment workspace usage
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
      prisma.workspace.update({
        where: { id: workspace.id },
        data: { requestsThisMonth: { increment: 1 } },
      }),
      prisma.apiKey.update({
        where: { id: matchedKey.id },
        data: { lastUsedAt: new Date() },
      }),
    ]);

    return NextResponse.json(
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
  } catch (error) {
    console.error("Ingest API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to record event" },
      { status: 500 }
    );
  }
}
