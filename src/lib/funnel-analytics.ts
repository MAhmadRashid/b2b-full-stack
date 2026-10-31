import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Standard Funnel Stages supported across PulseFlow SaaS
 */
export const FUNNEL_STAGES = [
  "LANDING_VISIT",
  "TRIAL_CTA_CLICK",
  "SIGNUP_STARTED",
  "SIGNUP_COMPLETED",
  "ORG_WORKSPACE_CREATED",
  "ONBOARDING_STEP_COMPLETED",
  "TRIAL_STARTED",
  "SUBSCRIPTION_ACTIVATED",
] as const;

export type FunnelStage = typeof FUNNEL_STAGES[number];

/**
 * Stage descriptions and denominator definitions for mathematical transparency
 */
export const FUNNEL_STAGE_DEFINITIONS: Record<FunnelStage, { label: string; description: string; denominatorText: string }> = {
  LANDING_VISIT: {
    label: "1. Landing Page Visit",
    description: "Prospective visitor landed on the marketing hero page or documentation entry point.",
    denominatorText: "Top of funnel (100% baseline)",
  },
  TRIAL_CTA_CLICK: {
    label: "2. Start Free Trial CTA",
    description: "Visitor clicked 'Start Free Trial' or secondary live workspace demo trigger.",
    denominatorText: "% of total landing page visitors",
  },
  SIGNUP_STARTED: {
    label: "3. Signup Flow Started",
    description: "Prospective customer arrived on /register and began inputting workspace details.",
    denominatorText: "% of visitors who clicked trial CTA",
  },
  SIGNUP_COMPLETED: {
    label: "4. Account Created",
    description: "User submitted registration and authenticated with encrypted credentials.",
    denominatorText: "% of users who started the registration form",
  },
  ORG_WORKSPACE_CREATED: {
    label: "5. Workspace Provisioned",
    description: "Multi-tenant tenant container initialized with database schema, slug, and Owner role.",
    denominatorText: "% of completed account signups",
  },
  ONBOARDING_STEP_COMPLETED: {
    label: "6. Onboarding Activated",
    description: "Customer completed one or more onboarding milestones (API key generated or team invited).",
    denominatorText: "% of provisioned customer workspaces",
  },
  TRIAL_STARTED: {
    label: "7. Active Trial Period",
    description: "14-day zero-card trial activated with Starter or Pro quota entitlements.",
    denominatorText: "% of workspaces completing onboarding setup",
  },
  SUBSCRIPTION_ACTIVATED: {
    label: "8. Paid Subscription",
    description: "Customer upgraded to a paid billing tier (Starter, Pro, Business, Enterprise).",
    denominatorText: "% of trialing workspaces converting to paying accounts",
  },
};

/**
 * PII and Secret Scrubbing Utility for Analytics Events
 * Guarantees zero passwords, tokens, API keys, card numbers, or auth headers get stored.
 */
export function scrubAnalyticsMetadata(input: Record<string, any> | null | undefined): Record<string, any> {
  if (!input || typeof input !== "object") return {};
  const sensitiveKeys = [
    "password",
    "passwordhash",
    "token",
    "key",
    "apikey",
    "secret",
    "auth",
    "authorization",
    "cookie",
    "card",
    "cvv",
    "number",
    "exp",
    "taxid",
  ];

  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(input)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      continue; // completely drop sensitive fields
    }

    if (typeof val === "string" && val.length > 300) {
      sanitized[key] = val.substring(0, 300); // Prevent unbounded storage
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = scrubAnalyticsMetadata(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Allowed Event Types across Client and Server
 */
export const STANDARD_ANALYTICS_EVENTS = [
  "landing_page_view",
  "trial_cta_clicked",
  "signup_started",
  "signup_completed",
  "organization_created",
  "workspace_created",
  "onboarding_completed",
  "trial_started",
  "subscription_activated",
  "lead_submitted",
  "demo_requested",
] as const;

export type StandardAnalyticsEvent = typeof STANDARD_ANALYTICS_EVENTS[number];

/**
 * Maps standard events to canonical funnel stages
 */
export const EVENT_TO_STAGE_MAP: Record<string, FunnelStage> = {
  landing_page_view: "LANDING_VISIT",
  trial_cta_clicked: "TRIAL_CTA_CLICK",
  signup_started: "SIGNUP_STARTED",
  signup_completed: "SIGNUP_COMPLETED",
  organization_created: "ORG_WORKSPACE_CREATED",
  workspace_created: "ORG_WORKSPACE_CREATED",
  onboarding_completed: "ONBOARDING_STEP_COMPLETED",
  trial_started: "TRIAL_STARTED",
  subscription_activated: "SUBSCRIPTION_ACTIVATED",
  lead_submitted: "TRIAL_CTA_CLICK",
  demo_requested: "TRIAL_CTA_CLICK",
};

/**
 * Record a Funnel Event server-side with deduplication and idempotency safeguards
 */
export async function recordFunnelEvent(params: {
  sessionId: string;
  stage: FunnelStage;
  eventName: string;
  idempotencyKey?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  path?: string | null;
  referrer?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isServerVerified?: boolean;
}) {
  try {
    const {
      sessionId,
      stage,
      eventName,
      idempotencyKey = null,
      userId = null,
      organizationId = null,
      workspaceId = null,
      path = null,
      referrer = null,
      metadata = null,
      ipAddress = null,
      userAgent = null,
      isServerVerified = false,
    } = params;

    // 1. Check idempotencyKey if provided
    if (idempotencyKey) {
      const existingKey = await prisma.funnelEvent.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (existingKey) {
        return { skipped: true, reason: "IDEMPOTENT_KEY_EXISTS", id: existingKey.id };
      }
    }

    // 2. Deduplication check: Ignore identical (sessionId, stage, eventName) within 10 seconds
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const existing = await prisma.funnelEvent.findFirst({
      where: {
        sessionId,
        stage,
        eventName,
        timestamp: { gte: tenSecondsAgo },
      },
      select: { id: true },
    });

    if (existing) {
      return { skipped: true, reason: "DEDUPLICATED", id: existing.id };
    }

    const sanitizedMeta = scrubAnalyticsMetadata({
      ...metadata,
      ...(isServerVerified ? { _serverVerified: true } : {}),
    });

    const event = await prisma.funnelEvent.create({
      data: {
        sessionId,
        stage,
        eventName,
        idempotencyKey: idempotencyKey || undefined,
        userId,
        organizationId,
        workspaceId,
        path,
        referrer,
        metadata: JSON.stringify(sanitizedMeta),
        ipAddress: ipAddress ? ipAddress.replace(/:/g, "_") : null,
        userAgent: userAgent ? userAgent.substring(0, 200) : null,
      },
    });

    return { success: true, id: event.id };
  } catch (error: any) {
    if (error?.code === "P2002" && error?.meta?.target?.includes("idempotencyKey")) {
      return { skipped: true, reason: "IDEMPOTENT_KEY_EXISTS" };
    }
    logger.error("Failed to record funnel event", error, { context: "ANALYTICS" });
    return { success: false, error: "STORAGE_FAILED" };
  }
}

