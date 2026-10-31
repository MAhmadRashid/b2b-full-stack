"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
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
  Server,
  Layers,
  Filter,
  Check,
  AlertTriangle,
  Clock,
  HelpCircle,
  ExternalLink,
  Copy,
  Play,
  Sun,
  Moon,
  Calculator,
  ShieldCheck,
  CheckCircle,
  Pause,
  Search,
  Menu,
  X,
  Gauge,
  Fingerprint,
  Radio,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  AlertCircle,
  Mail,
  Send,
  Calendar,
} from "lucide-react";

import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import { LeadCaptureForm } from "@/components/funnel/LeadCaptureForm";
import { DemoBookingModal } from "@/components/funnel/DemoBookingModal";
import { NexoraLogo } from "@/components/ui/NexoraLogo";

interface TelemetryEvent {
  id: string;
  type: string;
  src: string;
  region: "us-east-1" | "us-west-2" | "eu-central-1" | "ap-southeast-1";
  code: 200 | 201 | 429 | 500;
  time: string;
  lat: number;
  status: "SUCCESS" | "WARNING" | "ERROR";
  method: "POST" | "GET";
}

const RAW_DEMO_TELEMETRY: TelemetryEvent[] = [
  { id: "evt_1", type: "api_request", src: "gateway-edge-sea", region: "us-west-2", code: 200, time: "Just now", lat: 18, status: "SUCCESS", method: "POST" },
  { id: "evt_2", type: "auth_verify", src: "auth-cluster-iad", region: "us-east-1", code: 200, time: "2s ago", lat: 24, status: "SUCCESS", method: "POST" },
  { id: "evt_3", type: "telemetry_sync", src: "worker-eu-central", region: "eu-central-1", code: 200, time: "4s ago", lat: 32, status: "SUCCESS", method: "POST" },
  { id: "evt_4", type: "pipeline_job", src: "batch-node-08", region: "us-east-1", code: 429, time: "6s ago", lat: 88, status: "WARNING", method: "POST" },
  { id: "evt_5", type: "webhook_dispatch", src: "event-bus-ord", region: "us-east-1", code: 200, time: "9s ago", lat: 19, status: "SUCCESS", method: "POST" },
  { id: "evt_6", type: "db_replica_read", src: "db-proxy-fra", region: "eu-central-1", code: 500, time: "11s ago", lat: 142, status: "ERROR", method: "GET" },
  { id: "evt_7", type: "metrics_ingest", src: "collector-sin", region: "ap-southeast-1", code: 200, time: "14s ago", lat: 29, status: "SUCCESS", method: "POST" },
  { id: "evt_8", type: "token_rotation", src: "security-iad", region: "us-east-1", code: 201, time: "18s ago", lat: 21, status: "SUCCESS", method: "POST" },
  { id: "evt_9", type: "rate_limiter_probe", src: "gateway-pdx", region: "us-west-2", code: 429, time: "22s ago", lat: 64, status: "WARNING", method: "GET" },
  { id: "evt_10", type: "cluster_heartbeat", src: "k8s-mesh-fra", region: "eu-central-1", code: 200, time: "26s ago", lat: 15, status: "SUCCESS", method: "POST" },
  { id: "evt_11", type: "grpc_stream_fail", src: "edge-sin", region: "ap-southeast-1", code: 500, time: "30s ago", lat: 210, status: "ERROR", method: "POST" },
  { id: "evt_12", type: "audit_log_write", src: "audit-iad", region: "us-east-1", code: 200, time: "35s ago", lat: 17, status: "SUCCESS", method: "POST" },
];

