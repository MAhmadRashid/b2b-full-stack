"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../layout";
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
} from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  creator: string;
}

export default function ApiKeysPage() {
  const { activeWorkspace } = useDashboard();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  // Generate Key Modal
  const [createModal, setCreateModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyEnv, setKeyEnv] = useState<"live" | "test">("live");
  const [scopes, setScopes] = useState<string[]>(["metrics:read", "events:write"]);

  // Secret Key Reveal Modal
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sandbox State
  const [sandboxPayload, setSandboxPayload] = useState(
    JSON.stringify(
      {
        eventType: "api_request",
        source: "sandbox-tester-ui",
        payload: {
          clientRegion: "us-east-1",
          sessionLengthSeconds: 142,
        },
      },
      null,
      2
    )
  );
  const [sandboxApiKey, setSandboxApiKey] = useState("");
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [activeWorkspace?.id]);

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
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreateModal(false);
        setKeyName("");
        setRevealedKey(data.apiKey.rawKey);
        setSandboxApiKey(data.apiKey.rawKey);
        await fetchKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Applications using it will immediately fail.")) {
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

  const toggleScope = (scope: string) => {
    if (scopes.includes(scope)) {
      setScopes(scopes.filter((s) => s !== scope));
    } else {
      setScopes([...scopes, scope]);
    }
  };

  // Test Sandbox Execution
  const handleTestSandbox = async () => {
    setSandboxLoading(true);
    setSandboxResponse(null);
    const start = Date.now();

    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(sandboxPayload);
      } catch {
        alert("Payload must be valid JSON");
        setSandboxLoading(false);
        return;
      }

      const res = await fetch("/api/v1/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sandboxApiKey.trim()}`,
        },
        body: JSON.stringify(parsedPayload),
      });

      const responseJson = await res.json();
      const elapsed = Date.now() - start;

      setSandboxResponse({
        status: res.status,
        statusText: res.statusText,
        elapsedMs: elapsed,
        data: responseJson,
      });
    } catch (err: any) {
      setSandboxResponse({
        status: 500,
        statusText: "Network Error",
        elapsedMs: Date.now() - start,
        data: { error: err.message },
      });
    } finally {
      setSandboxLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>API Keys & Developer Portal</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Cryptographically hashed authentication tokens for external client ingestion
          </p>
        </div>

        {canManage && (
          <button onClick={() => setCreateModal(true)} className="btn btn-primary btn-sm">
            <Plus size={15} /> Generate API Key
          </button>
        )}
      </div>

      {/* Keys Table Card */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Active & Revoked Tokens</h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>Status</th>
                <th>Last Used</th>
                <th>Created By</th>
                {canManage && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {keys.length > 0 ? (
                keys.map((k) => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 600, color: "#fff" }}>{k.name}</td>
                    <td>
                      <span className="code-pill">{k.keyPrefix}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {k.scopes.map((s, i) => (
                          <span key={i} className="badge badge-indigo" style={{ fontSize: "10px", padding: "1px 6px" }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${k.revoked ? "badge-danger" : "badge-success"}`}>
                        {k.revoked ? "REVOKED" : "ACTIVE"}
                      </span>
                    </td>
                    <td style={{ fontSize: "12.5px" }}>
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never used"}
                    </td>
                    <td style={{ fontSize: "12.5px" }}>{k.creator}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {!k.revoked && (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                            title="Revoke key immediately"
                          >
                            <Trash2 size={13} /> Revoke
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No API keys have been provisioned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Built-in Live API Sandbox */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "16px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Terminal size={17} color="#06b6d4" /> Live API Sandbox & Test Runner
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Test live ingest requests against <span className="mono" style={{ color: "#38bdf8" }}>POST /api/v1/ingest</span> with real authentication
            </p>
          </div>

          <button
            onClick={handleTestSandbox}
            disabled={sandboxLoading}
            className="btn btn-primary btn-sm"
          >
            <Play size={14} /> {sandboxLoading ? "Executing Ingestion..." : "Run Test Ingest"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
          {/* Request Configuration */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Bearer API Key Token</label>
              <input
                type="text"
                className="form-input mono"
                placeholder="pfl_live_..."
                value={sandboxApiKey}
                onChange={(e) => setSandboxApiKey(e.target.value)}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Tip: Generate a key above or use the seeded demo key: <code className="mono" style={{ color: "#38bdf8" }}>pfl_live_9941a82f33c0e</code>
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Request Body (JSON)</label>
              <textarea
                rows={7}
                className="form-input mono"
                style={{ fontSize: "12.5px", lineHeight: "1.5" }}
                value={sandboxPayload}
                onChange={(e) => setSandboxPayload(e.target.value)}
              />
            </div>
          </div>

          {/* Response Inspector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Live Server Response</label>
              {sandboxResponse && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`badge ${sandboxResponse.status < 400 ? "badge-success" : "badge-danger"}`}>
                    {sandboxResponse.status} {sandboxResponse.statusText}
                  </span>
                  <span style={{ fontSize: "12px", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
                    {sandboxResponse.elapsedMs}ms
                  </span>
                </div>
              )}
            </div>

            <pre
              style={{
                flexGrow: 1,
                minHeight: "180px",
                background: "rgba(0, 0, 0, 0.6)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "16px",
                color: sandboxResponse?.status >= 400 ? "#fca5a5" : "#38bdf8",
                fontFamily: "var(--font-mono)",
                fontSize: "12.5px",
                overflowX: "auto",
              }}
            >
              {sandboxResponse
                ? JSON.stringify(sandboxResponse.data, null, 2)
                : '// Click "Run Test Ingest" to simulate a real request'}
            </pre>
          </div>
        </div>
      </div>

      {/* Modal: Generate Key */}
      {createModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-card" style={{ width: "100%", maxWidth: "480px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px" }}>Generate API Key</h3>
              <button onClick={() => setCreateModal(false)} style={{ color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateKey}>
              <div className="form-group">
                <label className="form-label" htmlFor="kName">Key Identifier Name</label>
                <input
                  id="kName"
                  type="text"
                  required
                  placeholder="e.g. AWS Lambda Ingestion Worker"
                  className="form-input"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Environment</label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="env"
                      checked={keyEnv === "live"}
                      onChange={() => setKeyEnv("live")}
                    />
                    <span>Production (pfl_live_*)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="env"
                      checked={keyEnv === "test"}
                      onChange={() => setKeyEnv("test")}
                    />
                    <span>Test / Staging (pfl_test_*)</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Permission Scopes</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { id: "metrics:read", label: "metrics:read (Query aggregated analytics)" },
                    { id: "events:write", label: "events:write (Ingest telemetry data points)" },
                    { id: "telemetry:stream", label: "telemetry:stream (Subscribe to edge alerts)" },
                  ].map((sc) => (
                    <label key={sc.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={scopes.includes(sc.id)}
                        onChange={() => toggleScope(sc.id)}
                      />
                      <span>{sc.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button type="button" onClick={() => setCreateModal(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Secret Key Reveal */}
      {revealedKey && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: "20px",
          }}
        >
          <div className="glass-card" style={{ width: "100%", maxWidth: "520px", padding: "30px", border: "1px solid #10b981" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)" }}>
                <Key size={22} color="#10b981" />
              </div>
              <h3 style={{ fontSize: "18px" }}>Secret API Key Generated</h3>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px",
                borderRadius: "8px",
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                color: "#fbbf24",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>
                Please copy your API key now. For security purposes, this secret key will <strong>never be shown again</strong>.
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
              <input
                type="text"
                readOnly
                value={revealedKey}
                className="form-input mono"
                style={{ fontSize: "13.5px", color: "#34d399", fontWeight: 600 }}
              />
              <button
                onClick={() => copyToClipboard(revealedKey)}
                className="btn btn-secondary"
                style={{ minWidth: "90px" }}
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setRevealedKey(null)} className="btn btn-primary btn-sm">
                I Have Stored the Key Safely
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
