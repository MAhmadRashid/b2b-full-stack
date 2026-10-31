export interface ApiScopeDefinition {
  id: string;
  label: string;
  description: string;
  category: "ingestion" | "analytics" | "management" | "security";
}

export const API_SCOPES: Record<string, ApiScopeDefinition> = {
  "events:write": {
    id: "events:write",
    label: "Ingest Events & Telemetry",
    description: "Submit telemetry pings, event payloads, and streaming client logs",
    category: "ingestion",
  },
  "metrics:read": {
    id: "metrics:read",
    label: "Read Analytics & Metrics",
    description: "Query aggregated latency percentiles, error rates, and usage data",
    category: "analytics",
  },
  "workspaces:read": {
    id: "workspaces:read",
    label: "Read Workspace Metadata",
    description: "Access workspace profile, environment configs, and health status",
    category: "management",
  },
  "audit:read": {
    id: "audit:read",
    label: "Read Audit Logs",
    description: "Inspect immutable security audit trails and administrative actions",
    category: "security",
  },
  "webhooks:write": {
    id: "webhooks:write",
    label: "Manage Webhook Dispatchers",
    description: "Trigger test webhook payloads and configure external endpoints",
    category: "management",
  },
  "admin:all": {
    id: "admin:all",
    label: "Full Administrative Access",
    description: "Complete unrestricted access across all developer APIs (Owner/Admin only)",
    category: "security",
  },
};

export const DEFAULT_SCOPES = ["events:write", "metrics:read"];

/**
 * Parses scopes from string (comma-separated) or array into a deduplicated array of valid strings.
 */
export function parseScopes(input: string | string[] | undefined | null): string[] {
  if (!input) return [...DEFAULT_SCOPES];
  const list = Array.isArray(input)
    ? input
    : input.split(",").map((s) => s.trim());

  const valid = list.filter((s) => Boolean(s) && (s in API_SCOPES || s === "*"));
  return Array.from(new Set(valid.length > 0 ? valid : DEFAULT_SCOPES));
}

/**
 * Checks if granted scopes contain the required scope or wildcard admin:all
 */
export function hasScope(
  grantedScopes: string | string[] | undefined | null,
  requiredScope: string
): boolean {
  if (!requiredScope) return true;
  const scopes = parseScopes(grantedScopes);
  if (scopes.includes("admin:all") || scopes.includes("*")) return true;
  return scopes.includes(requiredScope);
}
