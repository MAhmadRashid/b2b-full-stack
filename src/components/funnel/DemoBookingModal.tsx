"use client";

import React, { useState } from "react";
import { Calendar, Clock, CheckCircle2, AlertTriangle, Building, Mail, User, Users, Globe2, Loader2, Info } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function DemoBookingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    workEmail: "",
    company: "",
    teamSize: "11-50",
    preferredTime: "Tomorrow Morning (09:00 - 12:00)",
    timezone: "UTC",
    focusArea: "LATENCY",
    notes: "",
    honeypot: "",
  });

  const [status, setStatus] = useState<"IDLE" | "SUBMITTING" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState<{ message: string; bookingId?: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!formData.workEmail.trim() || !formData.workEmail.includes("@")) {
      setErrorMessage("Please provide a valid business email address.");
      return;
    }
    if (!formData.company.trim()) {
      setErrorMessage("Please enter your company or project name.");
      return;
    }

    setStatus("SUBMITTING");
    trackEvent("demo_booking_submitted", "DEMO_BOOKING", {
      preferredTime: formData.preferredTime,
      focusArea: formData.focusArea,
    });

    try {
      const res = await fetch("/api/demos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("ERROR");
        setErrorMessage(data.error || "Failed to schedule demo request. Please try again.");
        return;
      }

      setStatus("SUCCESS");
      setSuccessInfo({
        message: data.message,
        bookingId: data.bookingId,
      });
    } catch (err) {
      setStatus("ERROR");
      setErrorMessage("Network connection failure. Please try again.");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "580px",
          borderRadius: "16px",
          padding: "clamp(24px, 4vw, 36px)",
          border: "1px solid var(--border-medium)",
          background: "#080b12",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9)",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
          }}
        >
          ✕
        </button>

        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "3px 10px",
              borderRadius: "20px",
              background: "rgba(6, 182, 212, 0.12)",
              color: "#38bdf8",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              marginBottom: "10px",
            }}
          >
            <Calendar size={12} /> Guided Architecture Walkthrough
          </div>
          <h3 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 6px", color: "var(--text-primary)" }}>
            Request a Live Demo Session
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", margin: 0, lineHeight: 1.5 }}>
            Meet directly with a solutions engineer to review your telemetry ingest, microservice architecture, and enterprise security needs.
          </p>
        </div>

        {/* Real Scheduling Transparency Alert */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            marginBottom: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            fontSize: "12.5px",
            color: "var(--text-secondary)",
          }}
        >
          <Info size={16} color="#818cf8" style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>
            <strong>Scheduling Note:</strong> Availability is coordinated by human engineers. Your selected time is submitted as a <em>preferred request</em>, not an instant confirmed slot. We will confirm via calendar invite.
          </span>
        </div>

        {status === "SUCCESS" && successInfo ? (
          <div
            style={{
              padding: "24px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              <CheckCircle2 size={26} color="#10b981" />
            </div>
            <h4 style={{ fontSize: "18px", fontWeight: 700, color: "#10b981", margin: "0 0 8px" }}>
              Demo Request Submitted
            </h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", margin: "0 0 16px", lineHeight: 1.6 }}>
              {successInfo.message}
            </p>
            {successInfo.bookingId && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                Request Reference: {successInfo.bookingId}
              </div>
            )}
            <button
              onClick={onClose}
              className="btn btn-primary btn-sm"
              style={{ marginTop: "18px", fontSize: "13px" }}
            >
              Close & Return to Site
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "none" }} aria-hidden="true">
              <input
                type="text"
                name="honeypot"
                tabIndex={-1}
                autoComplete="off"
                value={formData.honeypot}
                onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
              />
            </div>

            {errorMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#fca5a5",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Your Name *
                </label>
                <input
                  id="demo-name-input"
                  type="text"
                  required
                  placeholder="Alex Rivera"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Work Email *
                </label>
                <input
                  id="demo-email-input"
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={formData.workEmail}
                  onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Company Name *
                </label>
                <input
                  id="demo-company-input"
                  type="text"
                  required
                  placeholder="Fintech Corp"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Team Size *
                </label>
                <select
                  id="demo-teamsize-select"
                  value={formData.teamSize}
                  onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "#07090e",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                >
                  <option value="1-10">1 - 10 engineers</option>
                  <option value="11-50">11 - 50 engineers</option>
                  <option value="51-200">51 - 200 engineers</option>
                  <option value="201-1000">201 - 1,000 engineers</option>
                  <option value="1000+">1,000+ enterprise</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Preferred Window (Request) *
                </label>
                <select
                  id="demo-time-select"
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "#07090e",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                >
                  <option value="Tomorrow Morning (09:00 - 12:00)">Tomorrow Morning (09:00 - 12:00)</option>
                  <option value="Tomorrow Afternoon (13:00 - 17:00)">Tomorrow Afternoon (13:00 - 17:00)</option>
                  <option value="This Week - Any Morning">This Week - Any Morning</option>
                  <option value="This Week - Any Afternoon">This Week - Any Afternoon</option>
                  <option value="Next Week">Next Week</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Architecture Focus *
                </label>
                <select
                  id="demo-focus-select"
                  value={formData.focusArea}
                  onChange={(e) => setFormData({ ...formData, focusArea: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "#07090e",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                >
                  <option value="LATENCY">Edge Latency & Percentiles</option>
                  <option value="RBAC">RBAC & Multi-Tenant Isolation</option>
                  <option value="API_KEYS">Cryptographic Token Rotation</option>
                  <option value="BILLING">Usage Quotas & Metering</option>
                  <option value="ENTERPRISE_VPC">Custom VPC / Private Cloud</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                Specific Discussion Topics (Optional)
              </label>
              <textarea
                id="demo-notes-input"
                rows={2}
                placeholder="Questions about data retention or high-throughput batching..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "13px" }}
              >
                Cancel
              </button>
              <button
                id="demo-submit-btn"
                type="submit"
                disabled={status === "SUBMITTING"}
                className="btn btn-primary btn-sm"
                style={{
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {status === "SUBMITTING" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Submitting Request...
                  </>
                ) : (
                  <>
                    <Calendar size={14} /> Submit Demo Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
