"use client";

/**
 * Privacy-friendly, lightweight client analytics tracker for CTA conversion and funnels.
 * Respects browser Do Not Track (DNT) / Global Privacy Control (GPC).
 * Zero PII or external cookie leakage.
 */

export type AnalyticsCategory =
  | "CTA"
  | "NAVIGATION"
  | "DEMO_FILTER"
  | "LEAD_CAPTURE"
  | "DEMO_BOOKING"
  | "PRICING"
  | "AUTH"
  | "ONBOARDING"
  | "BILLING";

export type FunnelStageName =
  | "LANDING_VISIT"
  | "TRIAL_CTA_CLICK"
  | "SIGNUP_STARTED"
  | "SIGNUP_COMPLETED"
  | "ORG_WORKSPACE_CREATED"
  | "ONBOARDING_STEP_COMPLETED"
  | "TRIAL_STARTED"
  | "SUBSCRIPTION_ACTIVATED";

interface AnalyticsEvent {
  eventName: string;
  category: AnalyticsCategory;
  funnelStage?: FunnelStageName;
  properties?: Record<string, string | number | boolean | null | undefined>;
  timestamp: string;
}

// Generate or retrieve persistent anonymous session ID (UUIDv4 format)
function getAnonymousSessionId(): string {
  if (typeof window === "undefined") return "server-sess";
  try {
    let sess = localStorage.getItem("pf_anon_sess");
    if (!sess) {
      sess = "sess_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem("pf_anon_sess", sess);
    }
    return sess;
  } catch {
    return "ephemeral_sess";
  }
}

export function trackEvent(
  eventName: string,
  category: AnalyticsCategory,
  properties?: Record<string, string | number | boolean | null | undefined>,
  funnelStage?: FunnelStageName
) {
  if (typeof window === "undefined") return;

  // Respect user privacy preferences: DNT & GPC
  if (
    navigator.doNotTrack === "1" ||
    (window as any).doNotTrack === "1" ||
    (navigator as any).globalPrivacyControl === true
  ) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[Analytics Suppressed by DNT/GPC]:", eventName);
    }
    return;
  }

  const sessionId = getAnonymousSessionId();
  const payload: AnalyticsEvent = {
    eventName,
    category,
    funnelStage,
    properties: {
      ...properties,
      path: window.location.pathname,
      referrer: document.referrer ? new URL(document.referrer, window.location.origin).origin : "direct",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Store in session storage for local debugging and session continuity
    const existing = JSON.parse(sessionStorage.getItem("pf_analytics_events") || "[]");
    existing.push(payload);
    if (existing.length > 50) existing.shift();
    sessionStorage.setItem("pf_analytics_events", JSON.stringify(existing));

    // 2. Dispatch custom DOM event
    window.dispatchEvent(new CustomEvent("pulseflow_analytics", { detail: payload }));

    // 3. Dispatch to secure server-side ingestion endpoint (asynchronous fire-and-forget)
    if (funnelStage) {
      fetch("/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          stage: funnelStage,
          eventName,
          path: window.location.pathname,
          referrer: document.referrer ? new URL(document.referrer, window.location.origin).origin : "direct",
          metadata: properties,
        }),
      }).catch(() => {
        // Suppress network errors silently
      });
    }
  } catch {
    // Fail silently without breaking user experience
  }
}

