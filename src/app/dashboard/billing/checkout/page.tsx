"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDashboard } from "../../DashboardContext";
import Link from "next/link";
import {
  CreditCard,
  ShieldCheck,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Zap,
  Building,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Check,
} from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  getPlan,
  formatPrice,
  PlanId,
  BillingInterval,
} from "@/lib/billing-plans";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeOrganization, activeWorkspace, refreshUserData } = useDashboard();

  const initialPlan = (searchParams.get("plan")?.toUpperCase() as PlanId) || "PRO";
  const initialInterval = (searchParams.get("interval")?.toUpperCase() as BillingInterval) || "MONTHLY";

  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(
    SUBSCRIPTION_PLANS[initialPlan] ? initialPlan : "PRO"
  );
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    initialInterval === "ANNUAL" ? "ANNUAL" : "MONTHLY"
  );

  // Form details
  const [billingEmail, setBillingEmail] = useState("");
  const [billingName, setBillingName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [taxId, setTaxId] = useState("");

  // Payment card inputs
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("123");
  const [cardType, setCardType] = useState<"success" | "declined" | "insufficient_funds">("success");

  // State
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  const plan = getPlan(selectedPlanId);
  const targetOrgId = activeOrganization?.id;

  useEffect(() => {
    if (activeOrganization) {
      setBillingName(activeOrganization.name || "");
      if ((activeOrganization as any).billingEmail) {
        setBillingEmail((activeOrganization as any).billingEmail);
      }
      if ((activeOrganization as any).billingAddress) {
        setBillingAddress((activeOrganization as any).billingAddress);
      }
      if ((activeOrganization as any).taxId) {
        setTaxId((activeOrganization as any).taxId);
      }
    }
  }, [activeOrganization]);

  // Pricing calculations
  const baseMonthly = plan.pricing.monthlyCents;
  const rawSubtotalCents =
    billingInterval === "ANNUAL"
      ? plan.pricing.annualCents
      : plan.pricing.monthlyCents;

  const estimatedTaxCents = Math.round(rawSubtotalCents * 0.0); // 0% test tax
  const totalCents = rawSubtotalCents + estimatedTaxCents;

  const handleSelectTestCard = (type: "success" | "declined" | "insufficient_funds") => {
    setCardType(type);
    setError(null);
    if (type === "success") {
      setCardNumber("4242 •••• •••• 4242");
    } else if (type === "declined") {
      setCardNumber("4000 •••• •••• 0005");
    } else {
      setCardNumber("4000 •••• •••• 0002");
    }
  };

  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      // Check for test card failure simulation
      if (cardType === "declined") {
        await new Promise((r) => setTimeout(r, 900));
        throw new Error(
          "Your card was declined. The issuing bank rejected the transaction (Code: do_not_honor)."
        );
      }
      if (cardType === "insufficient_funds") {
        await new Promise((r) => setTimeout(r, 900));
        throw new Error(
          "Transaction failed: Insufficient funds in the designated payment account."
        );
      }

      if (!targetOrgId && !activeWorkspace?.id) {
        throw new Error("No active organization or workspace selected for billing.");
      }

      // Step 1: Save billing settings if provided
      if (targetOrgId && (billingEmail || billingAddress || taxId)) {
        await fetch(`/api/organizations/${targetOrgId}/billing/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billingEmail, billingAddress, taxId }),
        });
      }

      // Step 2: Execute subscription checkout
      const endpoint = targetOrgId
        ? `/api/organizations/${targetOrgId}/billing`
        : `/api/workspaces/${activeWorkspace?.id}/billing`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPlan: selectedPlanId,
          billingInterval,
          simulatePayment: true,
          billingEmail: billingEmail || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Checkout could not be completed.");
      }

      await refreshUserData();
      setSuccessData({
        plan: selectedPlanId,
        interval: billingInterval,
        amount: totalCents,
        invoiceNumber: data.invoice?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during payment processing.");
    } finally {
      setProcessing(false);
    }
  };

  if (successData) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-3xl bg-slate-900 border border-emerald-500/30 p-8 md:p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6 border border-emerald-500/30 shadow-lg">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3 inline-block">
            Payment & Subscription Activated
          </span>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
            Welcome to {plan.name}!
          </h1>
          <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto">
            Your subscription was provisioned successfully. Your entitlements and higher usage limits are now active.
          </p>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 text-left mb-8 max-w-md mx-auto space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Organization</span>
              <span className="font-semibold text-white">{activeOrganization?.name || "Nexora Tenant"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Subscription Tier</span>
              <span className="font-semibold text-indigo-400">{selectedPlanId} ({billingInterval})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Amount Charged</span>
              <span className="font-semibold text-emerald-400">{formatPrice(successData.amount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Invoice Reference</span>
              <span className="font-mono text-slate-300">{successData.invoiceNumber}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard/billing"
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30"
            >
              Back to Billing Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition"
            >
              Go to Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Breadcrumb / Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Billing Overview
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>PCI-DSS Test Sandbox Mode</span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Complete Your Subscription
        </h1>
        <p className="text-xs md:text-sm text-slate-400 mt-1">
          Review your plan details, configure billing preferences, and authorize the checkout.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div>
            <div className="font-bold mb-0.5">Payment Failed</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Payment Method (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Plan Picker Strip */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              1. Select Subscription Tier
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["STARTER", "PRO", "BUSINESS", "ENTERPRISE"] as PlanId[]).map((pid) => {
                const isSelected = selectedPlanId === pid;
                const p = SUBSCRIPTION_PLANS[pid];
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => setSelectedPlanId(pid)}
                    className={`p-3 rounded-xl text-left border transition ${
                      isSelected
                        ? "bg-indigo-600/10 border-indigo-500 text-white shadow-md shadow-indigo-600/10"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold text-xs text-white">{pid}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {billingInterval === "ANNUAL"
                        ? formatPrice(p.pricing.annualMonthlyEquivalentCents)
                        : formatPrice(p.pricing.monthlyCents)}
                      /mo
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Interval Toggle */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Billing Frequency:</span>
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setBillingInterval("MONTHLY")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    billingInterval === "MONTHLY"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval("ANNUAL")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    billingInterval === "ANNUAL"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold">
                    -20%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Billing Contact Information */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              2. Organization & Invoicing Details
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Company / Organization Name</label>
                <input
                  type="text"
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Billing Email (For Invoices)</label>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="billing@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Billing Address & Tax Region</label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="100 Tech Blvd, Suite 400, San Francisco, CA"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tax ID / VAT Number (Optional)</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="US-EIN 12-3456789 or EU-VAT"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Payment Method / Sandbox Card Simulator */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                3. Payment Details
              </label>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero card storage</span>
              </div>
            </div>

            {/* Test Card Quick Selector */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
              <div className="text-[11px] text-slate-400 font-semibold">
                Quick Test Mode Scenarios:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectTestCard("success")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    cardType === "success"
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ✓ Successful Charge (4242)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTestCard("declined")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    cardType === "declined"
                      ? "bg-rose-500/10 border-rose-500/50 text-rose-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ✕ Declined Card (0005)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTestCard("insufficient_funds")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    cardType === "insufficient_funds"
                      ? "bg-amber-500/10 border-amber-500/50 text-amber-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ✕ Insufficient Funds (0002)
                </button>
              </div>
            </div>

            {/* Virtual Card Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                  <CreditCard className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Expires (MM/YY)</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">CVC / CVV</label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Order Summary</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-[11px] font-bold">
                {plan.name}
              </span>
            </div>

            <p className="text-xs text-slate-400">{plan.tagline}</p>

            {/* Quota Entitlements Highlight */}
            <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>{plan.limits.monthlyRequests.toLocaleString()}</strong> monthly API requests</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Up to <strong>{plan.limits.maxWorkspaces}</strong> team workspaces</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Up to <strong>{plan.limits.maxTeamMembers}</strong> team members</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>{plan.limits.telemetryRetentionDays} days</strong> telemetry retention</span>
              </div>
            </div>

            {/* Calculation Lines */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>
                  {plan.name} ({billingInterval === "ANNUAL" ? "Annual Billing" : "Monthly Billing"})
                </span>
                <span className="text-white font-medium">{formatPrice(rawSubtotalCents)}</span>
              </div>

              {billingInterval === "ANNUAL" && (
                <div className="flex justify-between text-emerald-400">
                  <span>Annual Commitment Discount (-20%)</span>
                  <span>Included</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400">
                <span>Estimated Tax (0%)</span>
                <span className="text-white font-medium">$0.00</span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="font-bold text-white text-sm">Total Due Today</span>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-white">
                    {formatPrice(totalCents)}
                  </span>
                  <div className="text-[10px] text-slate-400">
                    Billed {billingInterval.toLowerCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handleProcessCheckout}
              disabled={processing}
              className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authorize & Pay {formatPrice(totalCents)}</span>
                </>
              )}
            </button>

            <div className="text-[11px] text-slate-400 text-center leading-relaxed">
              By confirming your subscription, you agree to our Terms of Service. You can cancel anytime directly from your billing settings.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
