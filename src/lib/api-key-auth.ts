import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "./rate-limit";
import { hasScope, parseScopes } from "./api-scopes";
import { getPlan, PlanId } from "./billing-plans";

export interface AuthenticatedApiKeyContext {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  userId: string;
  workspaceId: string | null;
  organizationId: string | null;
  workspace?: any | null;
  organization?: any | null;
}

export interface ApiAuthOptions {
  requiredScope?: string;
  maxBodySizeBytes?: number; // Default: 1MB (1,048,576 bytes)
}

export interface ApiAuthResult {
  success: boolean;
  status: number;
  error?: string;
  message?: string;
  expiredAt?: Date | null;
  context?: AuthenticatedApiKeyContext;
  rateLimitHeaders?: Record<string, string>;
}

const MAX_DEFAULT_BODY_SIZE = 1048576; // 1MB

/**
 * Validates incoming API keys from Authorization header (Bearer pfl_...) or X-API-Key.
 * Verifies existence, bcrypt hash, revocation status, expiration, scopes, rate limits, and subscription quota.
 */
export async function authenticateApiKey(
  req: NextRequest,
  options?: ApiAuthOptions
): Promise<ApiAuthResult> {
  // 1. Extract API Key
  const authHeader = req.headers.get("authorization");
  const customHeader = req.headers.get("x-api-key");
  let rawKey = "";

  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawKey = authHeader.replace("Bearer ", "").trim();
  } else if (customHeader) {
    rawKey = customHeader.trim();
  }

  if (!rawKey) {
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
      message:
        "Missing API Key. Provide via 'Authorization: Bearer pfl_...' or 'X-API-Key' header.",
    };
  }

  // 2. Request body size check if Content-Length header is present
  const contentLength = req.headers.get("content-length");
  const maxBytes = options?.maxBodySizeBytes || MAX_DEFAULT_BODY_SIZE;
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return {
      success: false,
      status: 413,
      error: "Payload Too Large",
      message: `Request size exceeds maximum limit of ${Math.round(maxBytes / 1024)}KB.`,
    };
  }

  // 3. High-performance O(1) indexed lookup via keyPrefix or previousPrefix
  let candidateKeys: any[] = [];
  if (rawKey.length >= 17) {
    const candidatePrefix = `${rawKey.substring(0, 13)}...${rawKey.substring(rawKey.length - 4)}`;
    candidateKeys = await prisma.apiKey.findMany({
      where: {
        OR: [
          { keyPrefix: candidatePrefix },
          { previousPrefix: candidatePrefix },
        ],
      },
      include: {
        workspace: true,
        organization: true,
      },
    });
  }

  // Fallback lookup if prefix not found
  if (candidateKeys.length === 0) {
    candidateKeys = await prisma.apiKey.findMany({
      take: 25,
      include: {
        workspace: true,
        organization: true,
      },
    });
  }

  let matchedKey: (typeof candidateKeys)[0] | null = null;
  let isPreviousKeyInGrace = false;

  for (const candidate of candidateKeys) {
    // Primary active secret comparison
    const isMatch = await bcrypt.compare(rawKey, candidate.hashedKey);
    if (isMatch) {
      matchedKey = candidate;
      break;
    }

    // Zero-downtime rotation: check previous secret if grace period is active
    if (
      candidate.previousHashedKey &&
      candidate.gracePeriodEndsAt &&
      new Date(candidate.gracePeriodEndsAt) > new Date()
    ) {
      const isPrevMatch = await bcrypt.compare(rawKey, candidate.previousHashedKey);
      if (isPrevMatch) {
        matchedKey = candidate;
        isPreviousKeyInGrace = true;
        break;
      }
    }
  }

  if (!matchedKey) {
    return {
      success: false,
      status: 403,
      error: "Forbidden",
      message: "Invalid or inactive API key.",
    };
  }

  // 4. Revocation check
  if (matchedKey.revoked) {
    return {
      success: false,
      status: 403,
      error: "Forbidden",
      message: "This API key has been revoked and can no longer be used.",
    };
  }

  // 5. Expiration check
  if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
    return {
      success: false,
      status: 401,
      error: "Expired",
      message: "API key has expired. Please rotate or generate a new key in the developer dashboard.",
      expiredAt: matchedKey.expiresAt,
    };
  }

  // 5.1 IP Whitelisting / CIDR restrictions check
  const { extractClientIp, validateIpRestriction } = await import("@/lib/ip-guard");
  const clientIp = extractClientIp(
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip"),
    req.headers.get("cf-connecting-ip")
  );

  const ipCheck = validateIpRestriction(clientIp, matchedKey.ipRestrictions);
  if (!ipCheck.allowed) {
    return {
      success: false,
      status: 403,
      error: "Forbidden",
      message: ipCheck.reason || "Client IP is not permitted to use this API key.",
    };
  }

  // 6. Scope authorization check
  const grantedScopes = parseScopes(matchedKey.scopes);
  if (options?.requiredScope && !hasScope(grantedScopes, options.requiredScope)) {
    return {
      success: false,
      status: 403,
      error: "Forbidden",
      message: `Insufficient permissions: API key lacks required scope '${options.requiredScope}'. Granted scopes: [${grantedScopes.join(", ")}].`,
    };
  }

  // 7. Token Bucket Rate Limiting per active API key
  const limitPerMinute = matchedKey.rateLimit || 120;
  const rl = checkRateLimit(`apikey_${matchedKey.id}`, {
    limit: limitPerMinute,
    windowMs: 60000,
  });

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": rl.limit.toString(),
    "X-RateLimit-Remaining": rl.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(rl.resetMs / 1000).toString(),
  };

  if (!rl.success) {
    return {
      success: false,
      status: 429,
      error: "Rate Limit Exceeded",
      message: `Exceeded quota limit of ${limitPerMinute} requests per minute for this API key.`,
      rateLimitHeaders: {
        ...rateLimitHeaders,
        "Retry-After": Math.ceil(rl.resetMs / 1000).toString(),
      },
    };
  }

  // 8. Subscription-Based Monthly API Usage Limit Check
  const effectiveOrg = matchedKey.organization;
  const effectiveWs = matchedKey.workspace;

  let currentUsage = 0;
  let maxQuota = 100000;

  if (effectiveWs) {
    const { resolveEffectivePlanConfig } = await import("@/lib/plan-resolver");
    const planConfig = resolveEffectivePlanConfig({
      plan: effectiveWs.plan,
      organization: effectiveOrg ? { plan: effectiveOrg.plan } : null,
    });
    maxQuota = planConfig?.limits?.monthlyRequests || effectiveWs.monthlyRequestLimit || 100000;
    currentUsage = effectiveWs.requestsThisMonth || 0;
  } else if (effectiveOrg) {
    const orgPlanConfig = getPlan((effectiveOrg.plan || "FREE") as PlanId);
    maxQuota = orgPlanConfig.limits.monthlyRequests;
  }

  if (currentUsage >= maxQuota) {
    return {
      success: false,
      status: 429,
      error: "Quota Exceeded",
      message: `Monthly subscription API request limit reached (${currentUsage.toLocaleString()} / ${maxQuota.toLocaleString()}). Please upgrade your plan.`,
      rateLimitHeaders,
    };
  }

  return {
    success: true,
    status: 200,
    context: {
      id: matchedKey.id,
      name: matchedKey.name,
      keyPrefix: matchedKey.keyPrefix,
      scopes: grantedScopes,
      rateLimit: limitPerMinute,
      userId: matchedKey.userId,
      workspaceId: matchedKey.workspaceId,
      organizationId: matchedKey.organizationId,
      workspace: effectiveWs,
      organization: effectiveOrg,
    },
    rateLimitHeaders,
  };
}

