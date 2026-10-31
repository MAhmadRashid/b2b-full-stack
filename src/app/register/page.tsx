"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, AlertCircle, CheckCircle2, Shield } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { NexoraLogo } from "@/components/ui/NexoraLogo";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    trackEvent("signup_page_viewed", "AUTH", { source: "register_page" }, "SIGNUP_STARTED");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          workspaceName: workspaceName || `${name}'s Team`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      router.push("/onboarding");
    } catch {
      setError("Network or server connection failed");
      setLoading(false);
    }
  };

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleFirebaseGoogleSignUp = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { auth } = await import("@/lib/firebase");
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      if (!auth) throw new Error("Firebase client is not initialized in this browser environment");

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
        setError(data.error || "Failed to register with Google");
        setGoogleLoading(false);
        return;
      }

      router.push("/onboarding");
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
        setError(err?.message || "Google registration failed. Please sign up with email.");
      }
      setGoogleLoading(false);
    }
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
          maxWidth: "480px",
          padding: "36px",
          position: "relative",
          zIndex: 10,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "14px" }}>
            <NexoraLogo size="lg" variant="full" href="/" />
          </div>
          <h1 style={{ fontSize: "22px", marginBottom: "6px" }}>Start Your 14-Day Free Trial</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            No credit card required. Instant cluster provisioning.
          </p>
        </div>

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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              required
              className="form-input"
              placeholder="e.g. Elena Rostova"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Work Email</label>
            <input
              id="email"
              type="email"
              required
              className="form-input"
              placeholder="elena@acmecorp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="workspace">Company / Workspace Name</label>
            <input
              id="workspace"
              type="text"
              className="form-input"
              placeholder="e.g. Acme Corp Cloud"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Create Password (min. 8 characters)</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="form-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "10px", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Provisioning Workspace..." : "Create Account & Workspace"} <ArrowRight size={16} />
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
          <span style={{ padding: "0 12px" }}>or register with</span>
          <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
        </div>

        <div>
          <button
            type="button"
            id="google-signup-button"
            disabled={googleLoading || loading}
            onClick={handleFirebaseGoogleSignUp}
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
            <span>{googleLoading ? "Connecting to Google..." : "Sign up with Google"}</span>
          </button>
        </div>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "13.5px", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
