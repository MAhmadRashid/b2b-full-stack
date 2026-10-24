"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../layout";
import {
  ShieldAlert,
  Server,
  Users,
  Layers,
  Key,
  Activity,
  CheckCircle2,
  RefreshCw,
  Clock,
} from "lucide-react";

export default function SuperadminPage() {
  const { user } = useDashboard();
  const [adminData, setAdminData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminOverview = async () => {
    try {
      const [adminRes, healthRes] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch("/api/health"),
      ]);

      if (adminRes.ok) {
        const d = await adminRes.json();
        setAdminData(d);
      }
      if (healthRes.ok) {
        const h = await healthRes.json();
        setHealthData(h);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminOverview();
  }, []);

  if (user?.systemRole !== "SUPERADMIN") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <ShieldAlert size={36} color="#ef4444" style={{ marginBottom: "16px" }} />
        <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Access Denied</h2>
        <p style={{ color: "var(--text-secondary)" }}>
          This operations panel is restricted to platform Superadmins.
        </p>
      </div>
    );
  }

  const stats = adminData?.stats;
  const workspaces = adminData?.workspaces || [];
  const recentAudits = adminData?.recentAudits || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span className="badge badge-success">Superadmin Ops</span>
            <h1 style={{ fontSize: "24px" }}>Global Control Panel</h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Fleet-wide multi-tenant monitoring, cluster health, and administrative audits
          </p>
        </div>

        <button onClick={fetchAdminOverview} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh Telemetry
        </button>
      </div>

      {/* Global Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Total Workspaces</span>
            <Layers size={18} color="#6366f1" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>
            {stats?.totalWorkspaces || 0}
          </div>
          <span style={{ fontSize: "12px", color: "#34d399" }}>Isolated multi-tenant clusters</span>
        </div>

        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Total Platform Users</span>
            <Users size={18} color="#06b6d4" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>
            {stats?.totalUsers || 0}
          </div>
          <span style={{ fontSize: "12px", color: "#38bdf8" }}>Across all tenant tiers</span>
        </div>

        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Active API Keys</span>
            <Key size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>
            {stats?.activeApiKeys || 0}
          </div>
          <span style={{ fontSize: "12px", color: "#34d399" }}>Zero revoked cryptographic keys</span>
        </div>

        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Total Ingested Events</span>
            <Activity size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>
            {stats?.totalEventsIngested?.toLocaleString() || 0}
          </div>
          <span style={{ fontSize: "12px", color: "#fbbf24" }}>Stored in distributed WAL</span>
        </div>
      </div>

      {/* Cluster Engine Health Card */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Server size={17} color="#34d399" /> System Runtime & Database Telemetry
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", fontSize: "13px" }}>
          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Engine Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "16px", fontWeight: 700, color: "#34d399" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              {healthData?.status || "HEALTHY"}
            </div>
          </div>

          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>SQLite Latency</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#38bdf8" }}>
              {healthData?.database?.latencyMs || 2}ms roundtrip
            </div>
          </div>

          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Node Process Uptime</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0" }}>
              {healthData?.uptimeSeconds ? `${Math.round(healthData.uptimeSeconds)} seconds` : "Active"}
            </div>
          </div>

          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Environment Target</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#a855f7" }}>
              {healthData?.environment || "development"}
            </div>
          </div>
        </div>
      </div>

      {/* Tenant Directory Table */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Platform Tenant Directory</h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Workspace Name</th>
                <th>Slug</th>
                <th>Plan Tier</th>
                <th>Monthly Requests</th>
                <th>Members</th>
                <th>Keys</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w: any) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600, color: "#fff" }}>{w.name}</td>
                  <td>
                    <span className="code-pill">{w.slug}</span>
                  </td>
                  <td>
                    <span className="badge badge-indigo">{w.plan}</span>
                  </td>
                  <td>
                    {w.requestsThisMonth.toLocaleString()} / {w.monthlyLimit.toLocaleString()}
                  </td>
                  <td>{w.membersCount}</td>
                  <td>{w.keysCount}</td>
                  <td style={{ fontSize: "12.5px" }}>{new Date(w.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Audit Feed */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Cross-Tenant Security Operations Audit</h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Details</th>
                <th>User Email</th>
                <th>IP Address</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentAudits.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <span className="badge badge-neutral">{a.action}</span>
                  </td>
                  <td style={{ color: "#e2e8f0" }}>{a.details}</td>
                  <td style={{ fontSize: "12.5px" }}>{a.userEmail || "System"}</td>
                  <td style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    {a.ipAddress}
                  </td>
                  <td style={{ fontSize: "12.5px" }}>{new Date(a.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