/**
 * Tracks an API request asynchronously into the database without storing sensitive payloads.
 */
export async function logApiRequest(params: {
  apiKeyId?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  endpoint: string;
  method?: string;
  statusCode: number;
  durationMs: number;
  req?: NextRequest;
}): Promise<void> {
  try {
    const {
      apiKeyId,
      organizationId,
      workspaceId,
      endpoint,
      method = "POST",
      statusCode,
      durationMs,
      req,
    } = params;

    let ipAddress = "127.0.0.1";
    let userAgent = "unknown";

    if (req) {
      ipAddress =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1";
      userAgent = req.headers.get("user-agent")?.substring(0, 200) || "external-client";
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const ops: any[] = [
      prisma.apiRequestLog.create({
        data: {
          apiKeyId: apiKeyId || null,
          organizationId: organizationId || null,
          workspaceId: workspaceId || null,
          endpoint,
          method,
          statusCode,
          ipAddress,
          userAgent,
          durationMs,
        },
      }),
    ];

    if (apiKeyId) {
      ops.push(
        prisma.apiKey.update({
          where: { id: apiKeyId },
          data: { lastUsedAt: new Date() },
        })
      );
    }

    if (workspaceId) {
      ops.push(
        prisma.workspace.update({
          where: { id: workspaceId },
          data: { requestsThisMonth: { increment: 1 } },
        })
      );
      ops.push(
        prisma.usageRecord.upsert({
          where: {
            workspaceId_date: {
              workspaceId,
              date: today,
            },
          },
          create: {
            workspaceId,
            date: today,
            totalEvents: 1,
            errorsCount: statusCode >= 400 ? 1 : 0,
            avgLatency: durationMs,
          },
          update: {
            totalEvents: { increment: 1 },
            ...(statusCode >= 400 && { errorsCount: { increment: 1 } }),
          },
        })
      );
    }

    await prisma.$transaction(ops);
  } catch (err) {
    console.error("Failed to log API request:", err);
  }
}
