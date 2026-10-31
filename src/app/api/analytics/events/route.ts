import { NextRequest, NextResponse } from "next/server";
import {
  recordFunnelEvent,
  FunnelStage,
  FUNNEL_STAGES,
  EVENT_TO_STAGE_MAP,
  STANDARD_ANALYTICS_EVENTS,
} from "@/lib/funnel-analytics";
import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/auth";
import { checkWorkspacePermission, checkOrganizationPermission } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const isLoopback = ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";

    // Rate limiter: 120 client events per minute per IP to prevent spamming
    const rl = checkRateLimit(`funnel_evt_${ip}`, {
      limit: isLoopback ? 2000 : 120,
      windowMs: 60 * 1000,
    });
    if (!rl.success) {
      return rateLimitExceededResponse(rl, "Telemetry rate limit exceeded.");
    }

    const body = await req.json().catch(() => ({}));
    const {
      sessionId,
      stage: rawStage,
      eventName,
      idempotencyKey,
      organizationId,
      workspaceId,
      path,
      referrer,
      metadata,
    } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Valid sessionId is required" }, { status: 400 });
    }

    if (!eventName || typeof eventName !== "string") {
      return NextResponse.json({ error: "Valid eventName is required" }, { status: 400 });
    }

    // Determine funnel stage: either explicitly provided or mapped from standard eventName
    let stage: FunnelStage | undefined;
    if (rawStage && FUNNEL_STAGES.includes(rawStage as FunnelStage)) {
      stage = rawStage as FunnelStage;
    } else if (EVENT_TO_STAGE_MAP[eventName]) {
      stage = EVENT_TO_STAGE_MAP[eventName];
    } else {
      return NextResponse.json(
        {
          error: `Invalid stage or eventName. Supported stages: ${FUNNEL_STAGES.join(
            ", "
          )}. Supported standard events: ${STANDARD_ANALYTICS_EVENTS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Attempt optional session identification
    const session = await getSessionUser(req);
    const userId = session?.id || null;

    // Tenant Isolation & RBAC validation:
    // If organizationId or workspaceId is specified and a user session exists,
    // ensure the user is an authorized member to avoid cross-tenant spoofing.
    if (workspaceId && typeof workspaceId === "string") {
      if (userId) {
        const wsPerm = await checkWorkspacePermission(userId, workspaceId, "VIEWER");
        if (!wsPerm.allowed) {
          return NextResponse.json({ error: "Forbidden: Not a member of the specified workspace" }, { status: 403 });
        }
      }
    }

    if (organizationId && typeof organizationId === "string") {
      if (userId) {
        const orgPerm = await checkOrganizationPermission(userId, organizationId, "VIEWER");
        if (!orgPerm.allowed) {
          return NextResponse.json({ error: "Forbidden: Not a member of the specified organization" }, { status: 403 });
        }
      }
    }

    const userAgent = req.headers.get("user-agent") || null;

    const result = await recordFunnelEvent({
      sessionId: sessionId.trim(),
      stage,
      eventName: eventName.trim(),
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey.trim().slice(0, 100) : null,
      userId,
      organizationId: typeof organizationId === "string" ? organizationId : null,
      workspaceId: typeof workspaceId === "string" ? workspaceId : null,
      path: typeof path === "string" ? path.slice(0, 200) : null,
      referrer: typeof referrer === "string" ? referrer.slice(0, 200) : null,
      metadata: typeof metadata === "object" ? metadata : null,
      ipAddress: ip,
      userAgent,
      isServerVerified: false,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

