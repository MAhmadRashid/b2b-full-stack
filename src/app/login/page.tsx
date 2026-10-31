"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Lock, Mail, ArrowRight, AlertCircle, Sparkles, ShieldCheck } from "lucide-react";
import { NexoraLogo } from "@/components/ui/NexoraLogo";

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

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleFirebaseGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { auth } = await import("@/lib/firebase");
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      if (!auth) {
        throw new Error("Firebase client is not initialized in this browser environment");
      }
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const idToken = await userCred.user.getIdToken();

      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          name: userCred.user.displayName || userCred.user.email?.split("@")[0],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to authenticate with Firebase Google sign-in");
        setGoogleLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user") {
        setGoogleLoading(false);
        return;
      }
      if (err?.code === "auth/internal-error") {
        console.error("[Firebase Auth Internal Error]:", err);
        setError("Firebase internal error: Ensure Google provider is enabled and localhost is in Authorized Domains in Firebase Console.");
      } else if (err?.code === "auth/unauthorized-domain") {
        setError("Domain unauthorized: Please add this domain to Firebase Console > Authentication > Settings > Authorized domains.");
      } else {
        setError(err?.message || "Google Authentication failed. Please try password sign-in.");
      }
      setGoogleLoading(false);
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
          <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "14px" }}>
            <NexoraLogo size="lg" variant="full" href="/" />
          </div>
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
              <Link
                href="/forgot-password"
                style={{ fontSize: "12px", color: "var(--accent-indigo)", textDecoration: "none" }}
              >
                Forgot password?
              </Link>
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
            disabled={loading || googleLoading}
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "8px", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Authenticating Session..." : "Sign In to Workspace"} <ArrowRight size={16} />
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "20px 0 16px",
            color: "var(--text-muted)",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
          <span style={{ padding: "0 12px" }}>or continue with</span>
          <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
        </div>

        {/* Firebase Google Auth Button */}
        <div>
          <button
            type="button"
            id="google-signin-button"
            disabled={googleLoading || loading}
            onClick={handleFirebaseGoogleSignIn}
            className="btn btn-secondary"
            style={{
              width: "100%",
              justifyContent: "center",
              gap: "10px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-subtle)",
              fontWeight: 600,
              padding: "10px 16px",
              transition: "all 0.2s ease",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? "Connecting to Google..." : "Continue with Google"}</span>
          </button>
        </div>

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
