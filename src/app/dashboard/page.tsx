"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "./layout";
import {
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Key,
  Users,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
  Server,
  Layers,
} from "lucide-react";

interface MetricsResponse {
  workspace: any;
  range: string;
  overview: {
    totalEvents: number;
    avgLatency: number;
    errorRate: number;
    successRate: number;
    requestsThisMonth: number;
    monthlyLimit: number;
    usagePercentage: number;
  };
  timeSeries: Array<{
    label: string;
    timestamp: string;
    total: number;
    successful: number;
    errors: number;
    avgLatency: number;
  }>;
  statusDistribution: Array<{
    code: number;
    count: number;
    percentage: number;
  }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    source: string;
    status: string;
    statusCode: number;
    latencyMs: number;
    timestamp: string;
  }>;
}

export default function DashboardOverviewPage() {
  const { activeWorkspace } = useDashboard();
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    if (!activeWorkspace) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/metrics?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [activeWorkspace?.id, range]);

  if (loading && !data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)" }}>
          <RefreshCw size={18} className="animate-spin" />
          <span>Aggregating telemetry metrics...</span>
        </div>
      </div>
    );
  }

  const overview = data?.overview;
  const timeSeries = data?.timeSeries || [];
  const maxTotal = Math.max(...timeSeries.map((t) => t.total), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Top Banner & Range Controls */}
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
          <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Telemetry Overview</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Real-time pipeline ingestion telemetry for {activeWorkspace?.name}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Range selector */}
          <div
            style={{
              display: "inline-flex",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-medium)",
              borderRadius: "8px",
              padding: "2px",
            }}
          >
            {["24h", "7d", "30d"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: range === r ? "#fff" : "var(--text-muted)",
                  background: range === r ? "var(--accent-indigo)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchMetrics}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            title="Refresh stream"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* 4 Metric KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "20px",
        }}
      >
        {/* Card 1: Total Events */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Events Ingested</span>
            <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(6, 182, 212, 0.12)" }}>
              <Activity size={18} color="#06b6d4" />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>
            {overview?.totalEvents?.toLocaleString() || 0}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#34d399" }}>
            <TrendingUp size={14} /> +14.8% vs last window
          </div>
        </div>

        {/* Card 2: Average Latency */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Avg Response Latency</span>
            <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.12)" }}>
              <Clock size={18} color="#6366f1" />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>
            {overview?.avgLatency || 0} ms
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#38bdf8" }}>
            <Server size={14} /> Edge node median: 22ms
          </div>
        </div>

        {/* Card 3: Success Rate */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Success Rate</span>
            <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.12)" }}>
              <CheckCircle2 size={18} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>
            {overview?.successRate}%
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: overview?.errorRate && overview.errorRate > 5 ? "#f87171" : "var(--text-muted)" }}>
            <AlertTriangle size={14} /> Error rate: {overview?.errorRate}%
          </div>
        </div>

        {/* Card 4: Quota Usage */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Plan Quota Usage</span>
            <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.12)" }}>
              <Zap size={18} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>
            {overview?.usagePercentage}%
          </div>
          <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(overview?.usagePercentage || 0, 100)}%`,
                height: "100%",
                background: "var(--accent-gradient)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Interactive Telemetry Volume Chart */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Ingestion Throughput & Latency Trend</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Time-series distribution partitioned by interval
            </p>
          </div>
          <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#6366f1" }} />
              <span style={{ color: "var(--text-secondary)" }}>Successful Requests</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#ef4444" }} />
              <span style={{ color: "var(--text-secondary)" }}>Errors</span>
            </div>
          </div>
        </div>

        {/* Visual Responsive Bar Graphic */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "12px",
            height: "200px",
            paddingTop: "20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {timeSeries.map((item, idx) => {
            const heightPercent = Math.max((item.total / maxTotal) * 100, 6);
            const errorPercent = item.total > 0 ? (item.errors / item.total) * 100 : 0;
            return (
              <div
                key={idx}
                style={{
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                  position: "relative",
                }}
                className="chart-col"
              >
                {/* Bar */}
                <div
                  style={{
                    width: "100%",
                    maxWidth: "42px",
                    height: `${heightPercent}%`,
                    borderRadius: "6px 6px 0 0",
                    background:
                      errorPercent > 0
                        ? `linear-gradient(to top, #6366f1 ${100 - errorPercent}%, #ef4444 ${100 - errorPercent}%)`
                        : "linear-gradient(to top, #4f46e5, #6366f1)",
                    transition: "height 0.3s ease",
                    cursor: "pointer",
                    position: "relative",
                  }}
                  title={`${item.label}: ${item.total} events (${item.avgLatency}ms avg)`}
                />
                <span
                  style={{
                    marginTop: "8px",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Grid: Live Event Stream + Quick Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Live Ingestion Feed */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <h3 style={{ fontSize: "16px" }}>Live Stream Telemetry</h3>
            </div>
            <Link href="/dashboard/analytics" className="btn btn-ghost btn-sm" style={{ fontSize: "12px" }}>
              Deep Dive <ArrowUpRight size={13} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
            {data?.recentEvents && data.recentEvents.length > 0 ? (
              data.recentEvents.slice(0, 7).map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      className={`badge ${
                        ev.statusCode >= 500
                          ? "badge-danger"
                          : ev.statusCode >= 400
                          ? "badge-warning"
                          : "badge-success"
                      }`}
                      style={{ fontSize: "11px", padding: "2px 6px" }}
                    >
                      {ev.statusCode}
                    </span>
                    <span style={{ fontWeight: 600, color: "#fff", fontFamily: "var(--font-mono)" }}>
                      {ev.eventType}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{ev.source}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: "#38bdf8", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                      {ev.latencyMs}ms
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                No events recorded in this time range. Use the Simulate Ingest button above!
              </div>
            )}
          </div>
        </div>

        {/* Quick Launch & Sandbox Actions */}
        <div className="glass-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <h3 style={{ fontSize: "16px" }}>Developer Quick Actions</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13.5px" }}>
            Immediate operational commands for this workspace cluster.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Link
              href="/dashboard/api-keys"
              className="btn btn-secondary"
              style={{ justifyContent: "space-between", padding: "14px 18px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Key size={18} color="#6366f1" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>Generate Scoped API Key</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Create production tokens with ACL scopes</div>
                </div>
              </div>
              <ArrowUpRight size={16} />
            </Link>

            <Link
              href="/dashboard/team"
              className="btn btn-secondary"
              style={{ justifyContent: "space-between", padding: "14px 18px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Users size={18} color="#10b981" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>Invite Engineering Teammates</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Assign Owner, Admin, Member, or Viewer roles</div>
                </div>
              </div>
              <ArrowUpRight size={16} />
            </Link>

            <Link
              href="/dashboard/billing"
              className="btn btn-secondary"
              style={{ justifyContent: "space-between", padding: "14px 18px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Zap size={18} color="#f59e0b" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>Review Subscription & Quota</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current tier: {activeWorkspace?.plan}</div>
                </div>
              </div>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
