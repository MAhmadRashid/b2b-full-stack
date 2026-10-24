"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Lock, Mail, ArrowRight, AlertCircle, Sparkles, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed");
        setLoading(false);
        return;
      }

      // Route to dashboard
      router.push("/dashboard");
    } catch {
      setError("Network or server connection failed. Please check your connection.");
      setLoading(false);
    }
  };

  const setDemoCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setError("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
      }}
    >
      <div className="glow-mesh" />

      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "36px",
          position: "relative",
          zIndex: 10,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
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
            <span style={{ fontSize: "22px", fontWeight: "800" }}>
              Pulse<span className="gradient-text">Flow</span>
            </span>
          </Link>
          <h1 style={{ fontSize: "22px", marginBottom: "6px" }}>Welcome Back</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Enter your credentials to access your telemetry workspace
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 14px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#fca5a5",
              fontSize: "13.5px",
              marginBottom: "20px",
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Work Email</label>
            <div style={{ position: "relative" }}>
              <input
                id="email"
                type="email"
                required
                className="form-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label" htmlFor="password">Password</label>
              <span style={{ fontSize: "12px", color: "var(--accent-indigo)", cursor: "pointer" }}>
                Forgot password?
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type="password"
                required
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "8px", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Authenticating Session..." : "Sign In to Workspace"} <ArrowRight size={16} />
          </button>
        </form>

        {/* 1-Click Quick Demo Switcher */}
        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            <Sparkles size={14} color="#818cf8" /> One-Click Demo Profiles
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setDemoCredentials("demo@acmecorp.com")}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: "flex-start", padding: "8px 12px", textAlign: "left" }}
            >
              <span className="badge badge-indigo" style={{ marginRight: "6px" }}>Owner</span>
              <span>demo@acmecorp.com</span>
            </button>

            <button
              type="button"
              onClick={() => setDemoCredentials("admin@pulseflow.io")}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: "flex-start", padding: "8px 12px", textAlign: "left" }}
            >
              <span className="badge badge-success" style={{ marginRight: "6px" }}>Superadmin</span>
              <span>admin@pulseflow.io</span>
            </button>

            <button
              type="button"
              onClick={() => setDemoCredentials("dev@acmecorp.com")}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: "flex-start", padding: "8px 12px", textAlign: "left" }}
            >
              <span className="badge badge-neutral" style={{ marginRight: "6px" }}>Admin</span>
              <span>dev@acmecorp.com</span>
            </button>
          </div>
        </div>

        {/* Sign up link */}
        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "13.5px", color: "var(--text-secondary)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
            Create Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
