"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../DashboardContext";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Play,
  Terminal,
  ShieldAlert,
  X,
  Code2,
  RefreshCw,
  BarChart3,
  BookOpen,
  Clock,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  Lock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { API_SCOPES, parseScopes } from "@/lib/api-scopes";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  previousPrefix?: string | null;
  gracePeriodEndsAt?: string | null;
  ipRestrictions?: string | null;
  scopes: string[];
  rateLimit?: number;
  revoked: boolean;
  revokedAt?: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  creator: string;
  workspaceName?: string;
}

interface ApiUsageData {
  usage: {
    currentMonth: number;
    monthlyLimit: number;
    percentage: number;
    remaining: number;
    resetDate: string;
  };
  stats: {
    activeKeys: number;
    avgLatencyMs: number;
    totalLoggedRequests: number;
  };
  dailyTrends: Array<{ date: string; requests: number; errors: number; avgLatency: number }>;
  endpoints: Array<{ endpoint: string; requests: number; avgLatencyMs: number }>;
  statusDistribution: { "2xx": number; "4xx": number; "5xx": number };
  recentRequests: Array<{
    id: string;
    endpoint: string;
    method: string;
    statusCode: number;
    durationMs: number;
    timestamp: string;
    ipAddress: string;
  }>;
}

export default function ApiKeysPage() {
  const { activeWorkspace, activeOrganization } = useDashboard();
  const [activeTab, setActiveTab] = useState<"keys" | "usage" | "sandbox" | "docs">("keys");

  // Key state
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  // Generate Key Modal
  const [createModal, setCreateModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyEnv, setKeyEnv] = useState<"live" | "test">("live");
  const [expiresIn, setExpiresIn] = useState<string>("never");
  const [scopes, setScopes] = useState<string[]>(["events:write", "metrics:read"]);
  const [keyRateLimit, setKeyRateLimit] = useState(120);
  const [ipRestrictions, setIpRestrictions] = useState("");

  // Secret Key Reveal Modal
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Rotate Key Modal
  const [rotateTargetKey, setRotateTargetKey] = useState<ApiKeyItem | null>(null);
  const [rotateGraceHours, setRotateGraceHours] = useState<number>(24);
  const [rotating, setRotating] = useState(false);

  // Usage Analytics State
  const [usageData, setUsageData] = useState<ApiUsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Sandbox State
  const [selectedEndpoint, setSelectedEndpoint] = useState<"/api/v1/ingest" | "/api/v1/metrics" | "/api/v1/usage" | "/api/v1/keys/verify">("/api/v1/ingest");
  const [sandboxApiKey, setSandboxApiKey] = useState("");
  const [sandboxPayload, setSandboxPayload] = useState(
    JSON.stringify(
      {
        eventType: "telemetry_ping",
        source: "developer-portal-sandbox",
        payload: {
          runtime: "node-22",
          memoryUsageMb: 84.5,
          activeGoroutines: 12,
        },
      },
      null,
      2
    )
  );
  const [sandboxResponse, setSandboxResponse] = useState<any>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const fetchKeys = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/keys`);
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setCanManage(data.canManage);
        if (data.keys && data.keys.length > 0 && !sandboxApiKey) {
          // If a key exists, prefill sandbox key selector placeholder
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageData = async () => {
    if (!activeWorkspace) return;
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/api-usage`);
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch (err) {
      console.error("Failed to load usage data:", err);
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    if (activeTab === "usage") {
      fetchUsageData();
    }
  }, [activeWorkspace?.id, activeTab]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim() || !activeWorkspace) return;

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim(),
          environment: keyEnv,
          scopes,
          expiresIn,
          rateLimit: keyRateLimit,
          ipRestrictions: ipRestrictions.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreateModal(false);
        setKeyName("");
        setIpRestrictions("");
        setRevealedKey(data.apiKey.rawKey);
        setSandboxApiKey(data.apiKey.rawKey);
        await fetchKeys();
      } else {
        alert(data.error || data.message || "Failed to create API key");
      }
    } catch (err) {
      console.error(err);
      alert("Network error generating API key");
    }
  };

  const handleRotateKey = async () => {
    if (!rotateTargetKey || !activeWorkspace) return;
    setRotating(true);
    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/keys/${rotateTargetKey.id}/rotate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expiresIn: "never",
            gracePeriodHours: rotateGraceHours,
          }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        setRotateTargetKey(null);
        setRevealedKey(data.apiKey.rawKey);
        setSandboxApiKey(data.apiKey.rawKey);
        await fetchKeys();
      } else {
        alert(data.error || "Failed to rotate API key");
      }
    } catch (err) {
      console.error(err);
      alert("Network error rotating API key");
    } finally {
      setRotating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Applications using it will immediately be rejected with HTTP 403.")) {
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace?.id}/keys?keyId=${keyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scopeId: string) => {
    if (scopes.includes(scopeId)) {
      setScopes(scopes.filter((s) => s !== scopeId));
    } else {
      setScopes([...scopes, scopeId]);
    }
  };

  // Test Sandbox Execution
  const handleTestSandbox = async () => {
    setSandboxLoading(true);
    setSandboxResponse(null);
    const start = Date.now();

    try {
      let reqBody: any = undefined;
      const method = selectedEndpoint === "/api/v1/metrics" || selectedEndpoint === "/api/v1/usage" ? "GET" : "POST";

      if (method === "POST") {
        try {
          reqBody = JSON.parse(sandboxPayload);
        } catch {
          alert("Payload must be valid JSON");
          setSandboxLoading(false);
          return;
        }
      }

      const res = await fetch(selectedEndpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sandboxApiKey.trim()}`,
        },
        body: reqBody ? JSON.stringify(reqBody) : undefined,
      });

      const responseJson = await res.json().catch(() => ({}));
      const elapsed = Date.now() - start;

      const headersObj: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        if (k.startsWith("x-") || k === "content-type" || k === "retry-after") {
          headersObj[k] = v;
        }
      });

      setSandboxResponse({
        status: res.status,
        statusText: res.statusText,
        elapsedMs: elapsed,
        headers: headersObj,
        data: responseJson,
      });
    } catch (err: any) {
      setSandboxResponse({
        status: 500,
        statusText: "Network Error",
        elapsedMs: Date.now() - start,
        headers: {},
        data: { error: err.message },
      });
    } finally {
      setSandboxLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
            <Key className="w-3.5 h-3.5" /> Developer Tools & Credentials
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            API Keys & Developer Portal
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Manage high-entropy API secrets, inspect real-time endpoint usage, test requests, and review API documentation.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition duration-150 self-start sm:self-auto cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
              color: "#ffffff",
              boxShadow: "0 4px 16px rgba(99, 102, 241, 0.35)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
            <span style={{ color: "#ffffff" }}>Generate New API Key</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          paddingBottom: "8px",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("keys")}
          className={`dev-tab-btn ${activeTab === "keys" ? "active" : ""}`}
        >
          <Key size={15} color={activeTab === "keys" ? "#818cf8" : "#94a3b8"} />
          <span>API Keys ({keys.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("usage")}
          className={`dev-tab-btn ${activeTab === "usage" ? "active" : ""}`}
        >
          <BarChart3 size={15} color={activeTab === "usage" ? "#818cf8" : "#94a3b8"} />
          <span>Usage Analytics & Quotas</span>
        </button>

        <button
          onClick={() => setActiveTab("sandbox")}
          className={`dev-tab-btn ${activeTab === "sandbox" ? "active" : ""}`}
        >
          <Terminal size={15} color={activeTab === "sandbox" ? "#818cf8" : "#94a3b8"} />
          <span>Interactive API Sandbox</span>
        </button>

        <button
          onClick={() => setActiveTab("docs")}
          className={`dev-tab-btn ${activeTab === "docs" ? "active" : ""}`}
        >
          <BookOpen size={15} color={activeTab === "docs" ? "#818cf8" : "#94a3b8"} />
          <span>API Documentation</span>
        </button>
      </div>

      {/* TAB 1: API KEYS LISTING */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
              Loading authenticated API keys...
            </div>
          ) : keys.length === 0 ? (
            <div
              className="rounded-2xl border p-12 text-center"
              style={{
                background: "rgba(19, 23, 34, 0.6)",
                borderColor: "rgba(255, 255, 255, 0.08)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border"
                style={{
                  background: "rgba(99, 102, 241, 0.12)",
                  borderColor: "rgba(99, 102, 241, 0.25)",
                }}
              >
                <Key className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No API keys created yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
                Create an API key to securely send events, read metrics, or authenticate automated ingestion pipelines.
              </p>
              {canManage && (
                <button
                  onClick={() => setCreateModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition duration-150 cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
                    color: "#ffffff",
                    boxShadow: "0 4px 16px rgba(99, 102, 241, 0.35)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
                  <span style={{ color: "#ffffff" }}>Generate Your First Key</span>
                </button>
              )}

              {/* Inline Developer Quick-Start Guide */}
              <div className="mt-8 pt-8 border-t border-slate-800/80 text-left max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Quick Start: Ingest Telemetry Event
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">POST /api/v1/ingest</span>
                </div>

                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  Once generated, include your secret Bearer token in the <code className="text-indigo-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">Authorization</code> header to stream metrics into Nexora.
                </p>

                <div className="relative rounded-xl bg-slate-950/80 border border-slate-800 p-4 font-mono text-xs overflow-x-auto text-slate-300 shadow-inner">
                  <div className="text-slate-500 mb-2"># Stream real-time telemetry payload via cURL</div>
                  <pre className="text-indigo-300 leading-relaxed whitespace-pre-wrap">
{`curl -X POST https://api.nexora.dev/api/v1/ingest \\
  -H "Authorization: Bearer nxr_live_YOUR_SECRET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "X-Organization-Name: For Console's Team" \\
  -H "X-Workspace-Name: Default Workspace" \\
  -d '{
    "eventType": "payment_processed",
    "source": "billing-microservice",
    "payload": {
      "amount": 4900,
      "currency": "usd",
      "status": "success",
      "latencyMs": 142
    }
  }'`}
                  </pre>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>256-bit bcrypt hashed storage</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>120 req/min rate limit per key</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sub-15ms ingest latency</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {keys.map((k) => {
                const isExpired = k.expiresAt && new Date(k.expiresAt) < new Date();
                return (
                  <div
                    key={k.id}
                    className="dev-key-card"
                    style={{
                      opacity: k.revoked ? 0.6 : 1,
                      borderColor: isExpired ? "rgba(245, 158, 11, 0.3)" : undefined,
                    }}
                  >
                    {/* Left Column: Key identity & Details */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", flexGrow: 1, minWidth: 0 }}>
                      {/* Row 1: Name, Status Badge, Workspace */}
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        <span style={{ fontWeight: 700, fontSize: "15px", color: "#ffffff" }}>{k.name}</span>
                        {k.revoked ? (
                          <span className="badge badge-danger">Revoked</span>
                        ) : isExpired ? (
                          <span className="badge badge-warning">Expired</span>
                        ) : (
                          <span className="badge badge-success">Active</span>
                        )}
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {k.workspaceName || activeWorkspace?.name || "Default Workspace"}
                        </span>
                      </div>

                      {/* Row 2: Monospace Key Preview & Metadata */}
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                        {/* Key Prefix Pill with Copy Button */}
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            fontFamily: "var(--font-mono)",
                            background: "#07090e",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-medium)",
                            color: "#818cf8",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          <Key size={13} color="#818cf8" />
                          <span>{k.keyPrefix}</span>
                          <button
                            onClick={() => copyToClipboard(k.keyPrefix)}
                            title="Copy masked key prefix"
                            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", display: "inline-flex" }}
                          >
                            <Copy size={13} />
                          </button>
                        </div>

                        {/* Last Used Timestamp */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Clock size={13} color="var(--text-muted)" />
                          <span>
                            {k.lastUsedAt
                              ? `Last used: ${new Date(k.lastUsedAt).toLocaleDateString()}`
                              : "Never used"}
                          </span>
                        </div>

                        {/* Expiration */}
                        <div>
                          {k.expiresAt
                            ? `Expires: ${new Date(k.expiresAt).toLocaleDateString()}`
                            : "Never expires"}
                        </div>

                        {/* Rate Limit */}
                        <div>
                          Limit: <strong style={{ color: "#f8fafc" }}>{k.rateLimit || 120}</strong> req/min
                        </div>

                        {k.ipRestrictions && (
                          <span className="badge badge-neutral" style={{ color: "#38bdf8", borderColor: "rgba(6, 182, 212, 0.3)" }}>
                            <Lock size={10} style={{ marginRight: "3px" }} /> IP Whitelist
                          </span>
                        )}

                        {k.gracePeriodEndsAt && new Date(k.gracePeriodEndsAt) > new Date() && (
                          <span className="badge badge-indigo">
                            <RefreshCw size={10} style={{ marginRight: "3px" }} /> Zero-Downtime Grace
                          </span>
                        )}
                      </div>

                      {/* Row 3: Scopes Chips */}
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginRight: "4px" }}>Scopes:</span>
                        {k.scopes.map((s) => (
                          <span key={s} className="dev-scope-pill">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: Actions */}
                    {canManage && !k.revoked && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <button
                          onClick={() => setRotateTargetKey(k)}
                          className="dev-action-btn-rotate"
                          title="Rotate secret credentials with zero downtime"
                        >
                          <RefreshCw size={13} color="#818cf8" />
                          <span>Rotate Key</span>
                        </button>

                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="dev-action-btn-revoke"
                          title="Revoke key immediately"
                        >
                          <Trash2 size={13} color="#f87171" />
                          <span>Revoke</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: API USAGE ANALYTICS */}
      {activeTab === "usage" && (
        <div className="space-y-6">
          {usageLoading && !usageData ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading usage analytics & quotas...
            </div>
          ) : (
            <>
              {/* Quota Progress Card */}
              <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">
                      Subscription Plan Quota
                    </span>
                    <h2 className="text-xl md:text-2xl font-bold text-white mt-1">
                      {(usageData?.usage?.currentMonth || 0).toLocaleString()} /{" "}
                      {(usageData?.usage?.monthlyLimit || 100000).toLocaleString()}{" "}
                      <span className="text-sm font-normal text-slate-400">Monthly API Requests</span>
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-white">
                      {usageData?.usage?.percentage || 0}%
                    </span>
                    <div className="text-xs text-slate-400">Consumed this billing cycle</div>
                  </div>
                </div>

                {/* Progress Meter */}
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, usageData?.usage?.percentage || 0)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>{(usageData?.usage?.remaining || 0).toLocaleString()} requests remaining</span>
                  <span>Resets on {usageData?.usage?.resetDate ? new Date(usageData.usage.resetDate).toLocaleDateString() : "next cycle"}</span>
                </div>
              </div>

              {/* Status Code Distribution & Endpoints Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Endpoints Breakdown */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" /> Requests by Endpoint
                  </h3>

                  <div className="space-y-3">
                    {usageData?.endpoints && usageData.endpoints.length > 0 ? (
                      usageData.endpoints.map((ep) => (
                        <div key={ep.endpoint} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-white">{ep.endpoint}</span>
                            <div className="text-[11px] text-slate-500 mt-0.5">Avg latency: {ep.avgLatencyMs}ms</div>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                            {ep.requests.toLocaleString()} reqs
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-4 text-center">No endpoint traffic logged yet</div>
                    )}
                  </div>
                </div>

                {/* Status Code Breakdown */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" /> HTTP Status Code Health
                  </h3>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <div className="text-2xl font-extrabold text-emerald-400">
                        {usageData?.statusDistribution?.["2xx"] || 0}
                      </div>
                      <div className="text-[11px] text-emerald-300 font-semibold mt-1">2xx Success</div>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                      <div className="text-2xl font-extrabold text-amber-400">
                        {usageData?.statusDistribution?.["4xx"] || 0}
                      </div>
                      <div className="text-[11px] text-amber-300 font-semibold mt-1">4xx Client Error</div>
                    </div>
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                      <div className="text-2xl font-extrabold text-rose-400">
                        {usageData?.statusDistribution?.["5xx"] || 0}
                      </div>
                      <div className="text-[11px] text-rose-300 font-semibold mt-1">5xx Server Error</div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Client 4xx errors typically occur from unauthorized requests, revoked keys, or rate limits. Check your client integration code if 4xx errors spike.
                  </p>
                </div>
              </div>

              {/* Recent Live Request Logs */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="p-5 border-b border-slate-800">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" /> Recent Live Request Logs
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Latest authenticated API requests processed across this workspace
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Method & Endpoint</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">IP Address</th>
                        <th className="py-3 px-4">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {usageData?.recentRequests && usageData.recentRequests.length > 0 ? (
                        usageData.recentRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-slate-800/30 transition">
                            <td className="py-2.5 px-4">
                              <span className="font-bold text-indigo-400 mr-2">{req.method}</span>
                              <span className="text-slate-300">{req.endpoint}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  req.statusCode < 300
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : req.statusCode < 500
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {req.statusCode}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-400">{req.durationMs}ms</td>
                            <td className="py-2.5 px-4 text-slate-400">{req.ipAddress}</td>
                            <td className="py-2.5 px-4 text-slate-500 font-sans">
                              {new Date(req.timestamp).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                            No recent requests captured yet. Use the API Sandbox to trigger live requests.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: INTERACTIVE API SANDBOX */}
      {activeTab === "sandbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Request Form (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" /> Configure Sandbox Request
              </h3>

              {/* Endpoint Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Target Endpoint
                </label>
                <select
                  value={selectedEndpoint}
                  onChange={(e) => {
                    const ep = e.target.value as any;
                    setSelectedEndpoint(ep);
                    if (ep === "/api/v1/metrics" || ep === "/api/v1/usage") {
                      setSandboxPayload("");
                    } else if (ep === "/api/v1/keys/verify") {
                      setSandboxPayload(JSON.stringify({ checkScopes: true }, null, 2));
                    } else {
                      setSandboxPayload(
                        JSON.stringify(
                          {
                            eventType: "telemetry_ping",
                            source: "developer-portal-sandbox",
                            payload: { runtime: "node-22", memoryUsageMb: 84.5 },
                          },
                          null,
                          2
                        )
                      );
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="/api/v1/ingest">POST /api/v1/ingest — Telemetry Ingestion</option>
                  <option value="/api/v1/metrics">GET /api/v1/metrics — Query Telemetry Metrics</option>
                  <option value="/api/v1/usage">GET /api/v1/usage — Query Quotas & Usage</option>
                  <option value="/api/v1/keys/verify">POST /api/v1/keys/verify — Verify Key Secret</option>
                </select>
              </div>

              {/* API Key Input / Quick Select */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">
                    Authorization Secret (Bearer pfl_...)
                  </label>
                  {keys.length > 0 && (
                    <span className="text-[11px] text-indigo-400">
                      Prefix: {keys[0].keyPrefix}
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={sandboxApiKey}
                  onChange={(e) => setSandboxApiKey(e.target.value)}
                  placeholder="Paste raw key secret here (e.g. pfl_live_...)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* JSON Payload Editor (for POST endpoints) */}
              {(selectedEndpoint === "/api/v1/ingest" || selectedEndpoint === "/api/v1/keys/verify") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Request JSON Body
                  </label>
                  <textarea
                    rows={8}
                    value={sandboxPayload}
                    onChange={(e) => setSandboxPayload(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Run Button */}
              <button
                onClick={handleTestSandbox}
                disabled={sandboxLoading || !sandboxApiKey.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
              >
                {sandboxLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Request...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Execute Sandbox Request</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Response Inspector (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 min-h-[350px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-400" /> Response Output
                </h3>
                {sandboxResponse && (
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        sandboxResponse.status < 300
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : sandboxResponse.status < 500
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {sandboxResponse.status} {sandboxResponse.statusText}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {sandboxResponse.elapsedMs}ms
                    </span>
                  </div>
                )}
              </div>

              {sandboxResponse ? (
                <div className="space-y-3">
                  {/* Response Headers */}
                  {Object.keys(sandboxResponse.headers || {}).length > 0 && (
                    <div className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Response Headers
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 space-y-0.5">
                        {Object.entries(sandboxResponse.headers).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-slate-500">{k}:</span>
                            <span className="text-indigo-300">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response Body */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-x-auto max-h-[380px]">
                    <pre className="text-xs text-indigo-300 font-mono leading-relaxed">
                      {JSON.stringify(sandboxResponse.data, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
                  <Terminal className="w-8 h-8 text-slate-700 mb-2" />
                  <span>Execute a request to preview response status, headers, and payload.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: API DOCUMENTATION & EXAMPLES */}
      {activeTab === "docs" && (
        <div className="space-y-8 max-w-4xl">
          {/* Quickstart Authentication */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-400" /> Authentication Guide
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every request to the Nexora API must authenticate using a valid API key secret. You can provide the secret either via standard HTTP Authorization Bearer token header or via custom <code className="text-indigo-400 bg-slate-950 px-1 py-0.5 rounded">x-api-key</code> header.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2">
              <div className="text-slate-500"># Standard Authorization Header</div>
              <div className="text-emerald-400">Authorization: Bearer nxr_live_your_secret_key_here</div>
              <div className="text-slate-500 pt-2"># Alternative Header</div>
              <div className="text-indigo-400">x-api-key: nxr_live_your_secret_key_here</div>
            </div>
          </div>

          {/* Endpoint 1: Ingest */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-bold text-xs border border-indigo-500/30">
                POST
              </span>
              <h3 className="font-mono text-sm font-bold text-white">/api/v1/ingest</h3>
            </div>
            <p className="text-xs text-slate-400">
              Submit telemetry events, application pings, and streaming metrics into your workspace.
            </p>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">cURL Example</span>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-indigo-300 overflow-x-auto leading-relaxed">
{`curl -X POST https://api.pulseflow.app/api/v1/ingest \\
  -H "Authorization: Bearer pfl_live_REPLACE_WITH_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "eventType": "telemetry_ping",
    "source": "backend-gateway",
    "payload": {
      "activeSessions": 320,
      "cacheHitRatio": 0.94
    }
  }'`}
              </pre>
            </div>
          </div>

          {/* Endpoint 2: Metrics */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/30">
                GET
              </span>
              <h3 className="font-mono text-sm font-bold text-white">/api/v1/metrics</h3>
            </div>
            <p className="text-xs text-slate-400">
              Query aggregated latency percentiles (P50, P95, P99), error rates, and recent events. Requires <code className="text-indigo-400">metrics:read</code> scope.
            </p>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">cURL Example</span>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-indigo-300 overflow-x-auto leading-relaxed">
{`curl -X GET "https://api.pulseflow.app/api/v1/metrics?limit=50" \\
  -H "Authorization: Bearer pfl_live_REPLACE_WITH_YOUR_KEY"`}
              </pre>
            </div>
          </div>

          {/* Endpoint 3: Usage */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/30">
                GET
              </span>
              <h3 className="font-mono text-sm font-bold text-white">/api/v1/usage</h3>
            </div>
            <p className="text-xs text-slate-400">
              Inspect current monthly request quota consumption, subscription limits, and rate limit allocation.
            </p>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">cURL Example</span>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-indigo-300 overflow-x-auto leading-relaxed">
{`curl -X GET https://api.pulseflow.app/api/v1/usage \\
  -H "Authorization: Bearer pfl_live_REPLACE_WITH_YOUR_KEY"`}
              </pre>
            </div>
          </div>

          {/* Scopes & Status Codes Matrix */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h3 className="font-bold text-sm text-white">API Scopes & Permissions Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {Object.values(API_SCOPES).map((s) => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="font-mono text-indigo-400 font-bold">{s.id}</div>
                  <div className="text-slate-300 font-medium">{s.label}</div>
                  <div className="text-slate-500 text-[11px]">{s.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Dictionary */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h3 className="font-bold text-sm text-white">HTTP Error Status Code Reference</h3>
            <div className="space-y-2 text-xs">
              <div className="flex gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-mono font-bold text-amber-400 shrink-0 w-16">401</span>
                <div>
                  <div className="font-semibold text-white">Unauthorized / Expired Key</div>
                  <div className="text-slate-400">Missing Authorization header, invalid secret credentials, or expired key token.</div>
                </div>
              </div>
              <div className="flex gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-mono font-bold text-amber-400 shrink-0 w-16">403</span>
                <div>
                  <div className="font-semibold text-white">Forbidden / Revoked Key / Insufficient Scope</div>
                  <div className="text-slate-400">Key has been revoked, or does not grant the required scope for the requested endpoint.</div>
                </div>
              </div>
              <div className="flex gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-mono font-bold text-amber-400 shrink-0 w-16">429</span>
                <div>
                  <div className="font-semibold text-white">Rate Limit or Monthly Quota Exceeded</div>
                  <div className="text-slate-400">Exceeded 120 req/min token bucket or monthly subscription request quota limit. Check Retry-After header.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE API KEY */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" /> Generate New API Key
              </h3>
              <button
                onClick={() => setCreateModal(false)}
                className="text-slate-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Key Name</label>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Production Ingestion Gateway"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Environment</label>
                  <select
                    value={keyEnv}
                    onChange={(e) => setKeyEnv(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="live">Live (pfl_live_...)</option>
                    <option value="test">Sandbox Test (pfl_test_...)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expiration</label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="never">Never expires</option>
                    <option value="30d">30 Days</option>
                    <option value="90d">90 Days</option>
                    <option value="1y">1 Year (365 Days)</option>
                  </select>
                </div>
              </div>

              {/* IP Whitelisting / CIDR Restrictions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" /> IP Whitelist / CIDR (Optional)
                  </label>
                  <span className="text-[10px] text-slate-500">Leave blank to allow any IP</span>
                </div>
                <input
                  type="text"
                  value={ipRestrictions}
                  onChange={(e) => setIpRestrictions(e.target.value)}
                  placeholder="e.g. 192.168.1.0/24, 10.0.0.15, 203.0.113.50"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Comma-separated list of IPv4 addresses or CIDR blocks. Ingest requests outside these ranges will be rejected with HTTP 403.
                </p>
              </div>

              {/* Scopes Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Granted Scopes</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {Object.values(API_SCOPES).map((s) => (
                    <label
                      key={s.id}
                      className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={scopes.includes(s.id)}
                        onChange={() => toggleScope(s.id)}
                        className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <div className="font-bold text-white font-mono text-[11px]">{s.id}</div>
                        <div className="text-[11px] text-slate-400">{s.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20"
                >
                  Create API Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REVEAL SECRET KEY (SHOWN ONCE) */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="rounded-3xl bg-slate-900 border border-emerald-500/40 p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Save Your API Key Secret</h3>
              <p className="text-xs text-slate-400 mt-1">
                For security reasons, this secret key will <strong className="text-rose-400">never be displayed again</strong>. Make sure to copy it now.
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
              <code className="text-xs text-emerald-300 font-mono break-all">{revealedKey}</code>
              <button
                onClick={() => copyToClipboard(revealedKey)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>

            <button
              onClick={() => setRevealedKey(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
            >
              I have stored my API key safely
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: ROTATE KEY CONFIRMATION */}
      {rotateTargetKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-indigo-400">
              <RefreshCw className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-white">Zero-Downtime Secret Rotation</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Rotating credentials for <strong className="text-white">{rotateTargetKey.name}</strong> generates a new active secret. With zero-downtime rotation, your current secret remains valid for the chosen grace period so distributed services can transition without downtime.
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-400">
              Current active prefix: {rotateTargetKey.keyPrefix}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Transition Grace Period</span>
                <span className="text-[10px] text-purple-400">Previous key remains active</span>
              </label>
              <select
                value={rotateGraceHours}
                onChange={(e) => setRotateGraceHours(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={1}>1 Hour (Fast transition)</option>
                <option value={24}>24 Hours (Standard Recommended)</option>
                <option value={72}>72 Hours (3 Days)</option>
                <option value={168}>7 Days (Extended multi-cloud rollout)</option>
                <option value={0}>0 Hours (Immediate Cutoff - No Grace Period)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRotateTargetKey(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRotateKey}
                disabled={rotating}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center gap-2"
              >
                {rotating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Rotate Secret Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
