import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkWorkspacePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";

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
    let targetUrl = body.url;
    let secretKey = body.secretKey;

    if (body.webhookId) {
      const wh = await prisma.webhook.findUnique({ where: { id: body.webhookId } });
      if (wh && wh.workspaceId === id) {
        targetUrl = wh.url;
        secretKey = wh.secretKey;
      }
    }

    if (!targetUrl || !secretKey) {
      return NextResponse.json(
        { error: "Target URL and secret key are required" },
        { status: 400 }
      );
    }

    const payload = {
      event: "test.ping",
      workspaceId: id,
      timestamp: new Date().toISOString(),
      deliveryId: `del_${crypto.randomBytes(12).toString("hex")}`,
      data: {
        message: "PulseFlow test notification: outbound webhook delivery operational.",
        severity: "INFO",
        metrics: {
          currentErrorRate: "0.04%",
          p99LatencyMs: 38,
          activeGateways: 4,
        },
      },
    };

    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(payloadString)
      .digest("hex");

    const startTime = Date.now();
    let deliveryStatus = "FAILED";
    let statusCode: number | null = null;
    let responseSnippet = "";
    let errorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "PulseFlow-Webhook-Dispatcher/1.0",
          "X-PulseFlow-Signature": signature,
          "X-PulseFlow-Event": "test.ping",
          "X-PulseFlow-Timestamp": payload.timestamp,
        },
        body: payloadString,
        signal: controller.signal,
      });
      clearTimeout(timer);

      statusCode = res.status;
      const text = await res.text();
      responseSnippet = text.slice(0, 300);
      deliveryStatus = res.ok ? "DELIVERED" : `HTTP_${res.status}`;
    } catch (err: any) {
      errorMessage = err.message || "Failed to establish TCP connection or timed out";
      deliveryStatus = "CONNECTION_FAILED";
    }

    const durationMs = Date.now() - startTime;

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "WEBHOOK_TEST_DELIVERY",
      details: `Test delivery sent to '${targetUrl}' -> ${deliveryStatus} (${durationMs}ms)`,
    });

    return NextResponse.json({
      success: deliveryStatus === "DELIVERED",
      deliveryStatus,
      statusCode,
      durationMs,
      signature,
      responseSnippet,
      errorMessage,
      payloadSent: payload,
    });
  } catch (error) {
    console.error("Test ping error:", error);
    return NextResponse.json({ error: "Failed to dispatch test ping" }, { status: 500 });
  }
}
