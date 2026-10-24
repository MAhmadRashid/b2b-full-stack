"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck, Activity } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing or invalid reset token. Please request a new link.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        setError(data.error || "Failed to reset password.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
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
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.15)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#34d399",
              margin: "0 auto",
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <h3 style={{ fontSize: "17px", fontWeight: 700 }}>Password Reset Complete!</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
            Your credentials have been securely updated. Redirecting to login...
          </p>
          <Link href="/login" className="btn btn-primary btn-sm" style={{ marginTop: "8px" }}>
            Sign In Now
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="newPass">
              New Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="newPass"
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: "34px" }}
              />
              <Lock
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="confirmPass">
              Confirm New Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="confirmPass"
                type="password"
                required
                placeholder="Re-type password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: "34px" }}
              />
              <Lock
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
            <ShieldCheck size={16} />
            <span>{loading ? "Updating Password..." : "Set New Password"}</span>
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
  );
}

export default function ResetPasswordPage() {
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
            <Activity size={14} /> PulseFlow Security
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Create New Password</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Set a new secure password for your PulseFlow account
          </p>
        </div>

        <Suspense fallback={<div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>Loading verification...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
