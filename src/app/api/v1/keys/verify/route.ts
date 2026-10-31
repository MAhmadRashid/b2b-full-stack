import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, logApiRequest } from "@/lib/api-key-auth";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const auth = await authenticateApiKey(req);

  if (!auth.success || !auth.context) {
    return NextResponse.json(
      { error: auth.error, message: auth.message, expiredAt: auth.expiredAt },
      { status: auth.status, headers: auth.rateLimitHeaders }
    );
  }

  const durationMs = Date.now() - startTime;
  await logApiRequest({
    apiKeyId: auth.context.id,
    organizationId: auth.context.organizationId,
    workspaceId: auth.context.workspaceId,
    endpoint: "/api/v1/keys/verify",
    method: "POST",
    statusCode: 200,
    durationMs,
    req,
  });

  return NextResponse.json(
    {
      valid: true,
      apiKey: {
        id: auth.context.id,
        name: auth.context.name,
        keyPrefix: auth.context.keyPrefix,
        scopes: auth.context.scopes,
        rateLimit: auth.context.rateLimit,
      },
      workspace: auth.context.workspace
        ? {
            id: auth.context.workspace.id,
            name: auth.context.workspace.name,
            slug: auth.context.workspace.slug,
          }
        : null,
      organization: auth.context.organization
        ? {
            id: auth.context.organization.id,
            name: auth.context.organization.name,
            plan: auth.context.organization.plan,
          }
        : null,
    },
    { headers: auth.rateLimitHeaders }
  );
}
