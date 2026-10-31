"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, AlertTriangle, Building, Mail, User, Users, Shield, MessageSquare, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function LeadCaptureForm() {
  const [formData, setFormData] = useState({
    name: "",
    workEmail: "",
    company: "",
    teamSize: "11-50",
    message: "",
    consent: true,
    honeypot: "",
  });

  const [status, setStatus] = useState<"IDLE" | "SUBMITTING" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState<{ message: string; leadId?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Client-side quick validation
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage("Please enter your full name (minimum 2 characters).");
      return;
    }

    if (!formData.workEmail.trim() || !formData.workEmail.includes("@")) {
      setErrorMessage("Please enter a valid work email address.");
      return;
    }

    if (!formData.company.trim()) {
      setErrorMessage("Please enter your company or organization name.");
      return;
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      setErrorMessage("Please provide a message explaining your telemetry or scaling requirements (minimum 10 characters).");
      return;
    }

    if (!formData.consent) {
      setErrorMessage("Please consent to allow Nexora to follow up regarding your inquiry.");
      return;
    }

    setStatus("SUBMITTING");
    trackEvent("contact_sales_submitted", "LEAD_CAPTURE", {
      company: formData.company,
      teamSize: formData.teamSize,
    });

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("ERROR");
        setErrorMessage(data.error || "Failed to submit inquiry. Please try again.");
        return;
      }

      setStatus("SUCCESS");
      setSuccessInfo({
        message: data.message,
        leadId: data.leadId,
      });

      // Clear form except company
      setFormData((prev) => ({
        name: "",
        workEmail: "",
        company: prev.company,
        teamSize: "11-50",
        message: "",
        consent: true,
        honeypot: "",
      }));
    } catch (err) {
      setStatus("ERROR");
      setErrorMessage("Network error occurred while connecting to our server. Please try again.");
    }
  };

  return (
    <div
      id="contact-sales"
      className="glass-card"
      style={{
        borderRadius: "16px",
        padding: "clamp(24px, 4vw, 36px)",
        border: "1px solid var(--border-medium)",
        background: "rgba(10, 13, 20, 0.8)",
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.6)",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
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
            background: "rgba(99, 102, 241, 0.12)",
            color: "#818cf8",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            marginBottom: "10px",
          }}
        >
          <Building size={12} /> Enterprise & Custom Quota Inquiries
        </div>
        <h3 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)" }}>
          Contact Our Solutions Engineering Team
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0, lineHeight: 1.5 }}>
          Need high-volume ingest quotas, custom SLAs, private VPC deployments, or dedicated support? Tell us about your architecture.
        </p>
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
            Inquiry Successfully Received
          </h4>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 16px", lineHeight: 1.6 }}>
            {successInfo.message}
          </p>
          {successInfo.leadId && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Reference ID: {successInfo.leadId}
            </div>
          )}
          <button
            onClick={() => setStatus("IDLE")}
            className="btn btn-secondary btn-sm"
            style={{ marginTop: "16px", fontSize: "12px" }}
          >
            Submit Another Inquiry
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Honeypot field (hidden from humans, traps automated spam scrapers) */}
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
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#fca5a5",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                Full Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <User size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  id="lead-name-input"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 36px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                Work Email <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  id="lead-email-input"
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={formData.workEmail}
                  onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 36px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                Company / Organization <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <Building size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  id="lead-company-input"
                  type="text"
                  required
                  placeholder="Acme Technologies"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 36px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                Engineering Team Size <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <Users size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <select
                  id="lead-teamsize-select"
                  value={formData.teamSize}
                  onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 36px",
                    background: "#07090e",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "8px",
                    color: "var(--text-primary)",
                    fontSize: "13.5px",
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
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Tell Us About Your Requirements & Telemetry Scale <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <MessageSquare size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "12px" }} />
              <textarea
                id="lead-message-input"
                required
                rows={4}
                placeholder="We run a distributed microservices platform processing ~15M events/month. Looking for self-hosted agent or custom enterprise SLA..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 36px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: "13.5px",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>
          </div>

          {/* Consent Checkbox */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <input
              id="lead-consent-checkbox"
              type="checkbox"
              checked={formData.consent}
              onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
              style={{ marginTop: "3px", accentColor: "#6366f1", cursor: "pointer" }}
            />
            <label htmlFor="lead-consent-checkbox" style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5, cursor: "pointer" }}>
              I agree to allow Nexora to store my details and contact me regarding this product inquiry. We respect your privacy and will never sell or share your data.
            </label>
          </div>

          <button
            id="lead-submit-btn"
            type="submit"
            disabled={status === "SUBMITTING"}
            className="btn btn-primary"
            style={{
              padding: "12px 24px",
              fontSize: "14.5px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              borderRadius: "8px",
              cursor: status === "SUBMITTING" ? "not-allowed" : "pointer",
              opacity: status === "SUBMITTING" ? 0.75 : 1,
            }}
          >
            {status === "SUBMITTING" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Submitting Inquiry...
              </>
            ) : (
              <>
                <Send size={16} /> Submit Sales Inquiry
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
