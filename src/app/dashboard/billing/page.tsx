"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "../DashboardContext";
import {
  CreditCard,
  CheckCircle2,
  Download,
  Zap,
  ShieldCheck,
  AlertCircle,
  FileText,
  Calendar,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Users,
  Layers,
  Clock,
  Check,
  X,
  Building,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { SUBSCRIPTION_PLANS, getAllPlans, formatPrice, PlanId, BillingInterval } from "@/lib/billing-plans";

export default function BillingPage() {
  const { activeOrganization, activeWorkspace, refreshUserData } = useDashboard();
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("MONTHLY");
  const [upgradingPlan, setUpgradingPlan] = useState<PlanId | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    billingEmail: "",
    billingAddress: "",
    taxId: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const targetOrgId = activeOrganization?.id || activeWorkspace?.organizationId;

  const fetchBilling = async () => {
    try {
      setLoading(true);
      if (targetOrgId) {
        const res = await fetch(`/api/organizations/${targetOrgId}/billing`);
        if (res.ok) {
          const data = await res.json();
          setBillingData(data);
          setSettingsForm({
            billingEmail: data.billingSettings?.billingEmail || "",
            billingAddress: data.billingSettings?.billingAddress || "",
            taxId: data.billingSettings?.taxId || "",
          });
          return;
        }
      }

      // Fallback to workspace billing if organization billing not found
      if (activeWorkspace) {
        const res = await fetch(`/api/workspaces/${activeWorkspace.id}/billing`);
        if (res.ok) {
          const data = await res.json();
          setBillingData(data);
        }
      }
    } catch (err) {
      console.error("Failed to load billing:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, [targetOrgId, activeWorkspace?.id]);

  const handleSelectPlan = async (targetPlan: PlanId) => {
    if (targetPlan === billingData?.currentPlan) return;
    setUpgradingPlan(targetPlan);
    setMessage(null);

    try {
      const endpoint = targetOrgId
        ? `/api/organizations/${targetOrgId}/billing`
        : `/api/workspaces/${activeWorkspace?.id}/billing`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPlan,
          billingInterval,
          simulatePayment: true, // Sandbox immediate upgrade for testing
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: data.message || `Successfully upgraded to ${targetPlan} plan!`,
        });
        await fetchBilling();
        await refreshUserData();
      } else {
        setMessage({
          type: "error",
          text: data.error || data.message || "Failed to update subscription",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Network error processing plan update." });
    } finally {
      setUpgradingPlan(null);
    }
  };

  const handleCancelSubscription = async (immediate: boolean = false) => {
    setCancelling(true);
    try {
      const endpoint = targetOrgId
        ? `/api/organizations/${targetOrgId}/billing/cancel`
        : `/api/workspaces/${activeWorkspace?.id}/billing/cancel`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: data.message || "Subscription cancellation scheduled successfully.",
        });
        setShowCancelModal(false);
        await fetchBilling();
        await refreshUserData();
      } else {
        alert(data.error || "Failed to cancel subscription");
      }
    } catch {
      alert("Network error cancelling subscription");
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrgId) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/organizations/${targetOrgId}/billing/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Billing contact settings saved successfully." });
        setShowSettingsModal(false);
        await fetchBilling();
      } else {
        alert(data.error || "Failed to save settings");
      }
    } catch {
      alert("Error saving settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const plans = getAllPlans();
  const currentPlan = billingData?.currentPlan || "FREE";
  const subscription = billingData?.subscription;
  const usage = billingData?.usage;
  const invoices = billingData?.invoices || [];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading billing and subscription details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Billing & Subscriptions</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {targetOrgId ? "Organization Billing" : "Workspace Billing"}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Manage your subscription tier, quotas, payment methods, and invoice receipts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {targetOrgId && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition"
            >
              <Building className="w-3.5 h-3.5 text-indigo-400" />
              <span>Billing Contact</span>
            </button>
          )}

          {subscription?.tier !== "FREE" && !subscription?.cancelAtPeriodEnd && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <div className="flex-1 font-medium">{message.text}</div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grace Period / Cancellation Notice */}
      {subscription?.cancelAtPeriodEnd && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-amber-300 text-sm block">Subscription Scheduled for Cancellation</span>
            <p>
              Your subscription is scheduled to end on{" "}
              <strong>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</strong>. You will retain full
              access to all tier quotas until that date, after which your account will revert to the Developer Free plan.
            </p>
          </div>
        </div>
      )}

      {/* Current Subscription Card & Usage Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Overview Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Tier</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                {subscription?.status || "ACTIVE"}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-1">
              {SUBSCRIPTION_PLANS[currentPlan as PlanId]?.name || currentPlan}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {SUBSCRIPTION_PLANS[currentPlan as PlanId]?.tagline}
            </p>

            <div className="space-y-3 border-t border-slate-800/80 pt-4 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Renewal Date:
                </span>
                <span className="font-semibold text-slate-200">
                  {subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : "Continuous"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Billing Interval:
                </span>
                <span className="font-semibold capitalize text-slate-200">
                  {subscription?.billingCycle?.toLowerCase() || "monthly"}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" /> Invoices:
                </span>
                <span className="font-semibold text-slate-200">{invoices.length} recorded</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> 256-bit Encrypted Stripe Integration
            </span>
          </div>
        </div>

        {/* Real-time Usage & Limits Progress */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" /> Quotas & Resource Usage
              </h3>
              <p className="text-xs text-slate-400">Enforced server-side quotas for your current plan</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">Current Billing Cycle</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Workspaces Limit */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> Team Workspaces
                </span>
                <span className="font-bold text-white">
                  {usage?.workspaces?.current || 1} / {usage?.workspaces?.limit || 1}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((usage?.workspaces?.current || 1) / (usage?.workspaces?.limit || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Team Members Limit */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> Organization Members
                </span>
                <span className="font-bold text-white">
                  {usage?.teamMembers?.current || 1} / {usage?.teamMembers?.limit || 2}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((usage?.teamMembers?.current || 1) / (usage?.teamMembers?.limit || 2)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Monthly Telemetry Requests */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" /> Monthly API Requests
                </span>
                <span className="font-bold text-white">
                  {(usage?.monthlyRequests?.current || 0).toLocaleString()} /{" "}
                  {(usage?.monthlyRequests?.limit || 10000).toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((usage?.monthlyRequests?.current || 0) /
                        (usage?.monthlyRequests?.limit || 10000)) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Data Retention Days */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Telemetry Retention Window
                </span>
                <span className="font-bold text-white">{usage?.retentionDays?.limit || 1} Day(s)</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Upgrade & Comparison Section */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Available Subscription Tiers</h2>
            <p className="text-xs text-slate-400">Switch or upgrade plan with prorated billing adjustments</p>
          </div>

          {/* Billing Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 self-start">
            <button
              onClick={() => setBillingInterval("MONTHLY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                billingInterval === "MONTHLY"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("ANNUAL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                billingInterval === "ANNUAL"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Annual</span>
              <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded text-[10px] font-bold">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* 5 Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {plans.map((p) => {
            const isCurrent = currentPlan.toUpperCase() === p.id;
            const price =
              billingInterval === "ANNUAL"
                ? formatPrice(p.pricing.annualMonthlyEquivalentCents)
                : formatPrice(p.pricing.monthlyCents);

            return (
              <div
                key={p.id}
                className={`rounded-2xl p-5 flex flex-col justify-between transition border ${
                  isCurrent
                    ? "bg-indigo-950/20 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-white text-sm">{p.name.replace("Developer ", "").replace("Team ", "").replace("Scale ", "").replace("Growth ", "")}</h4>
                    {p.popular && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                        Popular
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-white">{price}</span>
                      <span className="text-slate-400 text-[11px]">/mo</span>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-6 text-[11px] text-slate-300">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.monthlyRequests.toLocaleString()} req/mo</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.maxWorkspaces} workspaces</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.maxTeamMembers} members</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{p.limits.telemetryRetentionDays}d retention</span>
                    </li>
                  </ul>
                </div>

                {isCurrent ? (
                  <div className="w-full py-2 px-3 rounded-xl text-xs font-bold text-center bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed">
                    Current Plan
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href={`/dashboard/billing/checkout?plan=${p.id}&interval=${billingInterval}`}
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 text-center"
                    >
                      <span>Checkout {p.id}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                    <button
                      disabled={upgradingPlan !== null}
                      onClick={() => handleSelectPlan(p.id)}
                      className="w-full py-1 text-[10px] text-slate-400 hover:text-slate-200 transition flex items-center justify-center gap-1"
                    >
                      {upgradingPlan === p.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>Quick 1-Click Upgrade</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice & Payment History */}
      <div className="pt-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Invoice Receipts & Payment History
              </h3>
              <p className="text-xs text-slate-400">Download official tax invoices and verify payment statuses</p>
            </div>
            <span className="text-xs text-slate-400 font-medium">{invoices.length} Invoices</span>
          </div>

          {invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              No invoices generated yet. Invoices appear automatically after your first subscription payment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                    <th className="py-3 px-6">Invoice #</th>
                    <th className="py-3 px-6">Billing Date</th>
                    <th className="py-3 px-6">Amount</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Payment Method</th>
                    <th className="py-3 px-6 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-6 font-semibold text-slate-200">{inv.invoiceNumber}</td>
                      <td className="py-3.5 px-6 text-slate-400">
                        {new Date(inv.date).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-6 font-bold text-slate-100">
                        ${inv.amount} {inv.currency}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === "PAID"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-400">
                        {inv.paymentMethod || "Visa •••• 4242"}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <a
                          href={inv.pdfUrl || "#"}
                          onClick={(e) => {
                            e.preventDefault();
                            alert(`Downloading receipt ${inv.invoiceNumber}...`);
                          }}
                          className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Cancel Subscription</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to cancel your organization subscription? You will continue to have access to your
                quotas until the end of the billing period, after which your account will revert to Developer Free.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Full access until {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "period end"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero cancellation fees or penalties</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => handleCancelSubscription(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/25 flex items-center gap-1.5"
              >
                {cancelling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-white">Billing Contact Settings</h3>
              <p className="text-xs text-slate-400 mt-1">
                Update billing contact email and business tax identification for official receipts.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Billing Email</label>
                <input
                  type="email"
                  value={settingsForm.billingEmail}
                  onChange={(e) => setSettingsForm({ ...settingsForm, billingEmail: e.target.value })}
                  placeholder="billing@company.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Business Billing Address</label>
                <textarea
                  rows={2}
                  value={settingsForm.billingAddress}
                  onChange={(e) => setSettingsForm({ ...settingsForm, billingAddress: e.target.value })}
                  placeholder="123 Tech Boulevard, Suite 400, San Francisco, CA"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tax ID / VAT Number</label>
                <input
                  type="text"
                  value={settingsForm.taxId}
                  onChange={(e) => setSettingsForm({ ...settingsForm, taxId: e.target.value })}
                  placeholder="US-123456789 or EU987654321"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 flex items-center gap-1.5"
                >
                  {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
