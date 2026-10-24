"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Activity } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      if (!token) {
        setError("Missing verification token. Please request a new verification link.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setSuccess(true);
        } else {
          setError(data.error || "Verification link is invalid or expired.");
        }
      } catch {
        setError("Network error while verifying email.");
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [token]);

  return (
    <div className="glass-card" style={{ padding: "36px", background: "#0e111a", textAlign: "center" }}>
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "3px solid rgba(99, 102, 241, 0.2)",
              borderTopColor: "var(--accent-indigo)",
              animation: "spin 1s linear infinite",
            }}
          />
          <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Validating cryptographic email signature...
          </div>
        </div>
      )}

      {!loading && success && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#34d399",
            }}
          >
            <CheckCircle2 size={32} />
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Email Address Verified!</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", maxWidth: "340px" }}>
            Your account is fully verified. You now have unrestricted access to telemetry streaming, API keys, and workspace administration.
          </p>
          <Link
            href="/dashboard"
            className="btn btn-primary btn-sm"
            style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span>Enter Workspace Dashboard</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {!loading && error && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f87171",
            }}
          >
            <AlertTriangle size={30} />
          </div>
          <h2 style={{ fontSize: "19px", color: "#f87171", fontWeight: 700 }}>Verification Failed</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", maxWidth: "340px" }}>
            {error}
          </p>
          <Link href="/dashboard" className="btn btn-secondary btn-sm" style={{ marginTop: "10px" }}>
            Return to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "radial-gradient(ellipse at top, #0e121d 0%, #07090e 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "460px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "9999px",
              background: "rgba(6, 182, 212, 0.12)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              color: "#38bdf8",
              fontSize: "12.5px",
              fontWeight: 600,
              marginBottom: "14px",
            }}
          >
            <Activity size={14} /> PulseFlow Identity
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Email Verification</h1>
        </div>

        <Suspense fallback={<div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>Loading verification...</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