export default function LandingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [activeTab, setActiveTab] = useState<"telemetry" | "chart" | "map" | "code" | "sandbox" | "rbac">("telemetry");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Active section for navbar scroll spy
  const [activeSection, setActiveSection] = useState<string>("hero");

  // Respect user prefers-reduced-motion preference
  const shouldReduceMotion = useReducedMotion();
  const [isMounted, setIsMounted] = useState<boolean>(false);
  // Light / Dark mode state with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  useEffect(() => {
    setIsMounted(true);
    try {
      const savedTheme = localStorage.getItem("nexora-theme") || localStorage.getItem("pulseflow-theme");
      if (savedTheme === "light") {
        setIsDarkMode(false);
        document.documentElement.setAttribute("data-theme", "light");
      } else {
        setIsDarkMode(true);
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {
      // Ignore storage access error
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    const themeName = nextDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", themeName);
    try {
      localStorage.setItem("nexora-theme", themeName);
      localStorage.setItem("pulseflow-theme", themeName);
    } catch {
      // Ignore storage write error
    }
  };

  // Mobile menu open state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // System Health Status (queried live or fallback demo)
  const [systemHealth, setSystemHealth] = useState<{ isLive: boolean; status: string; uptime: string }>({
    isLive: false,
    status: "Operational",
    uptime: "99.99%",
  });

  // Query /api/health to check if system is live
  useEffect(() => {
    let isSubscribed = true;
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error("Health check degraded");
        return res.json();
      })
      .then((data) => {
        if (isSubscribed && data?.status === "HEALTHY") {
          setSystemHealth({
            isLive: true,
            status: "Systems Normal",
            uptime: "99.99%",
          });
        }
      })
      .catch(() => {
        if (isSubscribed) {
          setSystemHealth({
            isLive: false,
            status: "Systems Normal",
            uptime: "99.99%",
          });
        }
      });
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Keyboard accessibility: dismiss mobile menu on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Telemetry Stream Controls (Pause/Resume & Search)
  const [isStreamPaused, setIsStreamPaused] = useState(false);
  const [streamSearch, setStreamSearch] = useState("");
  const [isStreamLoading, setIsStreamLoading] = useState(false);
  const [isStreamSimulateError, setIsStreamSimulateError] = useState(false);

  // How It Works section state
  const [howItWorksStep, setHowItWorksStep] = useState<1 | 2 | 3>(1);
  const [howItWorksLang, setHowItWorksLang] = useState<"curl" | "node" | "python" | "go">("node");
  const [howItWorksCopied, setHowItWorksCopied] = useState(false);

  // Telemetry Filters
  const [statusFilter, setStatusFilter] = useState<"ALL" | "200" | "429" | "500">("ALL");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");

  // Code Snippet Generator language state & copy feedback
  const [codeLang, setCodeLang] = useState<"curl" | "node" | "python" | "go">("curl");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // API Playground sandbox state
  const [sandboxApiKey, setSandboxApiKey] = useState("pfl_demo_sandbox_token_8892");
  const [sandboxEventType, setSandboxEventType] = useState("api_request");
  const [sandboxSource, setSandboxSource] = useState("payment-microservice");
  const [sandboxResponse, setSandboxResponse] = useState<any>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Quota & Plan Recommendation Calculator State
  const [calculatorRequests, setCalculatorRequests] = useState<number>(150000);

  // Demo Booking Modal State
  const [isDemoBookingOpen, setIsDemoBookingOpen] = useState(false);

  // Newsletter subscription state
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  // Apply dark/light mode attribute to HTML root
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    }
  }, [isDarkMode]);

  // Stage 1: Landing Page Visit Funnel Event
  useEffect(() => {
    trackEvent("landing_page_viewed", "NAVIGATION", { page: "home" }, "LANDING_VISIT");
  }, []);

  // Active section scroll spy listener
  useEffect(() => {
    const sectionIds = ["features", "how-it-works", "demo", "calculator", "pricing", "contact-sales", "faq"];
    const handleScroll = () => {
      const scrollPos = window.scrollY + 160;
      let current = "hero";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            current = id;
            break;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const filteredTelemetry = useMemo(() => {
    return RAW_DEMO_TELEMETRY.filter((item) => {
      if (statusFilter === "200" && item.code !== 200 && item.code !== 201) return false;
      if (statusFilter === "429" && item.code !== 429) return false;
      if (statusFilter === "500" && item.code !== 500) return false;
      if (regionFilter !== "ALL" && item.region !== regionFilter) return false;
      if (streamSearch.trim()) {
        const query = streamSearch.toLowerCase();
        const matchesType = item.type.toLowerCase().includes(query);
        const matchesSrc = item.src.toLowerCase().includes(query);
        const matchesRegion = item.region.toLowerCase().includes(query);
        const matchesCode = String(item.code).includes(query);
        if (!matchesType && !matchesSrc && !matchesRegion && !matchesCode) return false;
      }
      return true;
    });
  }, [statusFilter, regionFilter, streamSearch]);

  // Computed summary metrics that dynamically update as demo filters change
  const demoMetrics = useMemo(() => {
    const count = filteredTelemetry.length;
    if (count === 0) {
      return {
        count: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        errorRate: 0,
        avgLatency: 0,
        chartSlots: [
          { time: "00:00", p50: 0, p95: 0, p99: 0 },
          { time: "00:05", p50: 0, p95: 0, p99: 0 },
          { time: "00:10", p50: 0, p95: 0, p99: 0 },
          { time: "00:15", p50: 0, p95: 0, p99: 0 },
        ],
      };
    }
    const latencies = filteredTelemetry.map((e) => e.lat).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(count * 0.5)] || 0;
    const p95 = latencies[Math.floor(count * 0.95)] || latencies[count - 1] || 0;
    const p99 = latencies[Math.floor(count * 0.99)] || latencies[count - 1] || 0;
    const errors = filteredTelemetry.filter((e) => e.code >= 400).length;
    const errorRate = Math.round((errors / count) * 100);
    const avgLatency = Math.round(latencies.reduce((sum, v) => sum + v, 0) / count);

    // Dynamic chart bars reflecting active filters
    const chartSlots = [
      { time: "00:00", p50: Math.max(12, Math.round(p50 * 0.9)), p95: Math.round(p95 * 0.85), p99: Math.round(p99 * 0.88) },
      { time: "00:05", p50: Math.round(p50 * 0.95), p95: Math.round(p95 * 0.9), p99: Math.round(p99 * 0.92) },
      { time: "00:10", p50: Math.round(p50 * 0.92), p95: Math.round(p95 * 0.95), p99: Math.round(p99 * 0.96) },
      { time: "00:15", p50: p50, p95: p95, p99: p99 },
      { time: "00:20", p50: Math.round(p50 * 0.94), p95: Math.round(p95 * 0.91), p99: Math.round(p99 * 0.9) },
      { time: "00:25", p50: Math.round(p50 * 0.98), p95: Math.round(p95 * 0.94), p99: Math.round(p99 * 0.95) },
      { time: "00:30", p50: p50, p95: p95, p99: p99 },
      { time: "00:35", p50: Math.round(p50 * 0.96), p95: Math.round(p95 * 0.92), p99: Math.round(p99 * 0.93) },
    ];

    return { count, p50, p95, p99, errorRate, avgLatency, chartSlots };
  }, [filteredTelemetry]);

  // Code snippets by language
  const codeSnippets = {
    curl: `curl -X POST http://localhost:5000/api/v1/ingest \\
  -H "Authorization: Bearer ${sandboxApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "eventType": "${sandboxEventType}",
    "source": "${sandboxSource}",
    "payload": {
      "region": "us-east-1",
      "action": "checkout_session_created",
      "latencyMs": 18
    }
  }'`,
    node: `import fetch from 'node-fetch';

const response = await fetch('http://localhost:5000/api/v1/ingest', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${sandboxApiKey}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    eventType: '${sandboxEventType}',
    source: '${sandboxSource}',
    payload: { region: 'us-east-1', action: 'checkout_session_created', latencyMs: 18 }
  })
});

const data = await response.json();
console.log('Ingest ACK:', data);`,
    python: `import requests

url = "http://localhost:5000/api/v1/ingest"
headers = {
    "Authorization": "Bearer ${sandboxApiKey}",
    "Content-Type": "application/json"
}
payload = {
    "eventType": "${sandboxEventType}",
    "source": "${sandboxSource}",
    "payload": {"region": "us-east-1", "action": "checkout_session_created", "latencyMs": 18}
}

response = requests.post(url, json=payload, headers=headers)
print("Ingest ACK:", response.json())`,
    go: `package main

import (
    "bytes"
    "fmt"
    "net/http"
)

func main() {
    url := "http://localhost:5000/api/v1/ingest"
    payload := []byte(\`{"eventType":"${sandboxEventType}","source":"${sandboxSource}","payload":{"region":"us-east-1","latencyMs":18}}\`)
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(payload))
    req.Header.Set("Authorization", "Bearer ${sandboxApiKey}")
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()
    fmt.Println("Status Code:", resp.StatusCode)
}`,
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(codeSnippets[codeLang]);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  // API Playground execute simulation
  const handleRunSandbox = () => {
    setSandboxLoading(true);
    setTimeout(() => {
      setSandboxResponse({
        status: 201,
        statusText: "Created",
        ack: {
          eventId: `evt_ack_${Math.random().toString(36).substring(2, 9)}`,
          eventType: sandboxEventType,
          source: sandboxSource,
          recordedAt: new Date().toISOString(),
          latencyMs: 17.4,
          cluster: "us-east-1a-prod",
          quotaBalanceRemaining: 249820,
        },
      });
      setSandboxLoading(false);
    }, 450);
  };

  // ROI / Plan recommendation logic
  const recommendedPlan = useMemo(() => {
    if (calculatorRequests <= 50000) {
      return {
        name: "Growth Starter",
        price: billingCycle === "annual" ? "$23/mo" : "$29/mo",
        maxReq: "50,000 req/mo",
        workspaces: "3 Workspaces",
        seats: "5 Team Members",
        tag: "Best for early-stage prototypes & indie developers",
        color: "#34d399",
      };
    } else if (calculatorRequests <= 250000) {
      return {
        name: "Team Pro",
        price: billingCycle === "annual" ? "$79/mo" : "$99/mo",
        maxReq: "250,000 req/mo",
        workspaces: "10 Workspaces",
        seats: "15 Team Members",
        tag: "Optimal balance of throughput, team seats & 30-day logs",
        color: "#818cf8",
      };
    } else {
      return {
        name: "Scale Business",
        price: billingCycle === "annual" ? "$199/mo" : "$249/mo",
        maxReq: "1,000,000 req/mo",
        workspaces: "25 Workspaces",
        seats: "50 Team Members",
        tag: "Enterprise-grade throughput with 90-day retention & priority support",
        color: "#06b6d4",
      };
    }
  }, [calculatorRequests, billingCycle]);

  const faqs = [
    {
      q: "Can I change my plan or upgrade anytime?",
      a: "Yes. You can upgrade, downgrade, or switch between Monthly and Annual billing at any time directly in your dashboard under Plans & Billing. When upgrading, proration is automatically calculated so you only pay the incremental difference.",
    },
    {
      q: "What happens when my workspace reaches its monthly request limit?",
      a: "PulseFlow provides soft threshold warnings at 80% and 100% of your quota via email and dashboard alerts. Ingestion continues gracefully with a buffer window while alerting owners to review their tier, avoiding sudden pipeline drops.",
    },
    {
      q: "How does billing and cancellation work?",
      a: "All subscriptions are managed with transparent billing. If you decide to cancel, your workspace remains fully active until the conclusion of your current billing period, after which it transitions to our free Developer Starter tier. No surprise cancellation fees.",
    },
    {
      q: "How are API keys and tokens protected?",
      a: "PulseFlow generates high-entropy cryptographic tokens and stores them exclusively using salted SHA-256 / bcrypt hashes. Raw tokens are visible only once during creation. Key rotation and instant revocation are supported across all tiers.",
    },
    {
      q: "Can I invite team members and assign granular roles?",
      a: "Yes. PulseFlow features a complete 4-tier Role-Based Access Control matrix (Owner, Admin, Member, Viewer). Owners and Admins can securely invite colleagues via cryptographically signed invitation tokens with customizable roles.",
    },
    {
      q: "Is there a free trial or no-cost tier?",
      a: "Yes! You can start immediately with our 14-day free trial on the Team Pro plan, or use our permanent Developer Free tier with 10,000 requests/month, zero credit card required.",
    },
    {
      q: "What are the data retention windows across plan tiers?",
      a: "Data retention scales with your plan: Growth Starter retains event telemetry and granular query logs for 7 days, Team Pro provides 30 days of rolling retention, and Scale Business includes 90 days. For custom multi-year cold storage archives (S3 / GCS export), our Enterprise tier provides automated bucket streaming.",
    },
    {
      q: "What uptime SLA guarantees does PulseFlow provide?",
      a: "PulseFlow guarantees a 99.9% uptime SLA for Scale Business workspaces and a 99.99% uptime SLA for custom Enterprise deployments, backed by financially backed service credits. Ingestion edge proxies operate across redundant multi-region Anycast clusters to ensure sub-20ms packet intake even during regional cloud outages.",
    },
    {
      q: "What is your security and compliance roadmap?",
      a: "All customer telemetry is protected with strict multi-tenant database isolation, AES-256 data encryption at rest, and TLS 1.3 in transit. We are currently undergoing SOC 2 Type II compliance audit readiness and maintain strict GDPR compliance with zero third-party telemetry leakage. ISO 27001 certification is slated on our Q4 roadmap.",
    },
  ];

  // Motion animation presets - match SSR statically until mounted
  const fadeInSlideUp: Variants = {
    hidden: { opacity: shouldReduceMotion || !isMounted ? 1 : 0, y: shouldReduceMotion || !isMounted ? 0 : 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" as const },
    },
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* Subtle Animated Grid & Radial Glow Background */}
      <div className="animated-grid-bg" />
      <div className="hero-radial-glow" />

      {/* Navigation Header */}
      <header
        role="banner"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          backgroundColor: isDarkMode ? "rgba(7, 9, 14, 0.85)" : "rgba(255, 255, 255, 0.85)",
          borderBottom: "1px solid var(--border-subtle)",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        <div className="pulseflow-navbar-container">
          {/* Logo */}
          <Link
            href="/"
            className="pulseflow-brand"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Nexora Home"
          >
            <NexoraLogo size="md" variant="full" theme={isDarkMode ? "dark" : "light"} />
          </Link>

          {/* Desktop Nav links with Active-Section Highlight on Scroll */}
          <nav
            className="pulseflow-desktop-nav"
            aria-label="Main Navigation"
          >
            {[
              { id: "features", label: "Features" },
              { id: "solutions", label: "Solutions" },
              { id: "integrations", label: "Integrations" },
              { id: "pricing", label: "Pricing" },
              { id: "demo", label: "Live Demo" },
              { id: "docs", label: "Docs", externalHref: "https://github.com" },
            ].map((link) => {
              const isActive = activeSection === link.id;
              if (link.externalHref) {
                return (
                  <a
                    key={link.id}
                    href={link.externalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pulseflow-nav-item"
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className={`pulseflow-nav-item ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                  {isActive && <span className="pulseflow-nav-indicator" />}
                </a>
              );
            })}
          </nav>

          {/* Action buttons & Light/Dark Mode Toggle */}
          <div className="pulseflow-nav-controls">
            {/* Real/Demo Status Badge */}
            <Link
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="pulseflow-status-pill"
              title={
                systemHealth.isLive
                  ? `Live Engine: ${systemHealth.status} (${systemHealth.uptime})`
                  : `Demo Engine: ${systemHealth.status} (${systemHealth.uptime})`
              }
            >
              <span className="pulseflow-status-dot" />
              <span>
                {systemHealth.isLive ? "All Systems Normal" : "Systems Normal (Demo)"}
              </span>
            </Link>

            {/* Dark / Light Mode Toggle Button */}
            <button
              id="theme-toggle-btn"
              className="pulseflow-theme-btn"
              onClick={toggleTheme}
              title={isDarkMode ? "Switch to Arctic Blue (Light Theme)" : "Switch to Midnight Indigo (Dark Theme)"}
              aria-label={isDarkMode ? "Switch to Arctic Blue (Light Theme)" : "Switch to Midnight Indigo (Dark Theme)"}
            >
              {isDarkMode ? (
                <Sun size={17} color="#f59e0b" style={{ filter: "drop-shadow(0 0 6px rgba(245, 158, 11, 0.5))" }} />
              ) : (
                <Moon size={16} color="#7c3aed" style={{ filter: "drop-shadow(0 0 6px rgba(124, 58, 237, 0.4))" }} />
              )}
            </button>

            {/* Desktop Auth CTAs */}
            <div className="pulseflow-desktop-auth" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Link href="/login" className="pulseflow-btn-ghost">
                Sign In
              </Link>
              <Link href="/register" className="pulseflow-btn-primary">
                Get Started <ArrowRight size={14} />
              </Link>
            </div>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              id="mobile-menu-toggle"
              className="pulseflow-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Slide-in Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              id="mobile-navigation-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile Navigation Menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="pulseflow-mobile-drawer"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {[
                  { id: "features", label: "Features" },
                  { id: "solutions", label: "Solutions" },
                  { id: "integrations", label: "Integrations" },
                  { id: "pricing", label: "Pricing" },
                  { id: "demo", label: "Live Demo" },
                  { id: "faq", label: "FAQ" },
                ].map((link) => {
                  const isActive = activeSection === link.id;
                  return (
                    <a
                      key={link.id}
                      href={`#${link.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`pulseflow-mobile-nav-link ${isActive ? "active" : ""}`}
                    >
                      <span>{link.label}</span>
                      {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8" }} />}
                    </a>
                  );
                })}
              </div>

              {/* Status widget in mobile drawer */}
              <div style={{ padding: "8px 0" }}>
                <Link
                  href="/api/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pulseflow-status-pill"
                  style={{ display: "inline-flex", width: "fit-content" }}
                >
                  <span className="pulseflow-status-dot" />
                  <span>
                    {systemHealth.isLive ? "All Systems Normal" : "Systems Normal (Demo)"}
                  </span>
                </Link>
              </div>

              {/* Mobile Auth CTAs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--border-subtle)" }}>
                <Link
                  href="/login"
                  className="pulseflow-btn-ghost"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ width: "100%", justifyContent: "center", border: "1px solid var(--border-medium)" }}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="pulseflow-btn-primary"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Get Started <ArrowRight size={14} />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section style={{ paddingTop: "96px", paddingBottom: "72px", position: "relative", zIndex: 10 }}>
        <div className="container-1200" style={{ textAlign: "center" }}>
          {/* Badge */}
          <motion.div
            initial={false}
            animate="visible"
            variants={fadeInSlideUp}
            style={{ display: "inline-flex", marginBottom: "24px" }}
          >
            <Badge variant="indigo">
              <Sparkles size={14} color="#818cf8" />
              Nexora Observability Engine • Build smarter. Scale further.
            </Badge>
          </motion.div>

          {/* Balanced Main Headline (2 Balanced Lines) */}
          <motion.h1
            initial={false}
            animate="visible"
            variants={fadeInSlideUp}
            className="text-balance"
            style={{
              fontSize: "clamp(36px, 5.5vw, 66px)",
              lineHeight: 1.12,
              maxWidth: "960px",
              margin: "0 auto 20px",
              fontWeight: 800,
              letterSpacing: "-0.035em",
            }}
          >
            Real-Time API Observability & Telemetry.{" "}
            <br />
            <span className="gradient-text">Built for Engineering Teams.</span>
          </motion.h1>

          {/* Subtitle with WCAG AA High-Contrast Secondary Text */}
          <motion.p
            initial={false}
            animate="visible"
            variants={fadeInSlideUp}
            style={{
              fontSize: "clamp(16px, 1.8vw, 19px)",
              color: "var(--text-secondary)",
              maxWidth: "740px",
              margin: "0 auto 34px",
              lineHeight: 1.6,
            }}
          >
            Sub-20ms edge telemetry ingestion, real-time p95 latency tracking, cryptographic token rotation, and zero-trust multi-tenant governance — engineered for high-throughput cloud microservices.
          </motion.p>

          {/* Action CTAs: Primary Gradient with Hover Glow, Secondary Ghost */}
          <motion.div
            initial={false}
            animate="visible"
            variants={fadeInSlideUp}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              flexWrap: "wrap",
              marginBottom: "20px",
            }}
          >
            <Link
              id="hero-cta-primary"
              href="/register"
              onClick={() => trackEvent("hero_cta_primary_clicked", "CTA", { text: "Start Free Trial" }, "TRIAL_CTA_CLICK")}
              className="btn btn-primary btn-lg"
              style={{
                padding: "14px 30px",
                fontSize: "15px",
                fontWeight: 700,
                boxShadow: "0 4px 25px rgba(99, 102, 241, 0.45)",
              }}
            >
              Start Free Trial <ArrowRight size={18} />
            </Link>
            <a
              id="hero-cta-secondary"
              href="#demo"
              onClick={(e) => {
                trackEvent("hero_cta_secondary_clicked", "CTA", { text: "Explore Live Demo" }, "TRIAL_CTA_CLICK");
                setActiveTab("telemetry");
              }}
              className="btn btn-ghost btn-lg"
              style={{
                padding: "14px 28px",
                fontSize: "15px",
                fontWeight: 600,
                border: "1px solid var(--border-medium)",
                background: "rgba(255, 255, 255, 0.04)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Play size={16} color="#38bdf8" /> Explore Live Demo
            </a>
          </motion.div>

          {/* Genuine Trust Message */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--text-muted)", marginBottom: "40px" }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>No credit card required • 14-day full feature trial • Instant automated provisioning</span>
          </div>

          {/* Meaningful Product Preview Directly Below Hero */}
          <motion.div
            initial={false}
            animate="visible"
            variants={fadeInSlideUp}
            style={{
              maxWidth: "1100px",
              margin: "0 auto 54px",
              borderRadius: "16px",
              padding: "2px",
              background: isDarkMode
                ? "linear-gradient(135deg, rgba(6, 182, 212, 0.35) 0%, rgba(99, 102, 241, 0.35) 50%, rgba(139, 92, 246, 0.2) 100%)"
                : "linear-gradient(135deg, rgba(79, 70, 229, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%)",
              boxShadow: isDarkMode
                ? "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.2)"
                : "0 20px 40px -10px rgba(17, 24, 39, 0.08), 0 0 20px rgba(79, 70, 229, 0.1)",
            }}
          >
            <div
              style={{
                borderRadius: "14px",
                background: isDarkMode ? "rgba(10, 13, 22, 0.96)" : "#FFFFFF",
                backdropFilter: "blur(20px)",
                overflow: "hidden",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {/* Product Preview Window Top Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderBottom: "1px solid var(--border-subtle)",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
                  <span style={{ marginLeft: "10px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    app.pulseflow.io // production-telemetry-overview
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#10b981", fontWeight: 600 }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                    Live Cluster Stream (Active)
                  </span>
                  <span style={{ color: "var(--border-medium)" }}>|</span>
                  <span style={{ color: "#38bdf8", fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>
                    Org: Acme Enterprise
                  </span>
                </div>
              </div>

              {/* Product Preview Body: Grid with Real-Time KPIs, Mini Latency Chart, Event Stream, and Quota Bar */}
              <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px", textAlign: "left" }}>
                {/* Metric Box 1 */}
                <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>p95 Global Latency</span>
                    <Badge variant="cyan" style={{ fontSize: "10px", padding: "1px 6px" }}>Sub-20ms</Badge>
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)" }}>18.4 <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-muted)" }}>ms</span></div>
                  <div style={{ fontSize: "11.5px", color: "#10b981", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>↓ 2.1ms from peak</span> • Across 4 cloud regions
                  </div>
                </div>

                {/* Metric Box 2 */}
                <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Requests Today</span>
                    <Badge variant="indigo" style={{ fontSize: "10px", padding: "1px 6px" }}>Real-time</Badge>
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)" }}>1.42M <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-muted)" }}>events</span></div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                    100% tenant isolated via SHA-256 tokens
                  </div>
                </div>

                {/* Metric Box 3: Monthly Quota Gauge */}
                <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Monthly Quota Usage</span>
                    <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700 }}>28.5%</span>
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)" }}>285k / 1.0M</div>
                  {/* Progress Bar */}
                  <div style={{ width: "100%", height: "6px", borderRadius: "3px", background: "rgba(255, 255, 255, 0.08)", marginTop: "8px", overflow: "hidden" }}>
                    <div style={{ width: "28.5%", height: "100%", background: "var(--accent-gradient)", borderRadius: "3px" }} />
                  </div>
                </div>

                {/* Metric Box 4: Verified Uptime */}
                <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Edge Uptime (30d)</span>
                    <Badge variant="emerald" style={{ fontSize: "10px", padding: "1px 6px" }}>Operational</Badge>
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: "#10b981" }}>99.99%</div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                    0 packet loss on edge proxies
                  </div>
                </div>
              </div>

              {/* Live Event Stream Snippet Preview */}
              <div
                style={{
                  margin: "0 24px 24px",
                  padding: "16px 20px",
                  borderRadius: "10px",
                  background: isDarkMode ? "rgba(0, 0, 0, 0.5)" : "#F5F7FC",
                  border: "1px solid var(--border-subtle)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: "8px" }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>LIVE INGESTION STREAM (LAST 3 EVENTS)</span>
                  <span style={{ color: "#f59e0b", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>[Demo Telemetry Sample]</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ color: "#34d399" }}>POST /api/v1/ingest</span>
                    <span style={{ color: "var(--text-muted)" }}>src: payment-gateway-sea</span>
                    <span style={{ color: "#38bdf8" }}>region: us-west-2</span>
                    <span style={{ color: "var(--text-primary)" }}>lat: 18ms</span>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>200 OK</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ color: "#34d399" }}>POST /api/v1/ingest</span>
                    <span style={{ color: "var(--text-muted)" }}>src: auth-cluster-iad</span>
                    <span style={{ color: "#38bdf8" }}>region: us-east-1</span>
                    <span style={{ color: "var(--text-primary)" }}>lat: 24ms</span>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>200 OK</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ color: "#34d399" }}>POST /api/v1/ingest</span>
                    <span style={{ color: "var(--text-muted)" }}>src: telemetry-worker-fra</span>
                    <span style={{ color: "#38bdf8" }}>region: eu-central-1</span>
                    <span style={{ color: "var(--text-primary)" }}>lat: 19ms</span>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>200 OK</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Enterprise Compliance Badges Trust Bar - Labelled Honestly as In Progress / Roadmap */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "48px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "20px",
                background: "rgba(6, 182, 212, 0.08)",
                border: "1px solid rgba(6, 182, 212, 0.25)",
                fontSize: "12.5px",
                color: "#e2e8f0",
              }}
            >
              <ShieldCheck size={16} color="#06b6d4" />
              <span>SOC 2 Type II</span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: "rgba(245, 158, 11, 0.2)",
                  color: "#f59e0b",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                }}
              >
                In Progress
              </span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "20px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                fontSize: "12.5px",
                color: "#e2e8f0",
              }}
            >
              <Lock size={15} color="#10b981" />
              <span>GDPR Architecture</span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                }}
              >
                Tenant Isolated
              </span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "20px",
                background: "rgba(99, 102, 241, 0.08)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                fontSize: "12.5px",
                color: "#e2e8f0",
              }}
            >
              <CheckCircle size={15} color="#818cf8" />
              <span>ISO 27001</span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: "rgba(129, 140, 248, 0.2)",
                  color: "#818cf8",
                  border: "1px solid rgba(129, 140, 248, 0.35)",
                }}
              >
                Roadmap
              </span>
            </div>
          </div>

          {/* 4 Equal-Height Premium Feature Cards */}
          <div
            id="features"
            className="capabilities-grid-container"
            style={{
              maxWidth: "1140px",
              margin: "0 auto",
            }}
          >
            {/* Card 1: Edge Ingestion */}
            <div className="nexora-feature-card">
              <div className="nexora-feature-icon-wrapper">
                <Gauge size={20} strokeWidth={2.2} />
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                  lineHeight: 1.3,
                  margin: "0 0 10px 0",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Edge Ingestion
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                  margin: 0,
                  maxWidth: "240px",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Process incoming events through a fast, scalable ingestion pipeline.
              </p>
            </div>

            {/* Card 2: Scoped API Keys */}
            <div className="nexora-feature-card">
              <div className="nexora-feature-icon-wrapper">
                <Key size={20} strokeWidth={2.2} />
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                  lineHeight: 1.3,
                  margin: "0 0 10px 0",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Scoped API Keys
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                  margin: 0,
                  maxWidth: "240px",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Manage API access with scoped permissions, secure token hashing, and revocation.
              </p>
            </div>

            {/* Card 3: Access Governance */}
            <div className="nexora-feature-card">
              <div className="nexora-feature-icon-wrapper">
                <Users size={20} strokeWidth={2.2} />
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                  lineHeight: 1.3,
                  margin: "0 0 10px 0",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Access Governance
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                  margin: 0,
                  maxWidth: "240px",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Control workspace access with Owner, Admin, Member, and Viewer roles.
              </p>
            </div>

            {/* Card 4: Signed Webhooks */}
            <div className="nexora-feature-card">
              <div className="nexora-feature-icon-wrapper">
                <Fingerprint size={20} strokeWidth={2.2} />
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                  lineHeight: 1.3,
                  margin: "0 0 10px 0",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Signed Webhooks
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                  margin: 0,
                  maxWidth: "240px",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Verify webhook integrity with HMAC signatures and reliable delivery handling.
              </p>
            </div>
          </div>

          {/* Section Directly Below Feature Cards: Built for Modern Engineering Teams */}
          <div
            style={{
              marginTop: "56px",
              padding: "44px 32px",
              borderTop: "1px solid var(--border-subtle)",
              borderBottom: "1px solid var(--border-subtle)",
              background: isDarkMode ? "rgba(255, 255, 255, 0.015)" : "#FFFFFF",
              borderRadius: "16px",
              boxShadow: isDarkMode ? "none" : "0 1px 3px rgba(17, 24, 39, 0.05)",
              textAlign: "center",
            }}
          >
            <div style={{ maxWidth: "680px", margin: "0 auto 28px" }}>
              <h2
                style={{
                  fontSize: "clamp(22px, 2.5vw, 28px)",
                  fontWeight: 800,
                  letterSpacing: "-0.025em",
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                Built for Modern Engineering Teams
              </h2>
              <p
                style={{
                  fontSize: "14.5px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                Reliable tools for building, securing, and scaling modern applications.
              </p>
            </div>

            {/* Premium, minimal row of verified platform capabilities */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "14px",
                maxWidth: "1140px",
                margin: "0 auto",
              }}
            >
              {[
                {
                  name: "API Security",
                  description: "Scoped token access & rate limiting",
                  icon: ShieldCheck,
                },
                {
                  name: "Access Control",
                  description: "Multi-tenant 4-tier team RBAC",
                  icon: Lock,
                },
                {
                  name: "Event Processing",
                  description: "High-throughput edge ingestion",
                  icon: Activity,
                },
                {
                  name: "Webhook Management",
                  description: "HMAC signed payload dispatching",
                  icon: Zap,
                },
                {
                  name: "Team Collaboration",
                  description: "Isolated org & workspace clusters",
                  icon: Users,
                },
              ].map((cap, i) => {
                const IconComponent = cap.icon;
                return (
                  <div
                    key={i}
                    className="nexora-capability-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "16px 18px",
                      borderRadius: "12px",
                      background: isDarkMode ? "rgba(23, 30, 50, 0.6)" : "#F9FAFB",
                      border: "1px solid var(--border-medium)",
                      textAlign: "left",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      cursor: "default",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: isDarkMode ? "rgba(255, 255, 255, 0.06)" : "#EEF2FF",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "12px",
                        color: isDarkMode ? "var(--text-primary)" : "var(--accent-primary)",
                      }}
                    >
                      <IconComponent size={16} strokeWidth={2.2} />
                    </div>
                    <div
                      style={{
                        fontSize: "13.5px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        letterSpacing: "-0.01em",
                        marginBottom: "3px",
                      }}
                    >
                      {cap.name}
                    </div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        color: "var(--text-muted)",
                        lineHeight: 1.45,
                      }}
                    >
                      {cap.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Production Deployment Patterns & Architecture Capabilities */}
      <section
        style={{
          padding: "54px 0",
          background: "rgba(255, 255, 255, 0.01)",
          borderBottom: "1px solid var(--border-subtle)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#22D3EE",
                padding: "3px 12px",
                borderRadius: "20px",
                background: "rgba(34, 211, 238, 0.12)",
                border: "1px solid rgba(34, 211, 238, 0.3)",
              }}
            >
              Platform Capabilities • Production Architecture Patterns
            </span>
            <h3 style={{ fontSize: "24px", fontWeight: 700, marginTop: "12px", color: "var(--text-primary)" }}>
              Engineered for High-Reliability Cloud Services
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
              maxWidth: "1050px",
              margin: "0 auto",
            }}
          >
            {[
              {
                pattern: "Distributed API Gateways",
                metric: "Sub-20ms Routing Overhead",
                summary:
                  "Non-blocking telemetry emission via lightweight HTTP POST payloads ensures zero latency degradation on edge proxies and microservices.",
              },
              {
                pattern: "Zero-Trust Secret Governance",
                metric: "Cryptographic SHA-256 Hashes",
                summary:
                  "Raw tokens are never persisted. Automatic dual-key overlap windows enable 100% zero-downtime key rotation and instant revocation.",
              },
              {
                pattern: "Row-Level Multi-Tenant Isolation",
                metric: "Prisma Scoped WAL Partitioning",
                summary:
                  "Granular organization and workspace scoping guarantees airtight boundary separation across analytical metrics, audit trails, and member rosters.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="nexora-feature-card"
                style={{
                  padding: "24px",
                  alignItems: "flex-start",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "11.5px", color: "#22D3EE", fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase" }}>
                  {item.metric}
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginTop: "6px", marginBottom: "10px" }}>
                  {item.pattern}
                </div>
                <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  {item.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION: Features Bento Grid */}
      <section id="features" className="section-py" style={{ position: "relative", zIndex: 10 }}>
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <Badge variant="indigo" style={{ marginBottom: "12px" }}>
              <Layers size={13} /> Architecture & Capabilities
            </Badge>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "14px" }}>
              Engineered for Scale. <span className="gradient-text">Zero Compromises.</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "620px", margin: "0 auto", fontSize: "15px", lineHeight: 1.6 }}>
              A purpose-built telemetry foundation combining real-time edge streaming, cryptographic security, multi-tenant isolation, and developer-first simplicity.
            </p>
          </div>

          {/* Bento Grid with Mixed Sizes */}
          <div className="bento-grid">
            {/* Bento Card 1: 8 Cols - Sub-20ms Edge Ingestion Engine */}
            <div className="bento-card bento-col-8">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(99, 102, 241, 0.2))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(6, 182, 212, 0.3)",
                  }}
                >
                  <Gauge size={24} color="#06b6d4" />
                </div>
                <span className="badge badge-cyan" style={{ fontSize: "11px" }}>
                  Global Mesh
                </span>
              </div>
              <h3 style={{ fontSize: "21px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                Ultra-Low Latency Global Ingestion
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                Distribute incoming API telemetry across Anycast edge nodes in North America, Europe, and Asia-Pacific with guaranteed sub-20ms acknowledgment.
              </p>
              {/* Micro Visual */}
              <div
                style={{
                  marginTop: "auto",
                  padding: "14px 18px",
                  borderRadius: "8px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="pulsing-dot" />
                  <span style={{ color: "var(--text-primary)" }}>Anycast Edge Mesh: ACTIVE</span>
                </div>
                <span className="tabular-nums" style={{ color: "#34d399", fontWeight: 700 }}>
                  p95 18.4ms
                </span>
              </div>
            </div>

            {/* Bento Card 2: 4 Cols - Cryptographic API Tokens */}
            <div className="bento-card bento-col-4">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <Key size={24} color="#10b981" />
                </div>
                <span className="badge badge-emerald" style={{ fontSize: "11px" }}>
                  SHA-256
                </span>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                Cryptographic API Keys
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", lineHeight: 1.5, marginBottom: "16px" }}>
                Generate scoped tokens hashed with SHA-256 with instant rotation and zero downtime revocation.
              </p>
              <div style={{ marginTop: "auto", fontFamily: "var(--font-mono)", fontSize: "11px", color: "#34d399" }}>
                pfl_live_••••••••••••8892
              </div>
            </div>

            {/* Bento Card 3: 4 Cols - 4-Tier RBAC Governance */}
            <div className="bento-card bento-col-4">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                  }}
                >
                  <Users size={24} color="#818cf8" />
                </div>
                <span className="badge badge-indigo" style={{ fontSize: "11px" }}>
                  Zero-Trust
                </span>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                Granular 4-Tier RBAC
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", lineHeight: 1.5 }}>
                Enforce hierarchical permissions across Owner, Admin, Member, and Viewer with privilege escalation prevention.
              </p>
              <div style={{ marginTop: "auto", display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: "12px" }}>
                <span className="badge badge-indigo" style={{ fontSize: "10px" }}>OWNER</span>
                <span className="badge badge-cyan" style={{ fontSize: "10px" }}>ADMIN</span>
                <span className="badge badge-neutral" style={{ fontSize: "10px" }}>MEMBER</span>
              </div>
            </div>

            {/* Bento Card 4: 8 Cols - Automated Webhook Signatures & Delivery */}
            <div className="bento-card bento-col-8">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                >
                  <Fingerprint size={24} color="#38bdf8" />
                </div>
                <span className="badge badge-cyan" style={{ fontSize: "11px" }}>
                  HMAC-SHA256
                </span>
              </div>
              <h3 style={{ fontSize: "21px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                Tamper-Proof Signed Webhooks & Event Retries
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "18px" }}>
                Stream event alerts directly into your microservices with HMAC cryptographic signatures, exponential backoff retries, and comprehensive SSRF defense.
              </p>
              <div
                style={{
                  marginTop: "auto",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                <span>X-PulseFlow-Signature: t=1730000000,v1=9c4a8f...</span>
                <span style={{ color: "#34d399", fontWeight: 600 }}>VERIFIED</span>
              </div>
            </div>

            {/* Bento Card 5: 6 Cols - Strict Tenant Isolation */}
            <div className="bento-card bento-col-6">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(126, 34, 206, 0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                  }}
                >
                  <Lock size={24} color="#a855f7" />
                </div>
                <span className="badge badge-indigo" style={{ fontSize: "11px" }}>
                  Tenant Isolation
                </span>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                Complete Multi-Tenant Segregation
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", lineHeight: 1.5 }}>
                Row-level database scoping and workspace isolation guarantee that unauthorized cross-organization queries return strict 403 Forbidden.
              </p>
            </div>

            {/* Bento Card 6: 6 Cols - Automated Metering & Quotas */}
            <div className="bento-card bento-col-6">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                  }}
                >
                  <Zap size={24} color="#f59e0b" />
                </div>
                <span className="badge badge-warning" style={{ fontSize: "11px" }}>
                  Usage Metering
                </span>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                Automated Metering & Rate Limiting
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", lineHeight: 1.5 }}>
                Enforce precise per-minute token buckets and track usage quotas in real-time with automated threshold alerts before limits are hit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: Solutions (Enterprise, FinTech, Multi-Tenant SaaS) */}
      <section id="solutions" className="section-py" style={{ background: "rgba(255, 255, 255, 0.015)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", position: "relative", zIndex: 10 }}>
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <Badge variant="indigo" style={{ marginBottom: "12px" }}>
              <ShieldCheck size={13} /> Purpose-Built Solutions
            </Badge>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "14px" }}>
              Tailored Telemetry for <span className="gradient-text">Modern Systems</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "620px", margin: "0 auto", fontSize: "15px", lineHeight: 1.6 }}>
              From fast-growing SaaS startups to high-throughput financial microservices, PulseFlow adapts to your governance and traffic requirements.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {/* Solution 1 */}
            <div className="bento-card" style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(6, 182, 212, 0.15)", border: "1px solid rgba(6, 182, 212, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
                <Globe2 size={24} color="#06b6d4" />
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "10px", color: "var(--text-primary)" }}>
                Multi-Tenant B2B SaaS
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                Segregate telemetry streams per customer organization. Enforce tiered rate limits, automated billing quotas, and transparent audit logging.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "var(--text-secondary)" }}>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> Strict row-level workspace data boundaries
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> Real-time usage metering & plan overages
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> 4-tier RBAC for team organizations
                </li>
              </ul>
              <div style={{ marginTop: "auto" }}>
                <Link href="/register" className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Explore SaaS Architecture <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Solution 2 */}
            <div className="bento-card" style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
                <Key size={24} color="#818cf8" />
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "10px", color: "var(--text-primary)" }}>
                High-Security Edge Gateways
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                Protect API keys with CIDR IP whitelisting, zero-downtime secret rotations, and automated PII and token scrubbing before storage.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "var(--text-secondary)" }}>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> Automatic bearer and secret scrubbing
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> Dual-token zero-downtime rotation
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> IP restriction CIDR guardrails
                </li>
              </ul>
              <div style={{ marginTop: "auto" }}>
                <Link href="/register" className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Explore Gateway Security <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Solution 3 */}
            <div className="bento-card" style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
                <Activity size={24} color="#10b981" />
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "10px", color: "var(--text-primary)" }}>
                Distributed Microservices
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                Track service-to-service percentiles (p50, p90, p99), flag latency anomalies exceeding 500ms, and dispatch automated webhooks.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "var(--text-secondary)" }}>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> Sub-20ms edge ingestion acknowledgment
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> HMAC-signed outbound alert webhooks
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={15} color="#10b981" /> Real-time latency percentile tracking
                </li>
              </ul>
              <div style={{ marginTop: "auto" }}>
                <Link href="/register" className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Explore Microservice Mesh <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: Integrations Ecosystem */}
      <section id="integrations" className="section-py" style={{ position: "relative", zIndex: 10 }}>
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <Badge variant="cyan" style={{ marginBottom: "12px" }}>
              <Radio size={13} /> Ecosystem & Integrations
            </Badge>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "14px" }}>
              Plugs Seamlessly Into <span className="gradient-text">Your Tech Stack</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "620px", margin: "0 auto", fontSize: "15px", lineHeight: 1.6 }}>
              Built with open protocols and lightweight SDKs for Next.js, Node.js, Go, Python, and cloud edge workers.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
            {[
              {
                title: "Next.js & React 19",
                category: "Fullstack Framework",
                desc: "Sub-millisecond middleware tracing with native Edge Runtime support.",
                tag: "v15.1 Compatible",
                color: "#60a5fa",
              },
              {
                title: "Prisma ORM & SQLite/Postgres",
                category: "Database & Storage",
                desc: "Zero-latency connection pool monitoring, WAL journaling, and automated drills.",
                tag: "v6.3 Compatible",
                color: "#818cf8",
              },
              {
                title: "Firebase & Firestore",
                category: "Cloud Backend",
                desc: "Dual-mode token verification, security rules, and real-time document synchronization.",
                tag: "14 Collections",
                color: "#f59e0b",
              },
              {
                title: "HTTP & Webhooks Engine",
                category: "Delivery Bus",
                desc: "HMAC-SHA256 signature verification with exponential backoff retries.",
                tag: "Outbound Ready",
                color: "#10b981",
              },
            ].map((intg, i) => (
              <div
                key={i}
                className="bento-card"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.2s ease, border-color 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                    {intg.category}
                  </span>
                  <Badge variant="indigo" style={{ fontSize: "10px", padding: "1px 6px" }}>
                    {intg.tag}
                  </Badge>
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                  {intg.title}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.5, marginBottom: "18px" }}>
                  {intg.desc}
                </p>
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: intg.color, fontWeight: 600 }}>
                  <span>Verified Integration</span>
                  <Check size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION: How It Works (3 Steps with Interactive Code Tabs) */}
      <section id="how-it-works" className="section-py" style={{ background: "rgba(255, 255, 255, 0.01)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", position: "relative", zIndex: 10 }}>
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <Badge variant="cyan" style={{ marginBottom: "12px" }}>
              <Terminal size={13} /> Developer Quickstart
            </Badge>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "14px" }}>
              Up and Running in <span className="gradient-text">Three Simple Steps</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "580px", margin: "0 auto", fontSize: "15px", lineHeight: 1.6 }}>
              Integrate PulseFlow into your microservices or API gateway in less than 5 minutes with our universal client library.
            </p>
          </div>

          {/* 3 Step Selector Buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px",
              maxWidth: "1000px",
              margin: "0 auto 32px",
            }}
          >
            {[
              {
                step: 1 as const,
                title: "1. Install SDK",
                subtitle: "Add the PulseFlow package or call our REST endpoint directly.",
                icon: <Server size={20} color={howItWorksStep === 1 ? "#818cf8" : "var(--text-muted)"} />,
              },
              {
                step: 2 as const,
                title: "2. Send Events",
                subtitle: "Emit structured telemetry payloads with scoped Bearer tokens.",
                icon: <Zap size={20} color={howItWorksStep === 2 ? "#06b6d4" : "var(--text-muted)"} />,
              },
              {
                step: 3 as const,
                title: "3. Get Insights",
                subtitle: "View real-time p95 charts, stream logs, and audit records.",
                icon: <BarChart3 size={20} color={howItWorksStep === 3 ? "#10b981" : "var(--text-muted)"} />,
              },
            ].map((s) => {
              const active = howItWorksStep === s.step;
              return (
                <div
                  key={s.step}
                  onClick={() => setHowItWorksStep(s.step)}
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: active ? "rgba(99, 102, 241, 0.12)" : "rgba(255, 255, 255, 0.02)",
                    border: active ? "1px solid #818cf8" : "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                  onMouseOver={(e) => {
                    if (!active) e.currentTarget.style.borderColor = "var(--border-medium)";
                  }}
                  onMouseOut={(e) => {
                    if (!active) e.currentTarget.style.borderColor = "var(--border-subtle)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: active ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {s.icon}
                    </div>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: active ? "#ffffff" : "var(--text-secondary)" }}>
                      {s.title}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                    {s.subtitle}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Interactive Code Container for Selected Step */}
          <div
            className="glass-card"
            style={{
              maxWidth: "1000px",
              margin: "0 auto",
              padding: "24px",
              borderRadius: "14px",
              border: "1px solid var(--border-medium)",
              boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.6)",
            }}
          >
            {/* Tab Header: Language Selector & Copy Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
                paddingBottom: "14px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                {(["curl", "node", "python", "go"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setHowItWorksLang(lang)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      cursor: "pointer",
                      background: howItWorksLang === lang ? "var(--accent-indigo)" : "rgba(255, 255, 255, 0.04)",
                      color: howItWorksLang === lang ? "#ffffff" : "var(--text-secondary)",
                      border: howItWorksLang === lang ? "1px solid #818cf8" : "1px solid var(--border-subtle)",
                      transition: "all 0.15s",
                    }}
                  >
                    {lang === "curl" ? "cURL" : lang === "node" ? "Node.js" : lang === "python" ? "Python" : "Go"}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  let snippet = "";
                  if (howItWorksStep === 1) {
                    snippet =
                      howItWorksLang === "node"
                        ? "npm install @pulseflow/sdk"
                        : howItWorksLang === "python"
                        ? "pip install pulseflow-sdk"
                        : howItWorksLang === "go"
                        ? "go get github.com/pulseflow/sdk-go"
                        : "# No install needed for cURL\ncurl --version";
                  } else if (howItWorksStep === 2) {
                    snippet =
                      howItWorksLang === "node"
                        ? `import { PulseFlow } from '@pulseflow/sdk';\n\nconst client = new PulseFlow({ apiKey: 'pfl_live_your_api_key' });\nawait client.ingest({\n  eventType: 'api_request',\n  source: 'payment-microservice',\n  payload: { region: 'us-east-1', latencyMs: 18, code: 200 }\n});`
                        : howItWorksLang === "python"
                        ? `from pulseflow import PulseFlow\n\nclient = PulseFlow(api_key="pfl_live_your_api_key")\nclient.ingest(\n    event_type="api_request",\n    source="payment-microservice",\n    payload={"region": "us-east-1", "latency_ms": 18, "code": 200}\n)`
                        : howItWorksLang === "go"
                        ? `package main\n\nimport "github.com/pulseflow/sdk-go"\n\nfunc main() {\n    client := pulseflow.NewClient("pfl_live_your_api_key")\n    client.Ingest(pulseflow.Event{\n        EventType: "api_request",\n        Source:    "payment-microservice",\n        Payload:   map[string]any{"region": "us-east-1", "latencyMs": 18, "code": 200},\n    })\n}`
                        : `curl -X POST http://localhost:5000/api/v1/ingest \\\n  -H "Authorization: Bearer pfl_live_your_api_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{"eventType":"api_request","source":"payment-microservice","payload":{"region":"us-east-1","latencyMs":18}}'`;
                  } else {
                    snippet =
                      howItWorksLang === "node"
                        ? `const metrics = await client.getMetrics({ period: '24h' });\nconsole.log('Realtime p95 latency:', metrics.p95, 'ms');\nconsole.log('Active requests:', metrics.totalRequests);`
                        : howItWorksLang === "python"
                        ? `metrics = client.get_metrics(period="24h")\nprint(f"Realtime p95 latency: {metrics['p95']}ms")\nprint(f"Active requests: {metrics['total_requests']}")`
                        : howItWorksLang === "go"
                        ? `metrics, _ := client.GetMetrics("24h")\nfmt.Printf("Realtime p95 latency: %vms\\n", metrics.P95)\nfmt.Printf("Active requests: %v\\n", metrics.TotalRequests)`
                        : `curl http://localhost:5000/api/v1/metrics?period=24h \\\n  -H "Authorization: Bearer pfl_live_your_api_key"`;
                  }
                  navigator.clipboard.writeText(snippet);
                  setHowItWorksCopied(true);
                  setTimeout(() => setHowItWorksCopied(false), 2000);
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {howItWorksCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {howItWorksCopied ? "Copied!" : "Copy Code"}
              </button>
            </div>

            {/* Code Snippet Box */}
            <pre
              style={{
                margin: 0,
                padding: "18px 20px",
                borderRadius: "10px",
                background: "rgba(0, 0, 0, 0.65)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: "#e2e8f0",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                lineHeight: "1.65",
                overflowX: "auto",
              }}
            >
              {howItWorksStep === 1
                ? howItWorksLang === "node"
                  ? `# 1. Install the Node.js SDK via npm or yarn\nnpm install @pulseflow/sdk`
                  : howItWorksLang === "python"
                  ? `# 1. Install the Python SDK via pip\npip install pulseflow-sdk`
                  : howItWorksLang === "go"
                  ? `// 1. Get the Go SDK package\ngo get github.com/pulseflow/sdk-go`
                  : `# No client install needed for raw HTTP cURL calls\ncurl --version`
                : howItWorksStep === 2
                ? howItWorksLang === "node"
                  ? `import { PulseFlow } from '@pulseflow/sdk';\n\nconst client = new PulseFlow({ apiKey: 'pfl_live_your_api_key' });\n\n// Ingest event with sub-millisecond edge queue\nawait client.ingest({\n  eventType: 'api_request',\n  source: 'payment-microservice',\n  payload: {\n    region: 'us-east-1',\n    action: 'checkout_session_created',\n    latencyMs: 18,\n    code: 200\n  }\n});`
                  : howItWorksLang === "python"
                  ? `from pulseflow import PulseFlow\n\nclient = PulseFlow(api_key="pfl_live_your_api_key")\n\n# Ingest event with sub-millisecond edge queue\nclient.ingest(\n    event_type="api_request",\n    source="payment-microservice",\n    payload={\n        "region": "us-east-1",\n        "action": "checkout_session_created",\n        "latency_ms": 18,\n        "code": 200\n    }\n)`
                  : howItWorksLang === "go"
                  ? `package main\n\nimport "github.com/pulseflow/sdk-go"\n\nfunc main() {\n    client := pulseflow.NewClient("pfl_live_your_api_key")\n\n    // Ingest event with sub-millisecond edge queue\n    client.Ingest(pulseflow.Event{\n        EventType: "api_request",\n        Source:    "payment-microservice",\n        Payload: map[string]any{\n            "region": "us-east-1",\n            "latencyMs": 18,\n            "code": 200,\n        },\n    })\n}`
                  : `curl -X POST http://localhost:5000/api/v1/ingest \\\n  -H "Authorization: Bearer pfl_live_your_api_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "eventType": "api_request",\n    "source": "payment-microservice",\n    "payload": {\n      "region": "us-east-1",\n      "latencyMs": 18,\n      "code": 200\n    }\n  }'`
                : howItWorksLang === "node"
                ? `// 3. Query real-time aggregated metrics & SLA percentiles\nconst metrics = await client.getMetrics({ period: '24h' });\n\nconsole.log('Realtime p95 latency:', metrics.p95, 'ms');\nconsole.log('Total ingested events:', metrics.totalRequests);\nconsole.log('Error rate:', metrics.errorRate, '%');`
                : howItWorksLang === "python"
                ? `# 3. Query real-time aggregated metrics & SLA percentiles\nmetrics = client.get_metrics(period="24h")\n\nprint(f"Realtime p95 latency: {metrics['p95']}ms")\nprint(f"Total ingested events: {metrics['total_requests']}")\nprint(f"Error rate: {metrics['error_rate']}%")`
                : howItWorksLang === "go"
                ? `// 3. Query real-time aggregated metrics & SLA percentiles\nmetrics, err := client.GetMetrics("24h")\nif err == nil {\n    fmt.Printf("Realtime p95 latency: %vms\\n", metrics.P95)\n    fmt.Printf("Total ingested events: %v\\n", metrics.TotalRequests)\n}`
                : `curl http://localhost:5000/api/v1/metrics?period=24h \\\n  -H "Authorization: Bearer pfl_live_your_api_key"`}
            </pre>
          </div>
        </div>
      </section>

      {/* Interactive Platform Live Preview Section */}
      <section id="demo" className="section-py" style={{ position: "relative", zIndex: 10 }}>
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "3px 10px",
                borderRadius: "20px",
                background: "rgba(6, 182, 212, 0.12)",
                color: "#38bdf8",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                marginBottom: "12px",
              }}
            >
              Interactive Developer Playground
            </div>
            <h2 style={{ fontSize: "32px", marginBottom: "10px" }}>
              Experience the <span className="gradient-text">PulseFlow Engine</span> in Action
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "620px", margin: "0 auto", fontSize: "14.5px" }}>
              Explore live stream events, latency percentiles, edge distribution map, interactive code snippets, and our live test sandbox.
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
              border: "1px solid var(--border-medium)",
            }}
          >
            {/* Window title bar with tabs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                background: "rgba(0, 0, 0, 0.5)",
                borderBottom: "1px solid var(--border-subtle)",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  pulseflow.internal // telemetry-cluster-v2
                </span>
                <span
                  style={{
                    fontSize: "10.5px",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#f59e0b",
                    fontWeight: 600,
                  }}
                >
                  SIMULATED DEMO DATA
                </span>
              </div>

              {/* Navigation Tabs */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  id="tab-btn-telemetry"
                  onClick={() => setActiveTab("telemetry")}
                  className={`btn btn-sm ${activeTab === "telemetry" ? "btn-primary" : "btn-ghost"}`}
                >
                  <Activity size={13} /> Live Stream
                </button>
                <button
                  id="tab-btn-chart"
                  onClick={() => setActiveTab("chart")}
                  className={`btn btn-sm ${activeTab === "chart" ? "btn-primary" : "btn-ghost"}`}
                >
                  <BarChart3 size={13} /> Latency Chart
                </button>
                <button
                  id="tab-btn-map"
                  onClick={() => setActiveTab("map")}
                  className={`btn btn-sm ${activeTab === "map" ? "btn-primary" : "btn-ghost"}`}
                >
                  <Globe2 size={13} /> Edge Map
                </button>
                <button
                  id="tab-btn-code"
                  onClick={() => setActiveTab("code")}
                  className={`btn btn-sm ${activeTab === "code" ? "btn-primary" : "btn-ghost"}`}
                >
                  <Terminal size={13} /> Code Snippets
                </button>
                <button
                  id="tab-btn-sandbox"
                  onClick={() => setActiveTab("sandbox")}
                  className={`btn btn-sm ${activeTab === "sandbox" ? "btn-primary" : "btn-ghost"}`}
                >
                  <Play size={13} /> Live Sandbox
                </button>
                <button
                  id="tab-btn-rbac"
                  onClick={() => setActiveTab("rbac")}
                  className={`btn btn-sm ${activeTab === "rbac" ? "btn-primary" : "btn-ghost"}`}
                >
                  <Shield size={13} /> RBAC Matrix
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div style={{ padding: "26px", minHeight: "400px", background: "rgba(10, 13, 20, 0.85)" }}>
              {/* TAB 1: Live Stream with Filters */}
              {activeTab === "telemetry" && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "14px",
                      marginBottom: "16px",
                      padding: "12px 16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Filter size={13} /> Status Code:
                      </span>
                      {(["ALL", "200", "429", "500"] as const).map((code) => (
                        <button
                          key={code}
                          id={`filter-status-${code}`}
                          onClick={() => setStatusFilter(code)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "5px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            border: statusFilter === code ? "1px solid #6366f1" : "1px solid var(--border-subtle)",
                            background: statusFilter === code ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.02)",
                            color: statusFilter === code ? "#fff" : "var(--text-secondary)",
                            transition: "all 0.15s",
                          }}
                        >
                          {code === "ALL" ? "All Codes" : code === "200" ? "200 OK" : code === "429" ? "429 Rate Limit" : "500 Server Error"}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Globe2 size={13} /> Region:
                      </span>
                      <select
                        id="filter-region-select"
                        value={regionFilter}
                        onChange={(e) => setRegionFilter(e.target.value)}
                        style={{
                          background: "#07090e",
                          border: "1px solid var(--border-medium)",
                          color: "#f8fafc",
                          fontSize: "12px",
                          borderRadius: "6px",
                          padding: "5px 10px",
                          cursor: "pointer",
                        }}
                      >
                        <option value="ALL">All Demo Regions</option>
                        <option value="us-east-1">us-east-1 (N. Virginia)</option>
                        <option value="us-west-2">us-west-2 (Oregon)</option>
                        <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                        <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                      </select>
                    </div>
                  </div>

                  {/* Search Input & Stream Controls (Pause / Resume) */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Real-time search filter */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flex: "1 1 260px",
                        maxWidth: "400px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "8px",
                        padding: "6px 12px",
                      }}
                    >
                      <Search size={14} color="var(--text-muted)" />
                      <input
                        id="stream-search-input"
                        type="text"
                        placeholder="Filter by endpoint, source, or region..."
                        value={streamSearch}
                        onChange={(e) => setStreamSearch(e.target.value)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-primary)",
                          fontSize: "12.5px",
                          outline: "none",
                          width: "100%",
                        }}
                      />
                      {streamSearch && (
                        <button
                          onClick={() => setStreamSearch("")}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Pause / Resume button */}
                    <button
                      id="stream-pause-btn"
                      onClick={() => setIsStreamPaused(!isStreamPaused)}
                      className={`btn btn-sm ${isStreamPaused ? "btn-secondary" : "btn-ghost"}`}
                      style={{
                        border: isStreamPaused ? "1px solid #f59e0b" : "1px solid var(--border-medium)",
                        color: isStreamPaused ? "#f59e0b" : "var(--text-secondary)",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {isStreamPaused ? (
                        <>
                          <Play size={13} color="#f59e0b" /> Resume Stream
                        </>
                      ) : (
                        <>
                          <Pause size={13} /> Pause Stream
                        </>
                      )}
                    </button>
                  </div>

                  {/* Sparkline & Live Telemetry Health Bar above stream table */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "14px",
                      marginBottom: "16px",
                      padding: "12px 18px",
                      background: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {/* Pulsing LIVE Indicator Badge */}
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "4px 10px",
                          borderRadius: "20px",
                          background: isStreamPaused ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                          border: isStreamPaused ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)",
                        }}
                      >
                        <span
                          className={isStreamPaused ? "" : "pulsing-dot"}
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: isStreamPaused ? "#f59e0b" : "#10b981",
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            color: isStreamPaused ? "#f59e0b" : "#10b981",
                            textTransform: "uppercase",
                          }}
                        >
                          {isStreamPaused ? "PAUSED" : "LIVE"}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                          Edge Telemetry Ingest Buffer
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {isStreamPaused ? "Stream paused" : `Showing ${demoMetrics.count} filtered simulated events • Fleet Avg: ${demoMetrics.avgLatency}ms`}
                        </span>
                      </div>
                    </div>

                    {/* Small Latency Sparkline */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "10.5px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                          Filtered p50
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#34d399", fontFamily: "var(--font-mono)" }}>
                          p50: {demoMetrics.p50}ms
                        </div>
                      </div>
                      <svg width="86" height="28" viewBox="0 0 86 28" fill="none" style={{ overflow: "visible" }}>
                        <path
                          d="M 2 18 L 14 15 L 26 21 L 38 12 L 50 16 L 62 8 L 74 14 L 84 9"
                          stroke="#10b981"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M 2 18 L 14 15 L 26 21 L 38 12 L 50 16 L 62 8 L 74 14 L 84 9 L 84 28 L 2 28 Z"
                          fill="url(#sparkline-grad)"
                          opacity="0.25"
                        />
                        <circle cx="84" cy="9" r="3" fill="#10b981" />
                        <defs>
                          <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="28" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10b981" />
                            <stop offset="1" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>

                  {/* Search Input, Filters & Simulator Controls */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Real-time search filter */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flex: "1 1 260px",
                        maxWidth: "400px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "8px",
                        padding: "6px 12px",
                      }}
                    >
                      <Search size={14} color="var(--text-muted)" />
                      <input
                        id="stream-search-input"
                        type="text"
                        placeholder="Filter by endpoint, source, or region..."
                        value={streamSearch}
                        onChange={(e) => setStreamSearch(e.target.value)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-primary)",
                          fontSize: "12.5px",
                          outline: "none",
                          width: "100%",
                        }}
                      />
                      {streamSearch && (
                        <button
                          onClick={() => setStreamSearch("")}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {/* Status Code Filter Chips */}
                      {(["ALL", "200", "429", "500"] as const).map((code) => (
                        <button
                          key={code}
                          id={`filter-status-${code}`}
                          onClick={() => setStatusFilter(code)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "5px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            border: statusFilter === code ? "1px solid #6366f1" : "1px solid var(--border-subtle)",
                            background: statusFilter === code ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.02)",
                            color: statusFilter === code ? "#fff" : "var(--text-secondary)",
                            transition: "all 0.15s",
                          }}
                        >
                          {code === "ALL" ? "All" : code === "200" ? "200 OK" : code === "429" ? "429 Rate" : "500 Err"}
                        </button>
                      ))}

                      {/* Region Select */}
                      <select
                        id="filter-region-select"
                        value={regionFilter}
                        onChange={(e) => setRegionFilter(e.target.value)}
                        style={{
                          background: "#07090e",
                          border: "1px solid var(--border-medium)",
                          color: "#f8fafc",
                          fontSize: "12px",
                          borderRadius: "6px",
                          padding: "5px 10px",
                          cursor: "pointer",
                        }}
                      >
                        <option value="ALL">All Regions</option>
                        <option value="us-east-1">us-east-1</option>
                        <option value="us-west-2">us-west-2</option>
                        <option value="eu-central-1">eu-central-1</option>
                        <option value="ap-southeast-1">ap-southeast-1</option>
                      </select>

                      {/* Pause / Resume button */}
                      <button
                        id="stream-pause-btn"
                        onClick={() => setIsStreamPaused(!isStreamPaused)}
                        className={`btn btn-sm ${isStreamPaused ? "btn-secondary" : "btn-ghost"}`}
                        style={{
                          border: isStreamPaused ? "1px solid #f59e0b" : "1px solid var(--border-medium)",
                          color: isStreamPaused ? "#f59e0b" : "var(--text-secondary)",
                          gap: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {isStreamPaused ? (
                          <>
                            <Play size={13} color="#f59e0b" /> Resume
                          </>
                        ) : (
                          <>
                            <Pause size={13} /> Pause
                          </>
                        )}
                      </button>

                      {/* Trigger simulated Skeleton state */}
                      <button
                        onClick={() => {
                          setIsStreamLoading(true);
                          setTimeout(() => setIsStreamLoading(false), 1200);
                        }}
                        className="btn btn-ghost btn-sm"
                        title="Simulate buffer reload with skeleton loader"
                        style={{ fontSize: "11.5px", padding: "4px 8px", color: "var(--text-muted)" }}
                      >
                        <RefreshCw size={12} /> Reload
                      </button>

                      {/* Trigger simulated Error state toggle */}
                      <button
                        onClick={() => setIsStreamSimulateError(!isStreamSimulateError)}
                        className="btn btn-ghost btn-sm"
                        title="Toggle simulated connection drop"
                        style={{
                          fontSize: "11.5px",
                          padding: "4px 8px",
                          color: isStreamSimulateError ? "#ef4444" : "var(--text-muted)",
                          border: isStreamSimulateError ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid transparent",
                        }}
                      >
                        <AlertCircle size={12} /> {isStreamSimulateError ? "Resolve Err" : "Test Err"}
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scroll on Mobile + Fixed Monospace Columns with Tabular Nums */}
                  <div
                    style={{
                      overflowX: "auto",
                      WebkitOverflowScrolling: "touch",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      background: "rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    {/* Header Row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "85px 75px 180px 170px 140px 90px 90px",
                        minWidth: "830px",
                        padding: "10px 16px",
                        background: "rgba(255, 255, 255, 0.04)",
                        borderBottom: "1px solid var(--border-subtle)",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--text-muted)",
                      }}
                    >
                      <div>Status</div>
                      <div>Method</div>
                      <div>Event Type</div>
                      <div>Origin Service</div>
                      <div>Edge Region</div>
                      <div style={{ textAlign: "right" }}>Latency</div>
                      <div style={{ textAlign: "right" }}>Timestamp</div>
                    </div>

                    {/* Table Body Content / Skeleton Loader / Error State / Empty State */}
                    <div
                      style={{
                        maxHeight: "340px",
                        overflowY: "auto",
                        minWidth: "830px",
                      }}
                    >
                      {isStreamLoading ? (
                        /* Skeleton Loader State */
                        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {[1, 2, 3, 4, 5, 6].map((idx) => (
                            <div
                              key={idx}
                              className="skeleton-box"
                              style={{
                                height: "38px",
                                width: "100%",
                              }}
                            />
                          ))}
                        </div>
                      ) : isStreamSimulateError ? (
                        /* Simulated Error State */
                        <div
                          style={{
                            padding: "44px 20px",
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "44px",
                              height: "44px",
                              borderRadius: "50%",
                              background: "rgba(239, 68, 68, 0.15)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <AlertTriangle size={22} color="#ef4444" />
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#fca5a5" }}>
                            Telemetry Stream Connection Dropped (Simulated 503)
                          </div>
                          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", maxWidth: "420px", margin: 0 }}>
                            Client failed to maintain WebSocket buffer with edge cluster. Reconnecting with exponential backoff...
                          </p>
                          <button
                            onClick={() => setIsStreamSimulateError(false)}
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: "6px", fontSize: "12px" }}
                          >
                            <RefreshCw size={13} /> Reconnect Stream Now
                          </button>
                        </div>
                      ) : filteredTelemetry.length > 0 ? (
                        /* Smooth Row-Enter Animated Rows */
                        filteredTelemetry.map((row, index) => {
                          const statusBg =
                            row.code === 200 || row.code === 201
                              ? "rgba(16, 185, 129, 0.15)"
                              : row.code === 429
                              ? "rgba(245, 158, 11, 0.15)"
                              : "rgba(239, 68, 68, 0.15)";
                          const statusColor =
                            row.code === 200 || row.code === 201
                              ? "#10b981"
                              : row.code === 429
                              ? "#f59e0b"
                              : "#ef4444";
                          const statusBorder =
                            row.code === 200 || row.code === 201
                              ? "rgba(16, 185, 129, 0.35)"
                              : row.code === 429
                              ? "rgba(245, 158, 11, 0.35)"
                              : "rgba(239, 68, 68, 0.35)";

                          return (
                            <motion.div
                              key={row.id}
                              initial={false}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, delay: index * 0.02 }}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "85px 75px 180px 170px 140px 90px 90px",
                                alignItems: "center",
                                padding: "9px 16px",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                                fontFamily: "var(--font-mono)",
                                fontSize: "12px",
                                background: index % 2 === 0 ? "rgba(255, 255, 255, 0.01)" : "transparent",
                                transition: "background-color 0.15s",
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)")}
                              onMouseOut={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  index % 2 === 0 ? "rgba(255, 255, 255, 0.01)" : "transparent")
                              }
                            >
                              {/* Consistent Status Pill (200 green, 429 amber, 500 red) */}
                              <div>
                                <span
                                  className="tabular-nums"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    background: statusBg,
                                    color: statusColor,
                                    border: `1px solid ${statusBorder}`,
                                  }}
                                >
                                  {row.code}
                                </span>
                              </div>

                              {/* Method */}
                              <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>{row.method}</div>

                              {/* Event Type */}
                              <div style={{ color: "#ffffff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {row.type}
                              </div>

                              {/* Origin Source */}
                              <div style={{ color: "#38bdf8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {row.src}
                              </div>

                              {/* Region */}
                              <div>
                                <span
                                  style={{
                                    padding: "2px 7px",
                                    borderRadius: "4px",
                                    background: "rgba(255, 255, 255, 0.04)",
                                    border: "1px solid var(--border-subtle)",
                                    fontSize: "11px",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  {row.region}
                                </span>
                              </div>

                              {/* Latency with Tabular Nums */}
                              <div
                                className="tabular-nums"
                                style={{
                                  textAlign: "right",
                                  fontWeight: 600,
                                  color: row.status === "ERROR" ? "#fca5a5" : "#34d399",
                                }}
                              >
                                {row.lat}ms
                              </div>

                              {/* Timestamp */}
                              <div style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "11px" }}>
                                {row.time}
                              </div>
                            </motion.div>
                          );
                        })
                      ) : (
                        /* Empty State */
                        <div
                          style={{
                            padding: "48px 20px",
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                          }}
                        >
                          <Search size={28} color="var(--text-muted)" />
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                            No Matching Telemetry Events Found
                          </div>
                          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", maxWidth: "380px", margin: 0 }}>
                            No stream events matched your active status code (&quot;{statusFilter}&quot;), region (&quot;{regionFilter}&quot;), or search filter (&quot;{streamSearch}&quot;).
                          </p>
                          <button
                            onClick={() => {
                              setStatusFilter("ALL");
                              setRegionFilter("ALL");
                              setStreamSearch("");
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: "6px", fontSize: "12px" }}
                          >
                            Reset All Filters
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Live Latency Percentile Chart (p50, p95, p99) */}
              {activeTab === "chart" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Real-Time Latency Percentiles (SLA Metrics)</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "12.5px", margin: "3px 0 0 0" }}>
                        Sub-second percentile buckets evaluating edge ingress and database persistence SLA ({demoMetrics.count} matching events).
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "14px", fontSize: "12px", fontWeight: 600, flexWrap: "wrap" }}>
                      <span style={{ color: "#34d399" }}>• p50: {demoMetrics.p50}ms</span>
                      <span style={{ color: "#818cf8" }}>• p95: {demoMetrics.p95}ms</span>
                      <span style={{ color: "#f59e0b" }}>• p99: {demoMetrics.p99}ms</span>
                      <span style={{ color: demoMetrics.errorRate > 0 ? "#f87171" : "#10b981" }}>• Errors: {demoMetrics.errorRate}%</span>
                    </div>
                  </div>

                  {/* SVG Line / Bar Visualization */}
                  <div style={{ background: "rgba(0, 0, 0, 0.4)", padding: "20px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", height: "180px", alignItems: "flex-end", gap: "8px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
                      {demoMetrics.chartSlots.map((slot, idx) => (
                        <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                          <div style={{ width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "3px", height: "140px" }}>
                            {/* p50 Bar */}
                            <div
                              style={{
                                width: "8px",
                                height: `${Math.min(100, (slot.p50 / 180) * 100)}%`,
                                background: "#34d399",
                                borderRadius: "3px 3px 0 0",
                              }}
                              title={`p50: ${slot.p50}ms`}
                            />
                            {/* p95 Bar */}
                            <div
                              style={{
                                width: "8px",
                                height: `${Math.min(100, (slot.p95 / 180) * 100)}%`,
                                background: "#818cf8",
                                borderRadius: "3px 3px 0 0",
                              }}
                              title={`p95: ${slot.p95}ms`}
                            />
                            {/* p99 Bar */}
                            <div
                              style={{
                                width: "8px",
                                height: `${Math.min(100, (slot.p99 / 180) * 100)}%`,
                                background: "#f59e0b",
                                borderRadius: "3px 3px 0 0",
                              }}
                              title={`p99: ${slot.p99}ms`}
                            />
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {slot.time}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "11.5px", color: "var(--text-muted)", flexWrap: "wrap", gap: "8px" }}>
                      <span>SLA Compliance Threshold: 250ms</span>
                      <span style={{ color: demoMetrics.p99 <= 250 ? "#34d399" : "#f87171", fontWeight: 600 }}>
                        Current Fleet Health: {demoMetrics.p99 <= 250 ? "100% within SLA" : "Degraded Performance"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Geographical Edge Map */}
              {activeTab === "map" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Global Edge Region Ingress Nodes</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "12.5px", margin: "2px 0 0 0" }}>
                        Real-time distributed telemetry collector nodes with instant edge handoff.
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      height: "240px",
                      background: "radial-gradient(ellipse at center, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.9) 100%)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {/* Simulated SVG World Grid Lines */}
                    <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)", backgroundSize: "36px 36px" }} />

                    {/* Edge Node Points */}
                    {/* Node 1: US East */}
                    <div style={{ position: "absolute", left: "28%", top: "35%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#06b6d4", boxShadow: "0 0 12px #06b6d4" }} />
                      <span style={{ fontSize: "10.5px", color: "#38bdf8", fontWeight: 700, marginTop: "4px" }}>us-east-1 (N. Virginia)</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>18ms • 140 req/s</span>
                    </div>

                    {/* Node 2: US West */}
                    <div style={{ position: "absolute", left: "16%", top: "38%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#818cf8", boxShadow: "0 0 10px #818cf8" }} />
                      <span style={{ fontSize: "10.5px", color: "#c7d2fe", fontWeight: 700, marginTop: "4px" }}>us-west-2 (Oregon)</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>22ms • 85 req/s</span>
                    </div>

                    {/* Node 3: EU Central */}
                    <div style={{ position: "absolute", left: "54%", top: "30%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 12px #10b981" }} />
                      <span style={{ fontSize: "10.5px", color: "#34d399", fontWeight: 700, marginTop: "4px" }}>eu-central-1 (Frankfurt)</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>16ms • 115 req/s</span>
                    </div>

                    {/* Node 4: AP Southeast */}
                    <div style={{ position: "absolute", left: "80%", top: "58%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 10px #f59e0b" }} />
                      <span style={{ fontSize: "10.5px", color: "#fcd34d", fontWeight: 700, marginTop: "4px" }}>ap-southeast-1 (Singapore)</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>28ms • 60 req/s</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Interactive Code Snippet Generator */}
              {activeTab === "code" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {(["curl", "node", "python", "go"] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setCodeLang(lang)}
                          style={{
                            padding: "4px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            cursor: "pointer",
                            background: codeLang === lang ? "var(--accent-indigo)" : "rgba(255, 255, 255, 0.05)",
                            color: codeLang === lang ? "#fff" : "var(--text-secondary)",
                            border: codeLang === lang ? "1px solid #818cf8" : "1px solid var(--border-subtle)",
                          }}
                        >
                          {lang === "curl" ? "cURL" : lang === "node" ? "Node.js" : lang === "python" ? "Python" : "Go"}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleCopySnippet}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      {copiedSnippet ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      {copiedSnippet ? "Copied!" : "Copy Snippet"}
                    </button>
                  </div>

                  <pre
                    style={{
                      padding: "18px",
                      borderRadius: "10px",
                      background: "rgba(0, 0, 0, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      color: "#e2e8f0",
                      fontFamily: "var(--font-mono)",
                      fontSize: "12.5px",
                      lineHeight: "1.6",
                      overflowX: "auto",
                    }}
                  >
                    {codeSnippets[codeLang]}
                  </pre>
                </div>
              )}

              {/* TAB 5: Live API Sandbox Playground */}
              {activeTab === "sandbox" && (
                <div>
                  <div style={{ marginBottom: "14px" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Live Ingestion Payload Sandbox</h4>
                    <p style={{ color: "var(--text-muted)", fontSize: "12.5px", margin: "2px 0 0 0" }}>
                      Send an event payload through the gateway test suite and inspect response headers and acknowledgements.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div>
                      <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Bearer Token</label>
                      <input
                        type="text"
                        className="form-input"
                        value={sandboxApiKey}
                        onChange={(e) => setSandboxApiKey(e.target.value)}
                        style={{ fontSize: "12px", padding: "6px 10px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Event Type</label>
                      <input
                        type="text"
                        className="form-input"
                        value={sandboxEventType}
                        onChange={(e) => setSandboxEventType(e.target.value)}
                        style={{ fontSize: "12px", padding: "6px 10px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <button
                      id="btn-run-sandbox"
                      onClick={handleRunSandbox}
                      disabled={sandboxLoading}
                      className="btn btn-primary btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <Play size={13} /> {sandboxLoading ? "Simulating Ingest..." : "Send Test Ingestion Event"}
                    </button>
                  </div>

                  {sandboxResponse && (
                    <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#34d399", marginBottom: "6px" }}>
                        HTTP 201 Created • Response Latency: {sandboxResponse.ack.latencyMs}ms
                      </div>
                      <pre style={{ margin: 0, fontSize: "11.5px", color: "#e2e8f0", fontFamily: "var(--font-mono)" }}>
                        {JSON.stringify(sandboxResponse.ack, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: RBAC Matrix */}
              {activeTab === "rbac" && (
                <div>
                  <div style={{ marginBottom: "14px", color: "var(--text-secondary)", fontSize: "13.5px" }}>
                    Zero-trust hierarchical permissions evaluated server-side across all organizations and workspace clusters:
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
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                        </tr>
                        <tr>
                          <td><span className="badge badge-success">ADMIN</span></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                        </tr>
                        <tr>
                          <td><span className="badge badge-neutral">MEMBER</span></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
                          <td><span style={{ color: "var(--text-muted)" }}>View only</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                          <td><span style={{ color: "var(--text-muted)" }}>—</span></td>
                        </tr>
                        <tr>
                          <td><span className="badge badge-neutral">VIEWER</span></td>
                          <td><CheckCircle2 size={15} color="#10b981" /></td>
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

            {/* Post-Demo Conversion Action Strip */}
            <div
              style={{
                padding: "16px 24px",
                background: "rgba(0, 0, 0, 0.6)",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Ready to stream live telemetry from your own infrastructure?
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <button
                  id="btn-demo-book-walkthrough"
                  onClick={() => {
                    trackEvent("book_demo_clicked_from_interactive_demo", "DEMO_BOOKING");
                    setIsDemoBookingOpen(true);
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 600,
                    border: "1px solid var(--border-medium)",
                    color: "var(--text-primary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Calendar size={13} color="#818cf8" /> Request Guided Demo
                </button>
                <Link
                  id="btn-demo-start-workspace"
                  href="/register"
                  onClick={() => trackEvent("start_workspace_clicked_from_interactive_demo", "CTA")}
                  className="btn btn-primary btn-sm"
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  Start Real Workspace <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Quota & ROI Calculator Section */}
      <section id="calculator" className="section-py" style={{ background: "rgba(255, 255, 255, 0.01)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", position: "relative", zIndex: 10 }}>
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 10px", borderRadius: "20px", background: "rgba(99, 102, 241, 0.12)", color: "#818cf8", border: "1px solid rgba(99, 102, 241, 0.3)", marginBottom: "12px" }}>
              <Calculator size={13} /> Sizing & ROI Advisor
            </div>
            <h2 style={{ fontSize: "32px", marginBottom: "10px" }}>
              Estimate Your Cluster Needs & <span className="gradient-text">Recommended Plan</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "580px", margin: "0 auto", fontSize: "14px" }}>
              Slide to select your projected monthly telemetry events to instantly see the optimal plan tier.
            </p>
          </div>

          <div
            className="glass-card"
            style={{
              maxWidth: "780px",
              margin: "0 auto",
              padding: "32px",
              borderRadius: "14px",
              border: "1px solid var(--border-medium)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>Projected Monthly Telemetry Volume:</span>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent-cyan)" }}>
                {calculatorRequests.toLocaleString()} requests / mo
              </span>
            </div>

            <input
              id="quota-slider"
              type="range"
              min={10000}
              max={1000000}
              step={10000}
              value={calculatorRequests}
              onChange={(e) => setCalculatorRequests(Number(e.target.value))}
              style={{
                width: "100%",
                height: "8px",
                borderRadius: "4px",
                accentColor: "#6366f1",
                cursor: "pointer",
                marginBottom: "28px",
              }}
            />

            {/* Recommendation Result Card */}
            <div
              style={{
                padding: "20px",
                borderRadius: "10px",
                background: "rgba(99, 102, 241, 0.08)",
                border: `1px solid ${recommendedPlan.color}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: 700, color: recommendedPlan.color }}>
                  Recommended Plan Match
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: "4px 0" }}>
                  {recommendedPlan.name} • {recommendedPlan.price}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Includes {recommendedPlan.maxReq} • {recommendedPlan.workspaces} • {recommendedPlan.seats}
                </div>
              </div>

              <Link href="/register" className="btn btn-primary" style={{ padding: "10px 22px", fontSize: "13.5px" }}>
                Select {recommendedPlan.name} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section (Accurately synchronized with backend SUBSCRIPTION_PLANS) */}
      <section id="pricing" className="section-py" style={{ position: "relative", zIndex: 10 }}>
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontSize: "34px", marginBottom: "12px" }}>
              Transparent, <span className="gradient-text">Predictable Pricing</span>
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "560px", margin: "0 auto 24px" }}>
              Clear usage limits and quota meters. Verified against our backend billing engine.
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
                id="btn-pricing-monthly"
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
                id="btn-pricing-annual"
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

          {/* Pricing Cards: Equal Height with Aligned Bottom CTAs */}
          <div
            className="pricing-grid-container"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
              gap: "28px",
              maxWidth: "1100px",
              margin: "0 auto 48px",
              alignItems: "stretch",
            }}
          >
            {/* Starter Plan */}
            <div
              className="glass-card"
              style={{
                padding: "34px",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>Growth Starter</div>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "18px" }}>
                Ideal for early-stage startups and small engineering squads.
              </p>

              {/* Price display with smooth transition */}
              <div style={{ fontSize: "38px", fontWeight: 800, marginBottom: "22px", minHeight: "58px", display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ transition: "all 0.3s ease", display: "inline-block" }}>
                  ${billingCycle === "annual" ? "23" : "29"}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)", transition: "all 0.3s ease" }}>
                  {billingCycle === "annual" ? "/ month, billed annually" : "/ month"}
                </span>
              </div>

              {/* Emphasized Limits */}
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Quota: 50,000 requests / mo</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>3 Workspaces • 5 Team Members • 7-Day Retention</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px", flexGrow: 1 }}>
                {[
                  "50,000 monthly telemetry requests",
                  "Up to 3 team workspaces",
                  "Up to 5 team members",
                  "5 Active API Keys with expiration",
                  "7-Day data retention & metrics",
                  "Outbound webhook dispatchers",
                  "Standard email support",
                ].map((feat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <CheckCircle2 size={15} color="#10b981" /> {feat}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "auto" }}>
                <Link
                  id="pricing-cta-starter"
                  href={`/register?plan=STARTER&interval=${billingCycle.toUpperCase()}`}
                  onClick={() => trackEvent("pricing_plan_selected", "PRICING", { plan: "STARTER", billingCycle })}
                  className="btn pricing-card-btn-secondary"
                  style={{ width: "100%", textAlign: "center", padding: "12px 20px" }}
                >
                  Deploy Growth Starter
                </Link>
              </div>
            </div>

            {/* Pro Plan - Featured Most Popular with glowing border */}
            <div
              className="glass-card"
              style={{
                padding: "34px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                height: "100%",
                boxSizing: "border-box",
                border: "2px solid rgba(99, 102, 241, 0.75)",
                boxShadow: "0 0 35px rgba(99, 102, 241, 0.28)",
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
                Most Popular
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>Team Pro</div>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "18px" }}>
                High-throughput telemetry & analytics for scaling tech companies.
              </p>

              {/* Price display with smooth transition */}
              <div style={{ fontSize: "38px", fontWeight: 800, marginBottom: "22px", minHeight: "58px", display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ transition: "all 0.3s ease", display: "inline-block" }}>
                  ${billingCycle === "annual" ? "79" : "99"}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)", transition: "all 0.3s ease" }}>
                  {billingCycle === "annual" ? "/ month, billed annually" : "/ month"}
                </span>
              </div>

              {/* Emphasized Limits */}
              <div style={{ padding: "12px", background: "rgba(99, 102, 241, 0.12)", borderRadius: "8px", border: "1px solid rgba(99, 102, 241, 0.3)", marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#818cf8" }}>Quota: 250,000 requests / mo</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>10 Workspaces • 15 Team Members • 30-Day Retention</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px", flexGrow: 1 }}>
                {[
                  "250,000 monthly telemetry requests",
                  "10 Isolated team workspaces",
                  "Up to 15 team members with RBAC",
                  "20 Active API Keys with scopes",
                  "30-Day metrics retention",
                  "10 Custom webhook endpoints",
                  "Advanced latency & percentile analytics",
                  "Priority email support (12h response)",
                ].map((feat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", color: "var(--text-primary)" }}>
                    <CheckCircle2 size={15} color="#6366f1" /> {feat}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "auto" }}>
                <Link
                  id="pricing-cta-pro"
                  href={`/register?plan=PRO&interval=${billingCycle.toUpperCase()}`}
                  onClick={() => trackEvent("pricing_plan_selected", "PRICING", { plan: "PRO", billingCycle })}
                  className="btn btn-primary"
                  style={{ width: "100%", textAlign: "center", padding: "12px 20px" }}
                >
                  Start 14-Day Free Trial
                </Link>
              </div>
            </div>

            {/* Scale Business */}
            <div
              className="glass-card"
              style={{
                padding: "34px",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>Scale Business</div>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "18px" }}>
                Enterprise observability, high concurrency & 99.9% uptime SLA.
              </p>

              {/* Price display with smooth transition */}
              <div style={{ fontSize: "38px", fontWeight: 800, marginBottom: "22px", minHeight: "58px", display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ transition: "all 0.3s ease", display: "inline-block" }}>
                  ${billingCycle === "annual" ? "199" : "249"}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--text-muted)", transition: "all 0.3s ease" }}>
                  {billingCycle === "annual" ? "/ month, billed annually" : "/ month"}
                </span>
              </div>

              {/* Emphasized Limits */}
              <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Quota: 1,000,000 requests / mo</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>25 Workspaces • 50 Team Members • 90-Day Retention</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px", flexGrow: 1 }}>
                {[
                  "1,000,000 monthly telemetry requests",
                  "25 Isolated team workspaces",
                  "Up to 50 team members",
                  "50 Active API Keys with rotation",
                  "90-Day data retention window",
                  "25 Automated webhook webhooks",
                  "Compliance audit logs export",
                  "Dedicated Slack / Discord channel",
                ].map((feat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    <CheckCircle2 size={15} color="#06b6d4" /> {feat}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "auto" }}>
                <Link
                  id="pricing-cta-scale"
                  href={`/register?plan=BUSINESS&interval=${billingCycle.toUpperCase()}`}
                  onClick={() => trackEvent("pricing_plan_selected", "PRICING", { plan: "BUSINESS", billingCycle })}
                  className="btn pricing-card-btn-secondary"
                  style={{ width: "100%", textAlign: "center", padding: "12px 20px" }}
                >
                  Deploy Scale Business
                </Link>
              </div>
            </div>
          </div>

          {/* Enterprise: Contact Us Option Banner */}
          <div
            className="glass-card"
            style={{
              maxWidth: "1100px",
              margin: "0 auto 54px",
              padding: "28px 36px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px",
              borderRadius: "14px",
              border: "1px solid rgba(6, 182, 212, 0.35)",
              background: "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)",
            }}
          >
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", marginBottom: "6px" }}>
                <ShieldCheck size={14} /> Enterprise Custom Deployment
              </div>
              <h3 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 6px" }}>
                Need 10M+ Events/Month, Dedicated VPC, or Custom SLA?
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0, maxWidth: "680px" }}>
                Get custom contract billing, annual invoicing, dedicated Kubernetes clusters, SSO/SAML integration, and 99.99% uptime guarantee.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                id="btn-enterprise-book-demo"
                onClick={() => {
                  trackEvent("enterprise_demo_booking_clicked", "DEMO_BOOKING");
                  setIsDemoBookingOpen(true);
                }}
                className="btn btn-ghost"
                style={{
                  padding: "12px 20px",
                  fontSize: "14px",
                  border: "1px solid var(--border-medium)",
                  color: "var(--text-primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Calendar size={15} color="#818cf8" /> Book Demo
              </button>
              <a
                id="btn-enterprise-contact-sales"
                href="#contact-sales"
                onClick={() => trackEvent("enterprise_contact_sales_clicked", "CTA")}
                className="btn btn-secondary"
                style={{
                  padding: "12px 24px",
                  fontSize: "14px",
                  whiteSpace: "nowrap",
                  border: "1px solid rgba(6, 182, 212, 0.4)",
                  color: "#38bdf8",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                Contact Sales <ArrowRight size={15} />
              </a>
            </div>
          </div>

          {/* Full Feature Comparison Table */}
          <div
            className="glass-card"
            style={{
              maxWidth: "1100px",
              margin: "0 auto",
              overflow: "hidden",
              borderRadius: "14px",
              border: "1px solid var(--border-medium)",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255, 255, 255, 0.02)" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
                Detailed Plan Feature Matrix & Quotas
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "650px" }}>
                <thead>
                  <tr style={{ background: "rgba(0, 0, 0, 0.3)", borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
                    <th style={{ padding: "14px 20px", color: "var(--text-muted)", fontWeight: 700 }}>Feature / Capability</th>
                    <th style={{ padding: "14px 20px", color: "var(--text-muted)", fontWeight: 700 }}>Growth Starter</th>
                    <th style={{ padding: "14px 20px", color: "#818cf8", fontWeight: 700 }}>Team Pro</th>
                    <th style={{ padding: "14px 20px", color: "#38bdf8", fontWeight: 700 }}>Scale Business</th>
                    <th style={{ padding: "14px 20px", color: "#a855f7", fontWeight: 700 }}>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feat: "Monthly Telemetry Volume", s: "50,000 req", p: "250,000 req", b: "1,000,000 req", e: "Unlimited (Custom)" },
                    { feat: "Team Workspaces", s: "3", p: "10", b: "25", e: "Unlimited" },
                    { feat: "Seats & Team Members", s: "5", p: "15", b: "50", e: "Unlimited" },
                    { feat: "Data Retention Window", s: "7 Days", p: "30 Days", b: "90 Days", e: "365+ Days (Cold Archive)" },
                    { feat: "Active API Keys", s: "5 Keys", p: "20 Keys", b: "50 Keys", e: "Unlimited" },
                    { feat: "Role-Based Access Control", s: "Basic", p: "4-Tier RBAC", b: "4-Tier RBAC", e: "Custom Roles + SSO" },
                    { feat: "Webhook Dispatchers", s: "Standard", p: "10 Signed", b: "25 Signed", e: "Dedicated Queues" },
                    { feat: "Audit Logs & Export", s: "—", p: "CSV Export", b: "Full API Stream", b2: true, e: "SIEM & S3 Push" },
                    { feat: "Uptime SLA Guarantee", s: "Best-effort", p: "99.5%", b: "99.9%", e: "99.99% Financially Backed" },
                    { feat: "Support Channels", s: "Standard Email", p: "Priority Email (12h)", b: "Slack / Discord Channel", e: "24/7 Dedicated Rep" },
                  ].map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                        background: idx % 2 === 0 ? "rgba(255, 255, 255, 0.01)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "12px 20px", fontWeight: 600, color: "var(--text-primary)" }}>{row.feat}</td>
                      <td style={{ padding: "12px 20px", color: "var(--text-secondary)" }}>{row.s}</td>
                      <td style={{ padding: "12px 20px", color: "#c7d2fe", fontWeight: 600 }}>{row.p}</td>
                      <td style={{ padding: "12px 20px", color: "#bae6fd" }}>{row.b}</td>
                      <td style={{ padding: "12px 20px", color: "#e9d5ff", fontWeight: 600 }}>{row.e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="section-py" style={{ position: "relative", zIndex: 10 }}>
        <div className="container-1200">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontSize: "32px", marginBottom: "12px" }}>Frequently Asked Questions</h2>
            <p style={{ color: "var(--text-secondary)" }}>Clear answers on plan changes, usage quotas, security, and cancellation policies.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  id={`faq-item-${idx}`}
                  className="glass-card"
                  style={{
                    padding: "20px 24px",
                    cursor: "pointer",
                    transition: "border-color 0.25s, box-shadow 0.25s",
                    border: isOpen ? "1px solid rgba(99, 102, 241, 0.45)" : "1px solid var(--border-subtle)",
                    boxShadow: isOpen ? "0 8px 24px -6px rgba(99, 102, 241, 0.15)" : "none",
                  }}
                  onClick={() => toggleFaq(idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleFaq(idx);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isOpen}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "15.5px", fontWeight: 600, color: isOpen ? "#ffffff" : "var(--text-primary)" }}>
                      {item.q}
                    </span>
                    <ChevronDown
                      size={18}
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s",
                        color: isOpen ? "#818cf8" : "var(--text-muted)",
                        flexShrink: 0,
                        marginLeft: "12px",
                      }}
                    />
                  </div>

                  {/* Smooth Height Collapse/Expand via AnimatePresence */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <p
                          style={{
                            marginTop: "14px",
                            marginBottom: "4px",
                            color: "var(--text-secondary)",
                            fontSize: "14px",
                            lineHeight: "1.65",
                          }}
                        >
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION: Enterprise Lead Capture & Contact Sales */}
      <section id="contact-sales" className="section-py" style={{ position: "relative", zIndex: 10, background: "rgba(255, 255, 255, 0.01)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="container-1200" style={{ maxWidth: "860px" }}>
          <LeadCaptureForm />
        </div>
      </section>

      {/* SECTION: Final High-Converting CTA Banner */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          padding: "80px 0 96px",
          overflow: "hidden",
        }}
      >
        <div className="container-1200">
          <div
            className="glass-card"
            style={{
              position: "relative",
              borderRadius: "20px",
              padding: "clamp(36px, 6vw, 64px)",
              textAlign: "center",
              overflow: "hidden",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              background: "radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.22) 0%, rgba(7, 9, 14, 0.95) 75%)",
              boxShadow: "0 25px 60px -15px rgba(99, 102, 241, 0.25)",
            }}
          >
            {/* Subtle glow mesh */}
            <div
              style={{
                position: "absolute",
                top: "-40%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "600px",
                height: "300px",
                background: "radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, transparent 70%)",
                filter: "blur(50px)",
                pointerEvents: "none",
              }}
            />

            <Badge variant="indigo" style={{ marginBottom: "16px" }}>
              <Zap size={13} /> Instant Activation
            </Badge>

            <h2
              style={{
                fontSize: "clamp(28px, 4.5vw, 46px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
                maxWidth: "760px",
                margin: "0 auto 16px",
                color: "var(--text-primary)",
              }}
            >
              Start Monitoring in <span className="gradient-text">5 Minutes</span>
            </h2>

            <p
              style={{
                fontSize: "clamp(15px, 1.8vw, 17px)",
                color: "var(--text-secondary)",
                maxWidth: "600px",
                margin: "0 auto 32px",
                lineHeight: 1.6,
              }}
            >
              Zero credit card required. Generate your first cryptographic API key, send live telemetry events, and watch your metrics stream in real time.
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                flexWrap: "wrap",
                marginBottom: "24px",
              }}
            >
              <Link
                href="/register"
                className="btn btn-primary"
                style={{
                  padding: "14px 32px",
                  fontSize: "15px",
                  borderRadius: "10px",
                  boxShadow: "0 8px 24px rgba(99, 102, 241, 0.45)",
                }}
              >
                Start Free Trial <ArrowRight size={16} />
              </Link>
              <Link
                href="#demo"
                className="btn btn-ghost"
                style={{
                  padding: "14px 28px",
                  fontSize: "15px",
                  borderRadius: "10px",
                  border: "1px solid var(--border-medium)",
                  background: "rgba(255, 255, 255, 0.04)",
                }}
              >
                Explore Live Demo
              </Link>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "24px",
                flexWrap: "wrap",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={15} color="#10b981" /> 14-day full feature trial
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={15} color="#10b981" /> No credit card required
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={15} color="#10b981" /> Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Column Comprehensive Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "70px 0 36px",
          background: isDarkMode ? "#0A0F1E" : "#F5F7FC",
          fontSize: "14px",
          color: "var(--text-muted)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div className="container-1200">
          {/* Main Footer Columns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "40px",
              marginBottom: "50px",
            }}
          >
            {/* Column 1: Brand Info & Newsletter */}
            <div style={{ gridColumn: "span 2", minWidth: "260px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
                <NexoraLogo size="md" variant="full" theme={isDarkMode ? "dark" : "light"} />
              </div>
              <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "14px", marginBottom: "6px" }}>
                Build smarter. Scale further.
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", lineHeight: 1.6, marginBottom: "20px", maxWidth: "340px" }}>
                The high-performance observability and real-time telemetry platform built for multi-tenant microservice architectures.
              </p>

              {/* Newsletter subscription form */}
              <div style={{ maxWidth: "360px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
                  Subscribe to Engineering Updates
                </div>
                {newsletterSubscribed ? (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      color: "#10b981",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <CheckCircle2 size={16} /> Subscribed! Check your inbox for updates.
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newsletterEmail.trim()) {
                        setNewsletterSubscribed(true);
                      }
                    }}
                    style={{ display: "flex", gap: "8px" }}
                  >
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-medium)",
                        background: "rgba(255, 255, 255, 0.04)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: "9px 16px", fontSize: "13px" }}>
                      Join <Send size={13} />
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Column 2: Product */}
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                Product
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><Link href="#features" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Capabilities</Link></li>
                <li><Link href="#demo" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Live Playground</Link></li>
                <li><Link href="#calculator" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Quota Calculator</Link></li>
                <li><Link href="#pricing" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Pricing &amp; Plans</Link></li>
                <li><Link href="/dashboard" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Workspace Portal</Link></li>
              </ul>
            </div>

            {/* Column 3: Developers */}
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                Developers
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><Link href="#how-it-works" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Documentation</Link></li>
                <li><Link href="#how-it-works" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>API Reference</Link></li>
                <li><Link href="/api/health" target="_blank" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Status &amp; Uptime</Link></li>
                <li><Link href="#how-it-works" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>SDK Libraries</Link></li>
                <li><Link href="#demo" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>API Playground</Link></li>
              </ul>
            </div>

            {/* Column 4: Company & Legal */}
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
                Company &amp; Legal
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><Link href="/pricing" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Enterprise Inquiries</Link></li>
                <li><Link href="#faq" style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}>Security &amp; Roadmap</Link></li>
                <li>
                  <a
                    href="#terms"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Terms of Service: Nexora multi-tenant telemetry and enterprise SLA terms apply.");
                    }}
                    style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="#privacy"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Privacy Policy: Zero data leakage, strict GDPR compliance, and scoped cryptographic API keys.");
                    }}
                    style={{ color: "var(--text-secondary)", transition: "color 0.2s" }}
                  >
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Social Links */}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              © {new Date().getFullYear()} Nexora Systems Inc. All rights reserved. Sub-20ms multi-tenant telemetry engine powered by Prisma SQLite WAL.
            </div>

            {/* Social Icons */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                title="PulseFlow GitHub"
                style={{
                  color: "var(--text-muted)",
                  transition: "color 0.2s, transform 0.2s",
                  display: "inline-flex",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>

              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                title="PulseFlow on X (Twitter)"
                style={{
                  color: "var(--text-muted)",
                  transition: "color 0.2s, transform 0.2s",
                  display: "inline-flex",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "#38bdf8";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                title="PulseFlow on LinkedIn"
                style={{
                  color: "var(--text-muted)",
                  transition: "color 0.2s, transform 0.2s",
                  display: "inline-flex",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "#818cf8";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Demo Booking Request Modal */}
      <DemoBookingModal
        isOpen={isDemoBookingOpen}
        onClose={() => setIsDemoBookingOpen(false)}
      />
    </div>
  );
}

