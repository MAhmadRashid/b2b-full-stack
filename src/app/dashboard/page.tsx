"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "./DashboardContext";
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
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Compass,
  Building,
  CreditCard,
  Bell,
  Settings,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Circle,
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

  // Phase 14: Onboarding, Guided Tour & Getting Started Checklist
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [tourCurrentIndex, setTourCurrentIndex] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [checklistExpanded, setChecklistExpanded] = useState(true);

  const fetchOnboardingStatus = async () => {
    try {
      const res = await fetch("/api/onboarding");
      if (res.ok) {
        const json = await res.json();
        setOnboardingData(json);
        // Automatically trigger tour if not completed and not dismissed
        if (json.progress && !json.progress.tourCompleted && !json.progress.tourDismissed) {
          setShowTour(true);
        }
      }
    } catch (err) {
      console.error("Failed to fetch onboarding status", err);
    }
  };

  const handleDismissChecklist = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistDismissed: true }),
      });
      setOnboardingData((prev: any) =>
        prev
          ? {
              ...prev,
              progress: { ...prev.progress, checklistDismissed: true },
            }
          : prev
      );
    } catch (err) {
      console.error("Failed to dismiss checklist", err);
    }
  };

  const handleFinishTour = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourCompleted: true, tourDismissed: true }),
      });
      setShowTour(false);
      setOnboardingData((prev: any) =>
        prev
          ? {
              ...prev,
              progress: { ...prev.progress, tourCompleted: true, tourDismissed: true },
            }
          : prev
      );
    } catch (err) {
      setShowTour(false);
    }
  };

  const handleSkipTour = async () => {
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourDismissed: true }),
      });
      setShowTour(false);
      setOnboardingData((prev: any) =>
        prev
          ? {
              ...prev,
              progress: { ...prev.progress, tourDismissed: true },
            }
          : prev
      );
    } catch (err) {
      setShowTour(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchOnboardingStatus();
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

  const tourSteps = [
    {
      title: "Welcome to Nexora!",
      description:
        "Welcome to your telemetry & API observability dashboard. Let's take a quick 1-minute tour through key features to get you up to speed.",
      target: "tour-welcome",
      icon: Sparkles,
      color: "#818cf8",
    },
    {
      title: "Multi-Tenant Navigation & Switching",
      description:
        "Use the sidebar switchers to seamlessly jump between organizations and isolated workspace clusters with distinct quotas and security boundaries.",
      target: "ws-switcher-button",
      icon: Layers,
      color: "#38bdf8",
    },
    {
      title: "Telemetry & Pipeline Analytics",
      description:
        "Monitor real-time request rates, p95/p99 latency distributions, 5xx error spikes, and endpoint breakdowns via Analytics & Telemetry.",
      target: "tour-nav-analytics",
      icon: TrendingUp,
      color: "#10b981",
    },
    {
      title: "Developer Scoped API Keys",
      description:
        "Generate SHA-256 hashed bearer tokens with granular scopes (ingest:write, read:all, admin:keys) to integrate your Node, Python, or Go microservices.",
      target: "tour-nav-apikeys",
      icon: Key,
      color: "#f59e0b",
    },
    {
      title: "Team Permissions & RBAC",
      description:
        "Invite engineering colleagues as Owners, Admins, Members, or Viewers. Role-based access protects API keys, billing, and cluster configs.",
      target: "tour-nav-team",
      icon: Users,
      color: "#ec4899",
    },
    {
      title: "Notifications & Alerts",
      description:
        "Receive instant in-app alerts and customizable email notifications for quota limits, error spikes, and member events via the top notification center.",
      target: "tour-nav-notifications",
      icon: Bell,
      color: "#a855f7",
    },
    {
      title: "Subscriptions, Usage & Invoicing",
      description:
        "Review monthly quota consumption, upgrade subscription tiers, manage payment methods, and download PDF receipts under Plans & Billing.",
      target: "tour-nav-billing",
      icon: CreditCard,
      color: "#06b6d4",
    },
    {
      title: "Settings & Webhooks",
      description:
        "Configure HMAC-signed webhook delivery, view cryptographically timestamped audit logs, or restart this guided tour at any time from Settings.",
      target: "tour-nav-settings",
      icon: Settings,
      color: "#818cf8",
    },
  ];

  const currentTourStep = tourSteps[tourCurrentIndex] || tourSteps[0];
  const checklist = onboardingData?.checklist;
  const isChecklistDismissed = onboardingData?.progress?.checklistDismissed;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", position: "relative" }}>
      {/* 1. Interactive Guided Product Tour Modal Overlay */}
      {showTour && (
        <div
          id="product-tour-modal"
          style={{
            position: "fixed",
            bottom: "32px",
            right: "32px",
            width: "380px",
            maxWidth: "calc(100vw - 40px)",
            zIndex: 1000,
            background: "#0f172a",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            borderRadius: "14px",
            boxShadow: "0 20px 45px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.2)",
            padding: "24px",
            backdropFilter: "blur(16px)",
            animation: "fadeIn 0.25s ease-out",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9px",
                  background: `rgba(99, 102, 241, 0.15)`,
                  border: `1px solid ${currentTourStep.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {React.createElement(currentTourStep.icon, { size: 18, color: currentTourStep.color })}
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Step {tourCurrentIndex + 1} of {tourSteps.length}
                </span>
                <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#fff" }}>
                  {currentTourStep.title}
                </h4>
              </div>
            </div>

            <button
              id="tour-close-btn"
              onClick={handleSkipTour}
              title="Close Tour"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.55, marginBottom: "20px" }}>
            {currentTourStep.description}
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              id="tour-skip-btn"
              onClick={handleSkipTour}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "12px",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Skip Tour
            </button>

            <div style={{ display: "flex", gap: "8px" }}>
              {tourCurrentIndex > 0 && (
                <button
                  id="tour-back-btn"
                  onClick={() => setTourCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                >
                  <ArrowLeft size={13} /> Back
                </button>
              )}

              {tourCurrentIndex < tourSteps.length - 1 ? (
                <button
                  id="tour-next-btn"
                  onClick={() => setTourCurrentIndex((prev) => Math.min(tourSteps.length - 1, prev + 1))}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                >
                  Next <ArrowRight size={13} />
                </button>
              ) : (
                <button
                  id="tour-finish-btn"
                  onClick={handleFinishTour}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: "12px", padding: "6px 14px", background: "linear-gradient(135deg, #10b981, #059669)" }}
                >
                  Finish Tour <CheckCircle2 size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Getting Started Checklist Card */}
      {checklist && !isChecklistDismissed && (
        <div
          id="getting-started-checklist"
          className="glass-card"
          style={{
            padding: "20px 24px",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            background: "linear-gradient(180deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)",
            borderRadius: "12px",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: checklistExpanded ? "16px" : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(99, 102, 241, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Compass size={18} color="#818cf8" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    Getting Started Checklist
                  </h3>
                  <span
                    className="badge badge-accent"
                    style={{ fontSize: "11px", padding: "2px 8px" }}
                  >
                    {checklist.completedCount} of {checklist.totalCount} completed ({checklist.progressPercent}%)
                  </span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "12.5px", margin: "2px 0 0 0" }}>
                  Live verified progress for your account setup and telemetry pipeline.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={() => setChecklistExpanded(!checklistExpanded)}
                className="btn btn-secondary btn-sm"
                style={{ padding: "5px 10px", fontSize: "12px" }}
                title={checklistExpanded ? "Collapse checklist" : "Expand checklist"}
              >
                {checklistExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <button
                id="btn-dismiss-checklist"
                onClick={handleDismissChecklist}
                className="btn btn-secondary btn-sm"
                style={{ padding: "5px 10px", fontSize: "12px", color: "var(--text-muted)" }}
                title="Dismiss checklist"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Progress bar line */}
          <div
            style={{
              height: "4px",
              width: "100%",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "2px",
              overflow: "hidden",
              marginBottom: checklistExpanded ? "18px" : 0,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${checklist.progressPercent}%`,
                background: "linear-gradient(90deg, #6366f1, #10b981)",
                transition: "width 0.4s ease",
              }}
            />
          </div>

          {/* Checklist items list */}
          {checklistExpanded && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "12px",
              }}
            >
              {checklist.items?.map((item: any) => (
                <Link
                  key={item.id}
                  href={item.link}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: item.completed
                      ? "rgba(16, 185, 129, 0.06)"
                      : "rgba(255, 255, 255, 0.03)",
                    border: item.completed
                      ? "1px solid rgba(16, 185, 129, 0.25)"
                      : "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    textDecoration: "none",
                    transition: "transform 0.15s, border-color 0.15s",
                  }}
                >
                  <div style={{ marginTop: "2px", flexShrink: 0 }}>
                    {item.completed ? (
                      <CheckCircle2 size={16} color="#10b981" />
                    ) : (
                      <Circle size={16} color="var(--text-muted)" />
                    )}
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: item.completed ? "#34d399" : "#fff",
                        textDecoration: item.completed ? "line-through" : "none",
                        opacity: item.completed ? 0.8 : 1,
                      }}
                    >
                      {item.title}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {item.description}
                    </div>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" style={{ marginTop: "3px" }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

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
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
            {overview?.totalEvents?.toLocaleString() || 0}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "var(--success)" }}>
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
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
            {overview?.avgLatency || 0} ms
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "var(--accent-primary)" }}>
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
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
            {overview?.successRate}%
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: overview?.errorRate && overview.errorRate > 5 ? "var(--danger)" : "var(--text-muted)" }}>
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
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "6px" }}>
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
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
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
