import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkWorkspacePermission } from "@/lib/rbac";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";

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

    const webhooks = await prisma.webhook.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      webhooks: webhooks.map((w) => ({
        id: w.id,
        workspaceId: w.workspaceId,
        url: w.url,
        secretKey: w.secretKey,
        events: w.events.split(","),
        active: w.active,
        createdAt: w.createdAt,
      })),
      canManage: ["OWNER", "ADMIN"].includes(perm.role || ""),
    });
  } catch (error) {
    console.error("List webhooks error:", error);
    return NextResponse.json({ error: "Failed to list webhooks" }, { status: 500 });
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

    // Check if client dispatched a test ping action through this route
    if (body.action === "test") {
      return executeTestDelivery(id, body, session);
    }

    const { url, events = ["error_spike", "latency_breach"], active = true } = body;

    if (!url || typeof url !== "string" || !url.trim().match(/^https?:\/\/.+/i)) {
      return NextResponse.json(
        { error: "A valid HTTP or HTTPS destination URL is required" },
        { status: 400 }
      );
    }

    // Generate secret key using crypto.randomBytes
    const secretKey = `whsec_${crypto.randomBytes(24).toString("hex")}`;
    const eventString = Array.isArray(events) ? events.join(",") : String(events);

    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: id,
        url: url.trim(),
        secretKey,
        events: eventString,
        active: Boolean(active),
      },
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "WEBHOOK_CREATED",
      details: `Configured outbound webhook destination '${url.trim()}' with events [${eventString}]`,
    });

    return NextResponse.json(
      {
        webhook: {
          id: webhook.id,
          workspaceId: webhook.workspaceId,
          url: webhook.url,
          secretKey: webhook.secretKey,
          events: webhook.events.split(","),
          active: webhook.active,
          createdAt: webhook.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create webhook error:", error);
    return NextResponse.json({ error: "Failed to configure webhook" }, { status: 500 });
  }
}

export async function PATCH(
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
    const { webhookId, active, url, events } = body;

    if (!webhookId) {
      return NextResponse.json({ error: "webhookId is required" }, { status: 400 });
    }

    const existing = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!existing || existing.workspaceId !== id) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (active !== undefined) dataToUpdate.active = Boolean(active);
    if (url && typeof url === "string") dataToUpdate.url = url.trim();
    if (events) {
      dataToUpdate.events = Array.isArray(events) ? events.join(",") : String(events);
    }

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data: dataToUpdate,
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "WEBHOOK_UPDATED",
      details: `Updated webhook ${updated.url} (active: ${updated.active})`,
    });

    return NextResponse.json({
      webhook: {
        id: updated.id,
        url: updated.url,
        secretKey: updated.secretKey,
        events: updated.events.split(","),
        active: updated.active,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error("Update webhook error:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
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
    const webhookId = url.searchParams.get("webhookId");

    if (!webhookId) {
      return NextResponse.json({ error: "webhookId query parameter is required" }, { status: 400 });
    }

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.workspaceId !== id) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await prisma.webhook.delete({
      where: { id: webhookId },
    });

    await recordAuditLog({
      workspaceId: id,
      userId: session.id,
      userEmail: session.email,
      action: "WEBHOOK_DELETED",
      details: `Removed outbound webhook endpoint '${webhook.url}'`,
    });

    return NextResponse.json({ success: true, message: "Webhook deleted" });
  } catch (error) {
    console.error("Delete webhook error:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}

async function executeTestDelivery(
  workspaceId: string,
  body: any,
  session: { id: string; email: string }
) {
  let targetUrl = body.url;
  let secretKey = body.secretKey;

  if (body.webhookId) {
    const wh = await prisma.webhook.findUnique({ where: { id: body.webhookId } });
    if (wh && wh.workspaceId === workspaceId) {
      targetUrl = wh.url;
      secretKey = wh.secretKey;
    }
  }

  if (!targetUrl || !secretKey) {
    return NextResponse.json(
      { error: "Target URL and secret key are required for test ping" },
      { status: 400 }
    );
  }

  // SSRF Protection: Prevent SSRF against cloud metadata or dangerous services
  try {
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "Only http and https protocols are permitted" },
        { status: 400 }
      );
    }
    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = [
      "169.254.169.254", // AWS/GCP/Azure link-local metadata
      "metadata.google.internal",
      "instance-data",
      "100.100.100.200", // Alibaba cloud metadata
    ];
    if (blockedHosts.includes(hostname)) {
      return NextResponse.json(
        { error: "Requests to internal infrastructure and cloud metadata services are prohibited" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid target destination URL" }, { status: 400 });
  }

  const payload = {
    event: "test.ping",
    workspaceId,
    timestamp: new Date().toISOString(),
    deliveryId: `del_${crypto.randomBytes(12).toString("hex")}`,
    data: {
      message: "Nexora test notification: outbound webhook delivery operational.",
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
        "User-Agent": "Nexora-Webhook-Dispatcher/1.0",
        "X-Nexora-Signature": signature,
        "X-Nexora-Event": "test.ping",
        "X-Nexora-Timestamp": payload.timestamp,
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
    workspaceId,
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
}
