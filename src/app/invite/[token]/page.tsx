"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Building,
  UserPlus,
  ArrowRight,
  AlertTriangle,
  Lock,
  User,
  CheckCircle2,
  Mail,
  Activity,
} from "lucide-react";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default function InviteAcceptPage({ params }: InvitePageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form inputs
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvitation() {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        const data = await res.json();

        if (res.ok && data.valid) {
          setInvitationData(data);
          if (data.existingName) {
            setName(data.existingName);
          }
        } else {
          setError(data.error || "This invitation link is invalid or has already been used.");
        }
      } catch {
        setError("Unable to connect to verification server. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!invitationData?.userExists && (!password || password.length < 6)) {
      setSubmitError("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Successful onboarding: redirect straight to dashboard
        router.push("/dashboard");
      } else {
        setSubmitError(data.error || "Failed to accept invitation.");
      }
    } catch {
      setSubmitError("Network error while accepting invitation.");
    } finally {
      setIsSubmitting(false);
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
        background: "radial-gradient(ellipse at top, #0d121f 0%, #07090e 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "460px" }}>
        {/* Brand Header */}
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
              marginBottom: "16px",
            }}
          >
            <Activity size={14} /> PulseFlow Telemetry Cloud
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Workspace Invitation</h1>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Verifying cryptographic invitation token...
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div
            className="glass-card"
            style={{
              padding: "32px",
              textAlign: "center",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              background: "rgba(239, 68, 68, 0.04)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f87171",
                marginBottom: "14px",
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: "17px", color: "#f87171", marginBottom: "8px" }}>
              Invitation Unavailable
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", marginBottom: "24px" }}>
              {error}
            </p>
            <Link href="/login" className="btn btn-secondary btn-sm" style={{ width: "100%" }}>
              Return to Sign In
            </Link>
          </div>
        )}

        {/* Valid Invitation Form */}
        {!loading && invitationData && (
          <div
            className="glass-card"
            style={{
              padding: "32px",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              background: "#0f1322",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
            }}
          >
            {/* Workspace Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: "var(--accent-gradient)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <Building size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Workspace</div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                  {invitationData.invitation.workspaceName}
                </div>
              </div>
              <span className="badge badge-indigo" style={{ fontSize: "11px" }}>
                {invitationData.invitation.role}
              </span>
            </div>

            <div style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              You were invited by{" "}
              <strong style={{ color: "#f8fafc" }}>
                {invitationData.invitation.inviterEmail || "Workspace Administrator"}
              </strong>{" "}
              to collaborate on PulseFlow.
            </div>

            {submitError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {submitError}
              </div>
            )}

            <form onSubmit={handleAcceptInvite} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="email"
                    readOnly
                    value={invitationData.invitation.email}
                    className="form-input mono"
                    style={{ paddingLeft: "34px", opacity: 0.8 }}
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="fullName">
                  Your Full Name
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="fullName"
                    type="text"
                    required
                    placeholder="e.g. Jordan Hayes"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: "34px" }}
                  />
                  <User
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
                <label className="form-label" htmlFor="pass">
                  {invitationData.userExists ? "Confirm or Update Password (Optional)" : "Create Secure Password"}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="pass"
                    type="password"
                    required={!invitationData.userExists}
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {isSubmitting ? (
                  "Activating Membership..."
                ) : (
                  <>
                    <span>Accept & Enter Workspace</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
