"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Shield,
  Key,
  Users,
  CreditCard,
  Zap,
  ArrowRight,
  CheckCircle2,
  Lock,
  ChevronDown,
  Terminal,
  Globe2,
  BarChart3,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [activeTab, setActiveTab] = useState<"telemetry" | "code" | "rbac">("telemetry");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How does PulseFlow handle high-throughput event ingestion?",
      a: "PulseFlow utilizes an edge-optimized ingestion gateway running on distributed micro-nodes with asynchronous SQLite write-ahead logging and bulk buffering, delivering sub-20ms roundtrip acknowledgement.",
    },
    {
      q: "Can I manage multiple organizations and workspaces?",
      a: "Yes. PulseFlow is built ground-up for multi-tenancy. You can create, switch between, and manage multiple workspaces with independent teams, API keys, rate limits, and billing tiers.",
    },
    {
      q: "How are API keys secured and verified?",
      a: "Keys are cryptographically hashed using salt-based bcrypt algorithms before persistence. Raw keys are revealed strictly once during generation and never stored in plain text.",
    },
    {
      q: "Is there a free plan available to test locally?",
      a: "Absolutely. Our Developer Starter tier includes 50,000 monthly requests, full API access, and comprehensive dashboard analytics with zero credit card required.",
    },
  ];

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* Background Mesh Glows */}
      <div className="glow-mesh" />
      <div className="mesh-circle-1" />

      {/* Navigation Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(16px)",
          backgroundColor: "rgba(7, 9, 14, 0.8)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="container-xl"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "72px",
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "var(--accent-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
              }}
            >
              <Activity size={22} color="#ffffff" />
            </div>
            <span style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.03em" }}>
              Pulse<span className="gradient-text">Flow</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "28px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text-secondary)",
            }}
          >
            <a href="#features" style={{ transition: "color 0.2s" }} onMouseOver={(e) => (e.currentTarget.style.color = "#fff")} onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}>
              Features
            </a>
            <a href="#demo" style={{ transition: "color 0.2s" }} onMouseOver={(e) => (e.currentTarget.style.color = "#fff")} onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}>
              Live Demo
            </a>
            <a href="#pricing" style={{ transition: "color 0.2s" }} onMouseOver={(e) => (e.currentTarget.style.color = "#fff")} onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}>
              Pricing
            </a>
            <a href="#faq" style={{ transition: "color 0.2s" }} onMouseOver={(e) => (e.currentTarget.style.color = "#fff")} onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}>
              FAQ
            </a>
            <Link
              href="/api/health"
              target="_blank"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                padding: "3px 10px",
                background: "rgba(16, 185, 129, 0.1)",
                color: "#34d399",
                borderRadius: "20px",
                border: "1px solid rgba(16, 185, 129, 0.25)",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }}></span>
              API Online
            </Link>
          </nav>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/login" className="btn btn-ghost btn-sm">
              Sign In
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              Get Started <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ paddingTop: "80px", paddingBottom: "70px", position: "relative", zIndex: 10 }}>
        <div className="container-xl" style={{ textAlign: "center" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "6px 16px", borderRadius: "30px", marginBottom: "24px" }}>
            <Sparkles size={16} color="#818cf8" />
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#c7d2fe" }}>
              PulseFlow 2.0 Engine • High Throughput B2B Telemetry
            </span>
          </div>

          {/* Main Title */}
          <h1
            style={{
              fontSize: "clamp(38px, 6vw, 68px)",
              lineHeight: 1.1,
              maxWidth: "960px",
              margin: "0 auto 24px",
              fontWeight: 800,
            }}
          >
            Command Your Telemetry.{" "}
            <br />
            <span className="gradient-text">Scale Without Blindspots.</span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "clamp(16px, 2vw, 20px)",
              color: "var(--text-secondary)",
              maxWidth: "740px",
              margin: "0 auto 36px",
              lineHeight: 1.6,
            }}
          >
            The unified B2B observability platform designed for engineering leaders.
            Monitor distributed microservices, rotate scoped API keys, enforce granular RBAC, and automate usage-based billing.
          </p>

          {/* Action CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              flexWrap: "wrap",
              marginBottom: "50px",
            }}
          >
            <Link href="/register" className="btn btn-primary btn-lg">
              Start Free Trial <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              Launch Live Workspace Demo
            </Link>
          </div>

          {/* Metrics Trust Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "20px",
              maxWidth: "900px",
              margin: "0 auto",
              padding: "24px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>450M+</div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Telemetry Events Ingested</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#34d399" }}>&lt; 18ms</div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Average Edge Latency</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#818cf8" }}>99.99%</div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>High-Availability SLA</div>
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#38bdf8" }}>Zero-Trust</div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Granular RBAC Enforced</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Platform Live Preview Section */}
      <section id="demo" style={{ padding: "70px 0", position: "relative", zIndex: 10 }}>
        <div className="container-xl">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontSize: "32px", marginBottom: "12px" }}>
              Experience the <span className="gradient-text">PulseFlow Engine</span> in Action
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto" }}>
              Toggle between real telemetry ingestion, developer code snippets, and role-based permissions.
            </p>
          </div>

          {/* Interactive Window Box */}
          <div
            className="glass-card"
            style={{
              maxWidth: "1050px",
              margin: "0 auto",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            {/* Window title bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                background: "rgba(0, 0, 0, 0.5)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  pulseflow.internal // telemetry-cluster-v2
                </span>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setActiveTab("telemetry")}
                  className={`btn btn-sm ${activeTab === "telemetry" ? "btn-primary" : "btn-ghost"}`}
                >
                  <Activity size={14} /> Live Telemetry
                </button>
                <button
                  onClick={() => setActiveTab("code")}
                  className={`btn btn-sm ${activeTab === "code" ? "btn-primary" : "btn-ghost"}`}
                >
                  <Terminal size={14} /> Ingest API
                </button>
                <button
                  onClick={() => setActiveTab("rbac")}
                  className={`btn btn-sm ${activeTab === "rbac" ? "btn-primary" : "btn-ghost"}`}
                >
                  <Shield size={14} /> RBAC Matrix
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div style={{ padding: "28px", minHeight: "360px", background: "rgba(10, 13, 20, 0.85)" }}>
              {activeTab === "telemetry" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>Active Ingestion Stream (240 events/sec)</span>
                    </div>
                    <span className="code-pill">Region: us-east-1a</span>
                  </div>

                  {/* Sample Stream Rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {[
                      { type: "api_request", src: "gateway-edge-sea", code: 200, time: "Just now", lat: "18ms", status: "SUCCESS" },
                      { type: "auth_verify", src: "auth-cluster-iad", code: 201, time: "2s ago", lat: "24ms", status: "SUCCESS" },
                      { type: "telemetry_sync", src: "worker-eu-central", code: 200, time: "4s ago", lat: "32ms", status: "SUCCESS" },
                      { type: "pipeline_job", src: "batch-node-08", code: 429, time: "6s ago", lat: "88ms", status: "WARNING" },
                      { type: "webhook_dispatch", src: "event-bus-ord", code: 200, time: "9s ago", lat: "19ms", status: "SUCCESS" },
                    ].map((row, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 16px",
                          borderRadius: "8px",
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid var(--border-subtle)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "13px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span className={`badge ${row.status === "SUCCESS" ? "badge-success" : "badge-warning"}`}>
                            {row.code}
                          </span>
                          <span style={{ color: "#fff", fontWeight: 600 }}>{row.type}</span>
                          <span style={{ color: "var(--text-muted)" }}>from</span>
                          <span style={{ color: "#38bdf8" }}>{row.src}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <span style={{ color: "#34d399" }}>{row.lat}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{row.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "code" && (
                <div>
                  <div style={{ marginBottom: "14px", color: "var(--text-secondary)", fontSize: "14px" }}>
                    Send structured telemetry events using your scoped API key via standard HTTPS POST:
                  </div>
                  <pre
                    style={{
                      padding: "20px",
                      borderRadius: "10px",
                      background: "rgba(0, 0, 0, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      color: "#e2e8f0",
                      fontFamily: "var(--font-mono)",
                      fontSize: "13.5px",
                      lineHeight: "1.6",
                      overflowX: "auto",
                    }}
                  >
{`curl -X POST https://your-domain.com/api/v1/ingest \\
  -H "Authorization: Bearer pfl_live_9941a82f33c0e" \\
  -H "Content-Type: application/json" \\
  -d '{
    "eventType": "api_request",
    "source": "backend-auth-service",
    "payload": {
      "userRegion": "eu-west-1",
      "action": "checkout_session_created",
      "tier": "enterprise"
    }
  }'`}
                  </pre>
                  <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px", color: "#34d399", fontSize: "13px" }}>
                    <CheckCircle2 size={16} /> Returns 201 Created with millisecond latency acknowledgement and usage balance.
                  </div>
                </div>
              )}

              {activeTab === "rbac" && (
                <div>
                  <div style={{ marginBottom: "14px", color: "var(--text-secondary)", fontSize: "14px" }}>
                    Zero-trust hierarchical permissions strictly evaluated on every server-side operation:
                  </div>
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Role Tier</th>
                          <th>Read Metrics</th>
                          <th>Generate Keys</th>
                          <th>Invite Members</th>
                          <th>Billing & Plans</th>
                          <th>Delete Workspace</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="badge badge-indigo">OWNER</span></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                        </tr>
                        <tr>
                          <td><span className="badge badge-success">ADMIN</span></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                        </tr>
                        <tr>
                          <td><span className="badge badge-neutral">MEMBER</span></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><span style={{ color: "var(--text-muted)" }}>View only</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                        </tr>
                        <tr>
                          <td><span className="badge badge-neutral">VIEWER</span></td>
                          <td><CheckCircle2 size={16} color="#10b981" /></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Bento Grid */}
      <section id="features" style={{ padding: "80px 0", position: "relative", zIndex: 10 }}>
        <div className="container-xl">
          <div style={{ textAlign: "center", marginBottom: "50px" }}>
            <h2 style={{ fontSize: "34px", marginBottom: "12px" }}>
              Engineered for Enterprise <span className="gradient-text">Reliability & Scale</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "620px", margin: "0 auto" }}>
              Every feature is built with production durability, data isolation, and developer experience in mind.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Card 1 */}
            <div className="glass-card glass-card-interactive" style={{ padding: "28px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(6, 182, 212, 0.12)",
                  border: "1px solid rgba(6, 182, 212, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <Activity size={24} color="#06b6d4" />
              </div>
              <h3 style={{ fontSize: "19px", marginBottom: "10px" }}>High-Throughput Ingestion</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                Process millions of distributed event pings with automatic time-series bucketing, latency aggregation, and instant anomaly alerts.
              </p>
            </div>

            {/* Card 2 */}
            <div className="glass-card glass-card-interactive" style={{ padding: "28px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(99, 102, 241, 0.12)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <Key size={24} color="#6366f1" />
              </div>
              <h3 style={{ fontSize: "19px", marginBottom: "10px" }}>Cryptographic Scoped API Keys</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                Generate live & test keys with granular permission scopes. Keys are hashed with bcrypt and masked with prefix identifiers for maximum protection.
              </p>
            </div>

            {/* Card 3 */}
            <div className="glass-card glass-card-interactive" style={{ padding: "28px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <Users size={24} color="#10b981" />
              </div>
              <h3 style={{ fontSize: "19px", marginBottom: "10px" }}>Multi-Tenant Workspaces</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                Switch effortlessly between client workspaces and subsidiary organizations with isolated metric stores, audit logs, and independent quotas.
              </p>
            </div>

            {/* Card 4 */}
            <div className="glass-card glass-card-interactive" style={{ padding: "28px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(139, 92, 246, 0.12)",
                  border: "1px solid rgba(139, 92, 246, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <Shield size={24} color="#8b5cf6" />
              </div>
              <h3 style={{ fontSize: "19px", marginBottom: "10px" }}>Enterprise RBAC & Audits</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                Four-tier role hierarchy (Owner, Admin, Member, Viewer). Every destructive action, key generation, and login is immutably logged with IP addresses.
              </p>
            </div>

            {/* Card 5 */}
            <div className="glass-card glass-card-interactive" style={{ padding: "28px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <CreditCard size={24} color="#f59e0b" />
              </div>
              <h3 style={{ fontSize: "19px", marginBottom: "10px" }}>Usage Billing & Invoices</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                Automated monthly quota meters, upgrade and downgrade paths, and downloadable itemized PDF invoice histories.
              </p>
            </div>

            {/* Card 6 */}
            <div className="glass-card glass-card-interactive" style={{ padding: "28px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <BarChart3 size={24} color="#3b82f6" />
              </div>
              <h3 style={{ fontSize: "19px", marginBottom: "10px" }}>Real-Time Observability</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                Visual latency distribution, status code breakdown graphs, and live filtering across 24h, 7d, and 30d time windows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ padding: "80px 0", background: "rgba(255, 255, 255, 0.01)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", position: "relative", zIndex: 10 }}>
        <div className="container-xl">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontSize: "34px", marginBottom: "12px" }}>
              Transparent, <span className="gradient-text">Predictable Pricing</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "560px", margin: "0 auto 24px" }}>
              Scale effortlessly from hobby projects to high-volume enterprise clusters.
            </p>

            {/* Monthly / Annual Toggle */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border-medium)",
                borderRadius: "30px",
              }}
            >
              <button
                onClick={() => setBillingCycle("monthly")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "24px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: billingCycle === "monthly" ? "#fff" : "var(--text-secondary)",
                  background: billingCycle === "monthly" ? "var(--accent-indigo)" : "transparent",
                  transition: "all 0.2s",
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "24px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: billingCycle === "annual" ? "#fff" : "var(--text-secondary)",
                  background: billingCycle === "annual" ? "var(--accent-indigo)" : "transparent",
                  transition: "all 0.2s",
                }}
              >
                Annual <span style={{ color: "#34d399", fontSize: "11px", marginLeft: "4px" }}>(Save 20%)</span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
              gap: "28px",
              maxWidth: "1100px",
              margin: "0 auto",
            }}
          >
            {/* Starter */}
            <div className="glass-card" style={{ padding: "36px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Developer Starter</div>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
                Ideal for indie developers and prototyping new microservices.
              </p>
              <div style={{ fontSize: "40px", fontWeight: 800, marginBottom: "24px" }}>
                $0 <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)" }}>/ month</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px", flexGrow: 1 }}>
                {["50,000 requests / mo", "Single Workspace", "1 Active API Key", "24-Hour Event Retention", "Community Discord Support"].map((feat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "var(--text-secondary)" }}>
                    <CheckCircle2 size={16} color="#10b981" /> {feat}
                  </div>
                ))}
              </div>

              <Link href="/register" className="btn btn-secondary" style={{ width: "100%" }}>
                Deploy Free Starter
              </Link>
            </div>

            {/* Pro - Featured */}
            <div
              className="glass-card"
              style={{
                padding: "36px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                border: "2px solid rgba(99, 102, 241, 0.6)",
                boxShadow: "0 0 30px rgba(99, 102, 241, 0.2)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-13px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--accent-gradient)",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "4px 14px",
                  borderRadius: "20px",
                  letterSpacing: "0.05em",
                }}
              >
                Most Popular Choice
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Growth Pro</div>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
                For scaling engineering teams requiring multi-seat RBAC and deep logs.
              </p>
              <div style={{ fontSize: "40px", fontWeight: 800, marginBottom: "24px" }}>
                ${billingCycle === "annual" ? "79" : "99"}{" "}
                <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)" }}>/ month</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px", flexGrow: 1 }}>
                {[
                  "250,000 requests / mo",
                  "Up to 10 Team Members",
                  "10 Active Cryptographic Keys",
                  "30-Day Event Retention",
                  "Granular RBAC Permissions",
                  "Priority Email & Slack Support",
                ].map((feat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "#e2e8f0" }}>
                    <CheckCircle2 size={16} color="#6366f1" /> {feat}
                  </div>
                ))}
              </div>

              <Link href="/register" className="btn btn-primary" style={{ width: "100%" }}>
                Start 14-Day Pro Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="glass-card" style={{ padding: "36px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Scale Enterprise</div>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
                Mission-critical deployments requiring dedicated SLA and compliance.
              </p>
              <div style={{ fontSize: "40px", fontWeight: 800, marginBottom: "24px" }}>
                ${billingCycle === "annual" ? "319" : "399"}{" "}
                <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)" }}>/ month</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px", flexGrow: 1 }}>
                {[
                  "1,000,000+ requests / mo",
                  "Unlimited Team Seats",
                  "Unlimited Scoped API Keys",
                  "1-Year Data Retention",
                  "99.99% Uptime SLA Guarantee",
                  "Dedicated Solutions Architect",
                ].map((feat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "var(--text-secondary)" }}>
                    <CheckCircle2 size={16} color="#06b6d4" /> {feat}
                  </div>
                ))}
              </div>

              <Link href="/register" className="btn btn-secondary" style={{ width: "100%" }}>
                Deploy Enterprise Tier
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" style={{ padding: "80px 0", position: "relative", zIndex: 10 }}>
        <div className="container-lg">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontSize: "32px", marginBottom: "12px" }}>Frequently Asked Questions</h2>
            <p style={{ color: "var(--text-secondary)" }}>Everything you need to know about PulseFlow architecture and policies.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {faqs.map((item, idx) => (
              <div
                key={idx}
                className="glass-card"
                style={{ padding: "20px 24px", cursor: "pointer" }}
                onClick={() => toggleFaq(idx)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "16px", fontWeight: 600, color: "#fff" }}>{item.q}</span>
                  <ChevronDown
                    size={18}
                    style={{
                      transform: openFaq === idx ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                      color: "var(--text-muted)",
                    }}
                  />
                </div>
                {openFaq === idx && (
                  <p style={{ marginTop: "14px", color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "50px 0 30px",
          background: "#05070a",
          fontSize: "13.5px",
          color: "var(--text-muted)",
        }}
      >
        <div className="container-xl">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px",
              marginBottom: "30px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "var(--accent-gradient)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Activity size={16} color="#fff" />
              </div>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>PulseFlow</span>
            </div>

            <div style={{ display: "flex", gap: "24px" }}>
              <Link href="/login" style={{ transition: "color 0.2s" }} onMouseOver={(e) => (e.currentTarget.style.color = "#fff")} onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>Sign In</Link>
              <Link href="/register" style={{ transition: "color 0.2s" }} onMouseOver={(e) => (e.currentTarget.style.color = "#fff")} onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>Register</Link>
              <Link href="/api/health" target="_blank" style={{ transition: "color 0.2s" }} onMouseOver={(e) => (e.currentTarget.style.color = "#fff")} onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>System Health</Link>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>© {new Date().getFullYear()} PulseFlow Systems Inc. All rights reserved.</div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span className="code-pill">Next.js 15 App Router</span>
              <span className="code-pill">Prisma SQLite</span>
              <span className="code-pill">RBAC Enabled</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
