"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../DashboardContext";
import {
  BarChart3,
  Clock,
  Filter,
  Search,
  Activity,
  Server,
  AlertCircle,
  Eye,
  X,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileCode,
  ChevronDown,
  TrendingUp,
  Users,
  Target,
  ArrowRight,
  Zap,
  CheckCircle2,
  ShieldCheck,
  PieChart,
  Layers,
  Calendar,
  ChevronRight,
} from "lucide-react";

export default function AnalyticsPage() {
  const { activeWorkspace } = useDashboard();
  const [activeTab, setActiveTab] = useState<"funnel" | "telemetry">("funnel");
  const [data, setData] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [range, setRange] = useState("30d");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = (format: "csv" | "json") => {
    if (!activeWorkspace) return;
    setShowExportMenu(false);
    setIsExporting(true);
    const url = `/api/workspaces/${activeWorkspace.id}/metrics/export?format=${format}`;
    window.open(url, "_blank");
    setTimeout(() => setIsExporting(false), 2000);
  };

  const fetchFunnel = async () => {
    if (!activeWorkspace) return;
    setFunnelLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/analytics/funnel?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setFunnelData(json);
      }
    } catch (err) {
      console.error("Funnel fetch error:", err);
    } finally {
      setFunnelLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!activeWorkspace) return;
    try {
      const [res, ovRes] = await Promise.all([
        fetch(`/api/workspaces/${activeWorkspace.id}/metrics?range=${range}`),
        fetch(`/api/workspaces/${activeWorkspace.id}/analytics/overview`),
      ]);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
      if (ovRes.ok) {
        const ovJson = await ovRes.json();
        setOverview(ovJson);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchFunnel();
  }, [activeWorkspace?.id, range]);

  const recentEvents = data?.recentEvents || [];

  const filteredEvents = recentEvents.filter((ev: any) => {
    const matchesSearch =
      ev.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "SUCCESS" && ev.statusCode < 400) ||
      (statusFilter === "CLIENT_ERROR" && ev.statusCode >= 400 && ev.statusCode < 500) ||
      (statusFilter === "SERVER_ERROR" && ev.statusCode >= 500);

    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Telemetry Analytics</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Granular distribution, latency percentiles, and request inspection
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Export Raw Telemetry Button & Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn btn-secondary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
              disabled={isExporting}
            >
              <Download size={14} color="#06b6d4" />
              <span>{isExporting ? "Exporting..." : "Export Raw Telemetry"}</span>
              <ChevronDown
                size={13}
                style={{
                  transform: showExportMenu ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
            </button>

            {showExportMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "8px",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  minWidth: "210px",
                  zIndex: 50,
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="btn btn-ghost btn-sm"
                  style={{
                    justifyContent: "flex-start",
                    gap: "8px",
                    width: "100%",
                    fontSize: "12.5px",
                    textAlign: "left",
                  }}
                >
                  <FileSpreadsheet size={14} color="#34d399" />
                  <span>Download CSV (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("json")}
                  className="btn btn-ghost btn-sm"
                  style={{
                    justifyContent: "flex-start",
                    gap: "8px",
                    width: "100%",
                    fontSize: "12.5px",
                    textAlign: "left",
                  }}
                >
                  <FileCode size={14} color="#818cf8" />
                  <span>Download JSON (.json)</span>
                </button>
              </div>
            )}
          </div>

          {/* Range Selector */}
          <div
            style={{
              display: "inline-flex",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-medium)",
              borderRadius: "8px",
              padding: "2px",
            }}
          >
            {["7d", "30d", "90d", "all"].map((r) => (
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
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Sub-Tab Navigation */}
      <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
        <button
          onClick={() => setActiveTab("funnel")}
          className={`btn btn-sm ${activeTab === "funnel" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Target size={15} /> Conversion Funnel & Product Metrics
        </button>
        <button
          onClick={() => setActiveTab("telemetry")}
          className={`btn btn-sm ${activeTab === "telemetry" ? "btn-primary" : "btn-secondary"}`}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Activity size={15} /> Raw API Ingestion & Latency Logs
        </button>
      </div>

      {/* TAB 1: CONVERSION FUNNEL & PRODUCT METRICS (Phase 19) */}
      {activeTab === "funnel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Top KPI Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px" }}>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Total Signups</span>
                <Users size={16} color="#38bdf8" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)" }}>
                {funnelData?.kpis?.totalSignups ?? 0}
              </div>
              <span style={{ fontSize: "11.5px", color: "#34d399" }}>Verified user accounts</span>
            </div>

            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Active Workspaces</span>
                <Layers size={16} color="#818cf8" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#818cf8" }}>
                {funnelData?.kpis?.activeWorkspaces ?? 0}
              </div>
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Tenant containers</span>
            </div>

            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Trial & Onboarding</span>
                <CheckCircle2 size={16} color="#f59e0b" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#fbbf24" }}>
                {funnelData?.kpis?.onboardingCompleted ?? 0}
              </div>
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                {funnelData?.kpis?.trialingWorkspaces ?? 0} active trials
              </span>
            </div>

            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Paid Conversions</span>
                <ShieldCheck size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#34d399" }}>
                {funnelData?.kpis?.activeSubscriptions ?? 0}
              </div>
              <span style={{ fontSize: "11.5px", color: "#34d399" }}>
                Overall: {funnelData?.funnel?.overallConversionRate ?? 0}% from visit
              </span>
            </div>
          </div>

          {/* Interactive Conversion Funnel Visualization */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Target size={18} color="#818cf8" /> Multi-Stage Conversion Funnel
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                  Tracking visitor progression from landing page visits down to paying subscription activation with stage-to-stage drop-off.
                </p>
              </div>
              <span style={{ fontSize: "12px", background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                Range: {range.toUpperCase()} (Unique Session Deduplication)
              </span>
            </div>

            {funnelLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
                <div>Computing funnel drop-off statistics...</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {funnelData?.funnel?.stages?.map((stage: any, idx: number) => {
                  const barColor =
                    idx === 0 ? "#6366f1" :
                    idx === 1 ? "#818cf8" :
                    idx === 2 ? "#38bdf8" :
                    idx === 3 ? "#06b6d4" :
                    idx === 4 ? "#14b8a6" :
                    idx === 5 ? "#10b981" :
                    idx === 6 ? "#22c55e" : "#eab308";

                  return (
                    <div
                      key={stage.stage}
                      style={{
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "10px",
                        padding: "16px 20px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                            {stage.label}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "10px" }}>
                            ({stage.description})
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "13px" }}>
                          <span style={{ color: "var(--text-muted)" }}>
                            <strong style={{ color: "var(--text-primary)" }}>{stage.uniqueSessions}</strong> unique users / sessions
                          </span>
                          <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                            {stage.conversionRateFromPrevious}% step conversion
                          </span>
                          {idx > 0 && (
                            <span style={{ color: stage.dropoffRate > 50 ? "#f87171" : "#fbbf24", fontSize: "11.5px" }}>
                              {stage.dropoffRate}% drop-off
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Funnel Bar */}
                      <div style={{ height: "10px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "6px", overflow: "hidden", marginBottom: "6px" }}>
                        <div
                          style={{
                            width: `${Math.max(stage.conversionRateFromTop, 2)}%`,
                            height: "100%",
                            background: barColor,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                        <span>Denominator: {stage.denominatorText}</span>
                        <span>{stage.conversionRateFromTop}% overall funnel retention</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Activity Trends & Lead/Demo Pipelines */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {/* Daily Activity Chart */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <TrendingUp size={16} color="#34d399" /> Daily Activity & Signups
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {funnelData?.trends?.dailyActivity?.map((day: any) => (
                  <div key={day.date} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
                    <span style={{ width: "55px", color: "var(--text-muted)" }}>{day.date}</span>
                    <div style={{ flexGrow: 1, height: "6px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(day.signups * 25, 4))}%`,
                          height: "100%",
                          background: "#6366f1",
                        }}
                      />
                    </div>
                    <span style={{ minWidth: "80px", color: "#e2e8f0", textAlign: "right" }}>
                      {day.signups} users • {day.workspaces} ws
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline & Inbound Summary */}
            <div className="glass-card" style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap size={16} color="#fbbf24" /> Inbound Inquiries & Demos
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ padding: "12px 14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Total Sales Inquiries</span>
                    <strong style={{ color: "#38bdf8" }}>{funnelData?.kpis?.totalLeads ?? 0}</strong>
                  </div>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                    {funnelData?.kpis?.newInquiries ?? 0} awaiting sales representative response
                  </span>
                </div>

                <div style={{ padding: "12px 14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Interactive Demo Bookings</span>
                    <strong style={{ color: "#fbbf24" }}>{funnelData?.kpis?.totalDemos ?? 0}</strong>
                  </div>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                    Enterprise evaluation sessions requested
                  </span>
                </div>

                <div style={{ padding: "12px 14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Tenant Scoped Telemetry</span>
                    <strong style={{ color: "#34d399" }}>{funnelData?.kpis?.telemetryProcessed ?? 0}</strong>
                  </div>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                    Events processed in current workspace
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RAW TELEMETRY & LATENCY LOGS */}
      {activeTab === "telemetry" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Latency Percentiles & Status Breakdown Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {/* Latency Percentiles */}
            <div className="glass-card" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={16} color="#06b6d4" /> Latency Percentiles (p-metrics)
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", textAlign: "center" }}>
                <div style={{ padding: "16px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>p50 (Median)</div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#34d399" }}>
                    {overview?.kpis?.p50LatencyMs || 0}ms
                  </div>
                </div>
                <div style={{ padding: "16px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>p95</div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#38bdf8" }}>
                    {overview?.kpis?.p95LatencyMs || 0}ms
                  </div>
                </div>
                <div style={{ padding: "16px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>p99</div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#f87171" }}>
                    {overview?.kpis?.p99LatencyMs || 0}ms
                  </div>
                </div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="glass-card" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Server size={16} color="#8b5cf6" /> HTTP Response Status Codes
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data?.statusDistribution && data.statusDistribution.length > 0 ? (
                  data.statusDistribution.map((item: any) => (
                    <div key={item.code} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span
                        className={`badge ${
                          item.code >= 500
                            ? "badge-danger"
                            : item.code >= 400
                            ? "badge-warning"
                            : "badge-success"
                        }`}
                        style={{ width: "50px", justifyContent: "center" }}
                      >
                        {item.code}
                      </span>
                      <div style={{ flexGrow: 1, height: "8px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${item.percentage}%`,
                            height: "100%",
                            background: item.code >= 500 ? "#ef4444" : item.code >= 400 ? "#f59e0b" : "#10b981",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", minWidth: "65px", textAlign: "right" }}>
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>No status data available.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Search & Filter Event Log */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginBottom: "20px" }}>
          <div>
            <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Ingestion Telemetry Log</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Click any event row to inspect full JSON payload attributes
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: "220px" }}>
              <input
                type="text"
                placeholder="Search event or source..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: "32px", fontSize: "13px" }}
              />
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
              style={{ width: "auto", fontSize: "13px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success (2xx)</option>
              <option value="CLIENT_ERROR">Client Errors (4xx)</option>
              <option value="SERVER_ERROR">Server Errors (5xx)</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Event Type</th>
                <th>Cluster Node / Source</th>
                <th>Latency</th>
                <th>Timestamp</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((ev: any) => (
                  <tr key={ev.id} onClick={() => setSelectedEvent(ev)} style={{ cursor: "pointer" }}>
                    <td>
                      <span
                        className={`badge ${
                          ev.statusCode >= 500
                            ? "badge-danger"
                            : ev.statusCode >= 400
                            ? "badge-warning"
                            : "badge-success"
                        }`}
                      >
                        {ev.statusCode}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: "#fff", fontFamily: "var(--font-mono)" }}>
                      {ev.eventType}
                    </td>
                    <td>{ev.source}</td>
                    <td style={{ color: "#38bdf8", fontFamily: "var(--font-mono)" }}>{ev.latencyMs}ms</td>
                    <td>{new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" style={{ padding: "4px" }}>
                        <Eye size={14} color="#818cf8" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No events matched the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Event JSON Payload Inspector */}
      {selectedEvent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-card" style={{ width: "100%", maxWidth: "560px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={`badge ${selectedEvent.statusCode >= 400 ? "badge-danger" : "badge-success"}`}>
                  {selectedEvent.statusCode}
                </span>
                <h3 style={{ fontSize: "16px" }}>{selectedEvent.eventType}</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} style={{ color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px", fontSize: "13px" }}>
              <div><span style={{ color: "var(--text-muted)" }}>Source Node:</span> {selectedEvent.source}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Latency:</span> {selectedEvent.latencyMs}ms</div>
              <div><span style={{ color: "var(--text-muted)" }}>Recorded At:</span> {new Date(selectedEvent.timestamp).toLocaleString()}</div>
              <div><span style={{ color: "var(--text-muted)" }}>Event ID:</span> <span className="mono">{selectedEvent.id}</span></div>
            </div>

            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", fontWeight: 700 }}>
              Parsed JSON Ingest Payload:
            </div>
            <pre
              style={{
                background: "rgba(0, 0, 0, 0.6)",
                padding: "16px",
                borderRadius: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "12.5px",
                color: "#38bdf8",
                overflowX: "auto",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {JSON.stringify(selectedEvent.payload || {}, null, 2)}
            </pre>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setSelectedEvent(null)} className="btn btn-secondary btn-sm">
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
