import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, logApiRequest } from "@/lib/api-key-auth";
import { getPlan, PlanId } from "@/lib/billing-plans";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const auth = await authenticateApiKey(req, { requiredScope: "metrics:read" });

  if (!auth.success || !auth.context) {
    return NextResponse.json(
      { error: auth.error, message: auth.message, expiredAt: auth.expiredAt },
      { status: auth.status, headers: auth.rateLimitHeaders }
    );
  }

  const org = auth.context.organization;
  const ws = auth.context.workspace;

  const planId = (org?.plan || ws?.plan || "FREE") as PlanId;
  const planConfig = getPlan(planId);

  const currentUsage = ws ? ws.requestsThisMonth : 0;
  const quotaLimit = planConfig.limits.monthlyRequests;
  const remaining = Math.max(0, quotaLimit - currentUsage);

  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const durationMs = Date.now() - startTime;
  await logApiRequest({
    apiKeyId: auth.context.id,
    organizationId: auth.context.organizationId,
    workspaceId: auth.context.workspaceId,
    endpoint: "/api/v1/usage",
    method: "GET",
    statusCode: 200,
    durationMs,
    req,
  });

  return NextResponse.json(
    {
      plan: {
        id: planConfig.id,
        name: planConfig.name,
      },
      quota: {
        currentMonthlyRequests: currentUsage,
        monthlyRequestLimit: quotaLimit,
        remainingRequests: remaining,
        percentageUsed: Number(((currentUsage / quotaLimit) * 100).toFixed(1)),
        resetsAt: resetDate.toISOString(),
      },
      rateLimits: {
        requestsPerMinute: auth.context.rateLimit,
      },
      key: {
        id: auth.context.id,
        keyPrefix: auth.context.keyPrefix,
        scopes: auth.context.scopes,
      },
    },
    { headers: auth.rateLimitHeaders }
  );
}
