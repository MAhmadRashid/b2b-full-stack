"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../layout";
import {
  CreditCard,
  CheckCircle2,
  Download,
  Zap,
  ShieldCheck,
  AlertCircle,
  FileText,
  Calendar,
} from "lucide-react";

export default function BillingPage() {
  const { activeWorkspace, refreshUserData } = useDashboard();
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchBilling = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/billing`);
      if (res.ok) {
        const data = await res.json();
        setBillingData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, [activeWorkspace?.id]);

  const handleSelectPlan = async (targetPlan: string) => {
    if (!activeWorkspace || targetPlan === billingData?.currentPlan) return;

    setUpgradingPlan(targetPlan);
    setMessage(null);

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`Workspace plan successfully updated to ${targetPlan}!`);
        await fetchBilling();
        await refreshUserData();
      } else {
        alert(data.error || "Failed to update plan");
      }
    } catch {
      alert("Network error updating plan");
    } finally {
      setUpgradingPlan(null);
    }
  };

  const handleDownloadInvoice = (invNum: string) => {
    alert(`Downloading receipt for invoice ${invNum}...`);
  };

  const plans = billingData?.plans || [];
  const invoices = billingData?.invoices || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Subscription & Invoicing</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Manage your telemetry quotas, payment tiers, and download tax invoices
        </p>
      </div>

      {message && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
            color: "#34d399",
            fontSize: "13.5px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {/* Current Quota Consumption Card */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Active Tier</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff" }}>
              {billingData?.currentPlan} Plan <span className="badge badge-success" style={{ marginLeft: "6px" }}>ACTIVE</span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Billing Cycle</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#e2e8f0" }}>{billingData?.billingCycle || "MONTHLY"}</div>
          </div>
        </div>

        {/* Quota Progress */}
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Monthly Request Quota</span>
            <span style={{ color: "#fff", fontWeight: 600 }}>
              {billingData?.requestsThisMonth?.toLocaleString()} / {billingData?.monthlyLimit?.toLocaleString()} requests
            </span>
          </div>
          <div style={{ height: "8px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(
                  ((billingData?.requestsThisMonth || 0) / (billingData?.monthlyLimit || 1)) * 100,
                  100
                )}%`,
                height: "100%",
                background: "var(--accent-gradient)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Plan Tier Selection Cards */}
      <div>
        <h3 style={{ fontSize: "18px", marginBottom: "16px" }}>Available Plan Tiers</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          {plans.map((p: any) => {
            const isCurrent = p.id === billingData?.currentPlan;
            return (
              <div
                key={p.id}
                className="glass-card"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  border: isCurrent ? "2px solid #6366f1" : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <span style={{ fontSize: "17px", fontWeight: 700, color: "#fff" }}>{p.name}</span>
                  {isCurrent && <span className="badge badge-indigo">Current Plan</span>}
                </div>

                <div style={{ fontSize: "32px", fontWeight: 800, color: "#fff", margin: "14px 0" }}>
                  ${p.priceMonthly} <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 400 }}>/ month</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", flexGrow: 1, marginBottom: "24px" }}>
                  {p.features.map((feat: string, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
                      <CheckCircle2 size={15} color="#10b981" /> {feat}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSelectPlan(p.id)}
                  disabled={isCurrent || upgradingPlan !== null}
                  className={`btn ${isCurrent ? "btn-secondary" : "btn-primary"} btn-sm`}
                  style={{ width: "100%" }}
                >
                  {isCurrent
                    ? "Current Active Plan"
                    : upgradingPlan === p.id
                    ? "Upgrading..."
                    : `Switch to ${p.id}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <FileText size={16} color="#06b6d4" /> Past Invoices & Receipts
        </h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length > 0 ? (
                invoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: "#fff", fontFamily: "var(--font-mono)" }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>{new Date(inv.date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600, color: "#34d399" }}>
                      ${inv.amount} {inv.currency}
                    </td>
                    <td>
                      <span className="badge badge-success">{inv.status}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => handleDownloadInvoice(inv.invoiceNumber)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: "12px", gap: "4px" }}
                      >
                        <Download size={13} /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No invoice transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
