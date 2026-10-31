"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, KeyRound, Activity } from "lucide-react";
import { NexoraIcon, NexoraLogo } from "@/components/ui/NexoraLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        if (data.resetUrl) {
          setResetUrl(data.resetUrl);
        }
      } else {
        setError(data.error || "Failed to initiate password reset");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
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
        background: "radial-gradient(ellipse at top, #0e121d 0%, #07090e 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "9999px",
              background: "rgba(99, 102, 241, 0.12)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              color: "#818cf8",
              fontSize: "12.5px",
              fontWeight: 600,
              marginBottom: "14px",
            }}
          >
            <NexoraIcon size={16} /> Nexora Security
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Account Recovery</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Enter your verified email to receive a password reset link
          </p>
        </div>

        <div className="glass-card" style={{ padding: "32px", background: "#0e111a" }}>
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                color: "#fca5a5",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "14px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "8px",
                  color: "#34d399",
                  fontSize: "13.5px",
                }}
              >
                <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong>Reset Link Dispatched</strong>
                  <p style={{ color: "var(--text-secondary)", fontSize: "12.5px", marginTop: "4px" }}>
                    If an account is associated with <strong>{email}</strong>, a secure reset token has been generated.
                  </p>
                </div>
              </div>

              {resetUrl && (
                <div
                  style={{
                    padding: "12px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Direct Recovery Link:</span>
                  <div style={{ marginTop: "6px" }}>
                    <Link
                      href={resetUrl}
                      className="mono"
                      style={{ color: "#38bdf8", textDecoration: "underline", wordBreak: "break-all" }}
                    >
                      {resetUrl}
                    </Link>
                  </div>
                </div>
              )}

              <Link
                href="/login"
                className="btn btn-secondary btn-sm"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "8px" }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="recoveryEmail">
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="recoveryEmail"
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: "34px" }}
                  />
                  <Mail
                    size={15}
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <KeyRound size={16} />
                <span>{loading ? "Generating Link..." : "Request Reset Link"}</span>
              </button>

              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <Link
                  href="/login"
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <ArrowLeft size={13} /> Return to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
