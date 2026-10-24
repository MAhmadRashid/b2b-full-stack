"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "../layout";
import {
  Settings,
  ShieldAlert,
  Save,
  Trash2,
  CheckCircle2,
  FileText,
  Search,
  Webhook,
  Plus,
  Send,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Activity,
  X,
  XCircle,
} from "lucide-react";

interface WebhookItem {
  id: string;
  workspaceId: string;
  url: string;
  secretKey: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface TestPingResult {
  success: boolean;
  deliveryStatus: string;
  statusCode: number | null;
  durationMs: number;
  signature: string;
  responseSnippet?: string;
  errorMessage?: string | null;
  payloadSent: any;
}

const AVAILABLE_EVENTS = [
  { id: "error_spike", label: "Error Spikes", desc: "Triggered when 5xx HTTP failure rate exceeds 2.5%" },
  { id: "latency_breach", label: "Latency Breaches", desc: "Triggered when p95/p99 response latency exceeds 250ms" },
  { id: "quota_warning", label: "Quota Thresholds", desc: "Triggered when monthly ingestion quota crosses 80%" },
  { id: "security_alert", label: "Security Anomalies", desc: "Triggered on unauthorized API gateway probe spikes" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { activeWorkspace, refreshUserData } = useDashboard();
  const [activeTab, setActiveTab] = useState<"general" | "webhooks">("general");

  // General settings state
  const [workspaceName, setWorkspaceName] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);
  const [showAddWebhookModal, setShowAddWebhookModal] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([
    "error_spike",
    "latency_breach",
  ]);
  const [isSubmittingWebhook, setIsSubmittingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  // Secret visibility & copy state
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Test Ping state
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    targetUrl: string;
    result: TestPingResult;
  } | null>(null);

  useEffect(() => {
    if (activeWorkspace) {
      setWorkspaceName(activeWorkspace.name);
      fetchAuditLogs();
      fetchWebhooks();
    }
  }, [activeWorkspace?.id]);

  const fetchAuditLogs = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/audit-logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchWebhooks = async () => {
    if (!activeWorkspace) return;
    setLoadingWebhooks(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/webhooks`);
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      }
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !workspaceName.trim()) return;

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim() }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        await refreshUserData();
        await fetchAuditLogs();
      } else {
        alert("Failed to update workspace name");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleDeleteWorkspace = async () => {
    if (activeWorkspace?.role !== "OWNER") {
      alert("Only the workspace owner can delete this workspace.");
      return;
    }

    const confirmText = prompt(
      `Type the workspace slug "${activeWorkspace.slug}" to confirm deletion:`
    );

    if (confirmText !== activeWorkspace.slug) {
      alert("Workspace slug did not match. Deletion aborted.");
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Workspace successfully deleted.");
        await refreshUserData();
        router.push("/dashboard");
      } else {
        alert("Failed to delete workspace");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setWebhookError(null);

    const trimmedUrl = newWebhookUrl.trim();
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      setWebhookError("Endpoint URL must begin with http:// or https://");
      return;
    }

    if (newWebhookEvents.length === 0) {
      setWebhookError("Select at least one event trigger to subscribe.");
      return;
    }

    setIsSubmittingWebhook(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          events: newWebhookEvents,
          active: true,
        }),
      });

      if (res.ok) {
        setShowAddWebhookModal(false);
        setNewWebhookUrl("");
        setNewWebhookEvents(["error_spike", "latency_breach"]);
        await fetchWebhooks();
        await fetchAuditLogs();
      } else {
        const data = await res.json();
        setWebhookError(data.error || "Failed to create webhook endpoint");
      }
    } catch {
      setWebhookError("Network error while creating webhook");
    } finally {
      setIsSubmittingWebhook(false);
    }
  };

  const handleToggleWebhookActive = async (webhook: WebhookItem) => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/webhooks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookId: webhook.id,
          active: !webhook.active,
        }),
      });

      if (res.ok) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === webhook.id ? { ...w, active: !w.active } : w))
        );
        await fetchAuditLogs();
      } else {
        alert("Failed to update webhook status");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleDeleteWebhook = async (webhookId: string, url: string) => {
    if (!activeWorkspace) return;
    if (!confirm(`Delete outbound webhook endpoint: ${url}?`)) return;

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/webhooks?webhookId=${webhookId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
        await fetchAuditLogs();
      } else {
        alert("Failed to delete webhook");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleTestPing = async (webhook: WebhookItem) => {
    if (!activeWorkspace) return;
    setTestingWebhookId(webhook.id);
    setTestResult(null);

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/webhooks/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookId: webhook.id,
          url: webhook.url,
          secretKey: webhook.secretKey,
        }),
      });

      const data: TestPingResult = await res.json();
      setTestResult({
        targetUrl: webhook.url,
        result: data,
      });
      await fetchAuditLogs();
    } catch {
      alert("Failed to execute test delivery ping");
    } finally {
      setTestingWebhookId(null);
    }
  };

  const toggleSecretReveal = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(auditSearch.toLowerCase()))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Workspace Settings & Audits</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Configure environment preferences, manage outbound webhook dispatchers, and inspect compliance audits
        </p>
      </div>

      {/* Tab Switcher */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-medium)",
          paddingBottom: "12px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`btn ${activeTab === "general" ? "btn-primary" : "btn-secondary"} btn-sm`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Settings size={15} /> General & Security Audits
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("webhooks")}
          className={`btn ${activeTab === "webhooks" ? "btn-primary" : "btn-secondary"} btn-sm`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Webhook size={15} /> Outbound Webhooks
          <span
            className="badge badge-indigo"
            style={{ fontSize: "11px", padding: "2px 7px" }}
          >
            {webhooks.length}
          </span>
        </button>
      </div>

      {savedSuccess && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
            color: "#34d399",
            fontSize: "13.5px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>Workspace settings updated successfully!</span>
        </div>
      )}

      {/* TAB 1: GENERAL & AUDITS */}
      {activeTab === "general" && (
        <>
          {/* General Settings Card */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>General Configuration</h3>

            <form onSubmit={handleSaveSettings}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "16px",
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="wsName">
                    Workspace Display Name
                  </label>
                  <input
                    id="wsName"
                    type="text"
                    required
                    className="form-input"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cluster Slug (Read-only)</label>
                  <input
                    type="text"
                    readOnly
                    className="form-input mono"
                    value={activeWorkspace?.slug || ""}
                    style={{ opacity: 0.7 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button type="submit" className="btn btn-primary btn-sm">
                  <Save size={14} /> Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Audit Log Table */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "16px",
                    marginBottom: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <FileText size={16} color="#06b6d4" /> Immutable Security Audit Logs
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  Cryptographically timestamped trail of administrative and security events
                </p>
              </div>

              <div style={{ position: "relative", minWidth: "220px" }}>
                <input
                  type="text"
                  placeholder="Search audit actions..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: "32px", fontSize: "13px" }}
                />
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
              </div>
            </div>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Operator</th>
                    <th>IP Address</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                        Loading audit stream...
                      </td>
                    </tr>
                  ) : filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span className="badge badge-indigo" style={{ fontSize: "11px" }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ color: "#e2e8f0" }}>{log.details}</td>
                        <td style={{ fontSize: "12.5px" }}>{log.userEmail || "System Engine"}</td>
                        <td
                          style={{
                            fontSize: "12px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {log.ipAddress}
                        </td>
                        <td style={{ fontSize: "12.5px" }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                        No audit records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Danger Zone */}
          <div
            className="glass-card"
            style={{
              padding: "24px",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              background: "rgba(239, 68, 68, 0.03)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "16px",
                    color: "#f87171",
                    marginBottom: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <ShieldAlert size={18} /> Danger Zone: Delete Workspace
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  Permanently delete this workspace, all metric history, and revoke all associated API keys.
                </p>
              </div>

              <button
                onClick={handleDeleteWorkspace}
                className="btn btn-danger btn-sm"
              >
                <Trash2 size={14} /> Delete This Workspace
              </button>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: OUTBOUND WEBHOOKS */}
      {activeTab === "webhooks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Webhook Header Card */}
          <div
            className="glass-card"
            style={{
              padding: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "4px",
                }}
              >
                <Webhook size={20} color="#06b6d4" /> Outbound Webhook Delivery Engine
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "13.5px" }}>
                Deliver automated HTTPS notifications to external SIEM, Slack, PagerDuty, or custom backend services.
              </p>
            </div>

            <button
              onClick={() => {
                setWebhookError(null);
                setShowAddWebhookModal(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={15} /> Add Webhook Destination
            </button>
          </div>

          {/* Test Ping Diagnostic Modal / Banner */}
          {testResult && (
            <div
              className="glass-card"
              style={{
                padding: "20px",
                border: testResult.result.success
                  ? "1px solid rgba(16, 185, 129, 0.4)"
                  : "1px solid rgba(239, 68, 68, 0.4)",
                background: testResult.result.success
                  ? "rgba(16, 185, 129, 0.05)"
                  : "rgba(239, 68, 68, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {testResult.result.success ? (
                    <CheckCircle2 size={20} color="#10b981" />
                  ) : (
                    <AlertTriangle size={20} color="#f87171" />
                  )}
                  <div>
                    <h4 style={{ fontSize: "15px", fontWeight: 700 }}>
                      Test Delivery {testResult.result.success ? "Succeeded (200 OK)" : "Attempt Finished"}
                    </h4>
                    <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                      Target: <span className="mono" style={{ color: "#38bdf8" }}>{testResult.targetUrl}</span> ({testResult.result.durationMs}ms latency)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTestResult(null)}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "4px" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                  fontSize: "12.5px",
                }}
              >
                <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Delivery Status</div>
                  <span
                    className={`badge ${testResult.result.success ? "badge-success" : "badge-danger"}`}
                    style={{ fontSize: "11px" }}
                  >
                    {testResult.result.deliveryStatus}
                  </span>
                </div>

                <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>HTTP Status Code</div>
                  <span className="mono" style={{ color: testResult.result.statusCode ? "#34d399" : "#f87171" }}>
                    {testResult.result.statusCode ?? "Connection Error"}
                  </span>
                </div>

                <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>X-PulseFlow-Signature (HMAC-SHA256)</div>
                  <span className="mono" style={{ fontSize: "11px", color: "#818cf8", wordBreak: "break-all" }}>
                    {testResult.result.signature.slice(0, 24)}...
                  </span>
                </div>
              </div>

              {testResult.result.errorMessage && (
                <div style={{ fontSize: "12.5px", color: "#fca5a5" }}>
                  <strong>Error details:</strong> {testResult.result.errorMessage}
                </div>
              )}

              {testResult.result.responseSnippet && (
                <div style={{ fontSize: "12px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Remote Response Preview:</span>
                  <pre
                    className="mono"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      padding: "8px",
                      borderRadius: "6px",
                      marginTop: "4px",
                      color: "#94a3b8",
                      overflowX: "auto",
                    }}
                  >
                    {testResult.result.responseSnippet}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Webhooks Listing */}
          {loadingWebhooks ? (
            <div className="glass-card" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              Loading webhook configurations...
            </div>
          ) : webhooks.length === 0 ? (
            <div
              className="glass-card"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(6, 182, 212, 0.1)",
                  border: "1px solid rgba(6, 182, 212, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#06b6d4",
                }}
              >
                <Webhook size={28} />
              </div>
              <h3 style={{ fontSize: "17px", fontWeight: 700 }}>No Outbound Webhooks Configured</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", maxWidth: "480px" }}>
                Add your endpoint URL to automatically receive live JSON telemetry payloads whenever error thresholds or latency breaches occur.
              </p>
              <button
                onClick={() => {
                  setWebhookError(null);
                  setShowAddWebhookModal(true);
                }}
                className="btn btn-primary btn-sm"
                style={{ marginTop: "8px" }}
              >
                <Plus size={15} /> Configure First Webhook
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {webhooks.map((wh) => {
                const isTesting = testingWebhookId === wh.id;
                const isSecretRevealed = !!revealedSecrets[wh.id];
                const isCopied = copiedKeyId === wh.id;

                return (
                  <div
                    key={wh.id}
                    className="glass-card"
                    style={{
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                      border: wh.active
                        ? "1px solid var(--border-subtle)"
                        : "1px solid rgba(255, 255, 255, 0.04)",
                      opacity: wh.active ? 1 : 0.7,
                    }}
                  >
                    {/* Top Row: URL, Status, Actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "8px",
                            background: wh.active ? "rgba(99, 102, 241, 0.12)" : "rgba(255, 255, 255, 0.05)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: wh.active ? "#818cf8" : "var(--text-muted)",
                          }}
                        >
                          <Webhook size={18} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="mono" style={{ fontSize: "14.5px", fontWeight: 600, color: "#f8fafc" }}>
                              {wh.url}
                            </span>
                            <span
                              className={`badge ${wh.active ? "badge-success" : "badge-neutral"}`}
                              style={{ fontSize: "10.5px" }}
                            >
                              {wh.active ? "ACTIVE" : "PAUSED"}
                            </span>
                          </div>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            Added on {new Date(wh.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => handleTestPing(wh)}
                          disabled={isTesting}
                          className="btn btn-secondary btn-sm"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#38bdf8",
                            borderColor: "rgba(56, 189, 248, 0.3)",
                          }}
                        >
                          {isTesting ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" /> Sending Ping...
                            </>
                          ) : (
                            <>
                              <Send size={13} /> Test Ping
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleWebhookActive(wh)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: "12px" }}
                        >
                          {wh.active ? "Pause" : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteWebhook(wh.id, wh.url)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: "6px 9px" }}
                          title="Delete Webhook"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Middle: Event badges */}
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Subscribed Events:</span>
                      {wh.events.map((evt) => (
                        <span key={evt} className="badge badge-indigo" style={{ fontSize: "11px" }}>
                          {evt.replace("_", " ")}
                        </span>
                      ))}
                    </div>

                    {/* Bottom: Signing Secret Bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "10px",
                        padding: "10px 14px",
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>HMAC Signing Secret:</span>
                        <span className="mono" style={{ fontSize: "12px", color: "#e2e8f0" }}>
                          {isSecretRevealed ? wh.secretKey : `${wh.secretKey.slice(0, 9)}••••••••••••••••••••••••`}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => toggleSecretReveal(wh.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          {isSecretRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span style={{ marginLeft: "4px" }}>{isSecretRevealed ? "Hide" : "Show"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(wh.secretKey, wh.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                        >
                          {isCopied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          <span style={{ marginLeft: "4px" }}>{isCopied ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE WEBHOOK MODAL */}
      {showAddWebhookModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 100,
          }}
        >
          <div
            className="glass-card"
            style={{
              width: "100%",
              maxWidth: "520px",
              padding: "28px",
              background: "#0e121d",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Webhook size={18} color="#06b6d4" /> Configure Webhook Destination
              </h3>
              <button
                type="button"
                onClick={() => setShowAddWebhookModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", marginBottom: "20px" }}>
              PulseFlow will sign payloads with HMAC-SHA256 and deliver HTTP POST requests to this URL.
            </p>

            {webhookError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {webhookError}
              </div>
            )}

            <form onSubmit={handleCreateWebhook}>
              <div className="form-group">
                <label className="form-label" htmlFor="whUrl">
                  Destination Endpoint URL *
                </label>
                <input
                  id="whUrl"
                  type="url"
                  required
                  placeholder="https://api.yourdomain.com/webhooks/pulseflow"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  className="form-input mono"
                />
              </div>

              <div className="form-group" style={{ marginTop: "16px" }}>
                <label className="form-label">Subscribed Event Triggers</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                  {AVAILABLE_EVENTS.map((evt) => {
                    const isChecked = newWebhookEvents.includes(evt.id);
                    return (
                      <label
                        key={evt.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "10px 12px",
                          background: isChecked ? "rgba(99, 102, 241, 0.08)" : "rgba(255, 255, 255, 0.02)",
                          border: isChecked ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid var(--border-subtle)",
                          borderRadius: "8px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewWebhookEvents((prev) => [...prev, evt.id]);
                            } else {
                              setNewWebhookEvents((prev) => prev.filter((id) => id !== evt.id));
                            }
                          }}
                          style={{ marginTop: "3px" }}
                        />
                        <div>
                          <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#f8fafc" }}>
                            {evt.label}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {evt.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "24px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddWebhookModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWebhook}
                  className="btn btn-primary btn-sm"
                >
                  {isSubmittingWebhook ? "Registering..." : "Register Webhook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
