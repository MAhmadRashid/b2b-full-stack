"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  Zap,
  Shield,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { SUBSCRIPTION_PLANS, getAllPlans, formatPrice } from "@/lib/billing-plans";
import { NexoraLogo } from "@/components/ui/NexoraLogo";

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const plans = getAllPlans();

  React.useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("nexora-theme") || localStorage.getItem("pulseflow-theme");
      if (savedTheme === "light") {
        setIsDarkMode(false);
        document.documentElement.setAttribute("data-theme", "light");
      } else {
        setIsDarkMode(true);
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    const themeName = nextDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", themeName);
    try {
      localStorage.setItem("nexora-theme", themeName);
      localStorage.setItem("pulseflow-theme", themeName);
    } catch {
      // Ignore
    }
  };

  const comparisonFeatures = [
    {
      category: "Limits & Quotas",
      items: [
        { name: "Monthly Telemetry Requests", getVal: (p: any) => p.limits.monthlyRequests.toLocaleString() },
        { name: "Isolated Team Workspaces", getVal: (p: any) => p.limits.maxWorkspaces },
        { name: "Team Members per Org", getVal: (p: any) => p.limits.maxTeamMembers },
        { name: "Active API Keys", getVal: (p: any) => p.limits.maxApiKeys },
        { name: "Metrics & Event Retention", getVal: (p: any) => `${p.limits.telemetryRetentionDays} day${p.limits.telemetryRetentionDays > 1 ? "s" : ""}` },
        { name: "Outbound Webhook Endpoints", getVal: (p: any) => p.limits.maxWebhooks },
      ],
    },
    {
      category: "Features & Security",
      items: [
        { name: "JSON & CSV Data Export", getVal: (p: any) => p.entitlements.dataExport },
        { name: "Audit Trail Logging", getVal: (p: any) => p.entitlements.auditLogs },
        { name: "Granular Team RBAC", getVal: (p: any) => p.entitlements.teamCollaboration },
        { name: "Automated Outbound Webhooks", getVal: (p: any) => p.entitlements.customWebhooks },
        { name: "Advanced Percentiles Analytics", getVal: (p: any) => p.entitlements.advancedAnalytics },
        { name: "Priority Support SLA", getVal: (p: any) => p.entitlements.prioritySupport },
        { name: "99.9% / 99.99% Uptime Guarantee", getVal: (p: any) => p.entitlements.slaGuarantee },
        { name: "Dedicated Solutions Architect", getVal: (p: any) => p.entitlements.dedicatedSolutionsArchitect },
      ],
    },
  ];

  const faqs = [
    {
      q: "Can I switch between plans at any time?",
      a: "Yes! Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of the current billing cycle so you never lose what you paid for.",
    },
    {
      q: "What happens if our organization hits our monthly request quota?",
      a: "We never drop your critical telemetry data abruptly. We provide graceful threshold warnings at 80% and 95% usage, with options for automatic overage protection or instant 1-click tier upgrades.",
    },
    {
      q: "Which payment methods are accepted?",
      a: "We accept all major credit and debit cards (Visa, Mastercard, American Express) powered by Stripe. For Enterprise customers, we also support automated ACH transfers and annual invoicing with net-30 terms.",
    },
    {
      q: "Can I cancel my subscription easily?",
      a: "Absolutely. You can schedule cancellation at any time directly in your Dashboard Billing settings with zero hidden fees or cancellation penalties.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <NexoraLogo size="sm" variant="full" theme={isDarkMode ? "dark" : "light"} />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <Link href="/#features" className="hover:text-white transition">Features</Link>
            <Link href="/pricing" className="text-white font-semibold">Pricing</Link>
            <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${isDarkMode ? "Light" : "Dark"} mode`}
              className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-800/80 flex items-center justify-center text-slate-200 transition hover:bg-slate-700"
            >
              {isDarkMode ? <Sun size={15} color="#FBBF24" /> : <Moon size={15} color="#4F46E5" />}
            </button>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-md shadow-indigo-600/25 transition"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="pt-20 pb-12 px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" /> Transparent Enterprise SaaS Pricing
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6">
          Predictable plans for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">every stage of scale</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Start for free on our developer tier. Upgrade seamlessly to higher quotas, enterprise SLA guarantees, and dedicated solution architects as your product grows.
        </p>

        {/* Billing Switcher */}
        <div className="inline-flex items-center p-1.5 rounded-xl border border-slate-800 bg-slate-900 shadow-inner">
          <button
            onClick={() => setBillingInterval("MONTHLY")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
              billingInterval === "MONTHLY"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingInterval("ANNUAL")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
              billingInterval === "ANNUAL"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 items-stretch">
          {plans.map((p) => {
            const isPopular = p.popular;
            const price =
              billingInterval === "ANNUAL"
                ? formatPrice(p.pricing.annualMonthlyEquivalentCents)
                : formatPrice(p.pricing.monthlyCents);

            return (
              <div
                key={p.id}
                className={`relative rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 ${
                  isPopular
                    ? "bg-slate-900/90 border-2 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                    : "bg-slate-900/60 border border-slate-800 hover:border-slate-700"
                }`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/40">
                    {p.badge}
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white">{p.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{p.tagline}</p>
                  </div>

                  <div className="mb-6 pb-6 border-b border-slate-800/80">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">{price}</span>
                      <span className="text-xs text-slate-400">/ mo</span>
                    </div>
                    {billingInterval === "ANNUAL" && p.pricing.annualCents > 0 && (
                      <div className="text-[11px] text-emerald-400 font-medium mt-1">
                        Billed annually ({formatPrice(p.pricing.annualCents)}/yr)
                      </div>
                    )}
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3 mb-8 text-xs text-slate-300">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={`/register?plan=${p.id}&interval=${billingInterval}`}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-center block transition ${
                    isPopular
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  {p.id === "FREE"
                    ? "Get Started Free"
                    : p.id === "ENTERPRISE"
                    ? "Contact Sales"
                    : "Choose Plan"}
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Matrix */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Compare Plan Features & Entitlements</h2>
          <p className="text-slate-400 text-sm">Detailed comparison of quotas, limits, and enterprise capabilities.</p>
        </div>

        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/50 backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="py-4 px-6 font-semibold text-slate-300 w-1/3">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} className="py-4 px-4 font-bold text-center text-slate-200">
                      {p.name.replace("Developer ", "").replace("Team ", "").replace("Scale ", "").replace("Growth ", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((sec, secIdx) => (
                  <React.Fragment key={secIdx}>
                    <tr className="bg-slate-800/40 border-b border-slate-800">
                      <td colSpan={6} className="py-2.5 px-6 font-bold text-xs uppercase tracking-wider text-indigo-400">
                        {sec.category}
                      </td>
                    </tr>
                    {sec.items.map((item, itemIdx) => (
                      <tr key={itemIdx} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                        <td className="py-3 px-6 text-slate-300 font-medium text-xs">{item.name}</td>
                        {plans.map((p) => {
                          const val = item.getVal(p);
                          return (
                            <td key={p.id} className="py-3 px-4 text-center text-xs">
                              {typeof val === "boolean" ? (
                                val ? (
                                  <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                                ) : (
                                  <X className="w-4 h-4 text-slate-600 mx-auto" />
                                )
                              ) : (
                                <span className="font-semibold text-slate-200">{val}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQs Section */}
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Frequently Asked Questions</h2>
          <p className="text-slate-400 text-sm">Everything you need to know about Nexora billing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h4 className="font-bold text-slate-200 text-sm mb-2">{faq.q}</h4>
              <p className="text-slate-400 text-xs leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="border-t border-slate-800/80 bg-gradient-to-b from-slate-900/40 to-slate-950 py-16 px-6 text-center">
        <h3 className="text-2xl font-bold text-white mb-3">Ready to upgrade your telemetry architecture?</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-lg mx-auto">
          Start your free 14-day Pro trial today. No credit card required to get started.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-600 text-slate-300 font-semibold text-sm transition"
          >
            Access Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
