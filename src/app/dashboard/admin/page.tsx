"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../DashboardContext";
import {
  ShieldAlert,
  Server,
  Users,
  Building,
  CreditCard,
  Sliders,
  FileText,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Plus,
  Save,
  Activity,
  DollarSign,
  TrendingUp,
  Briefcase,
  Mail,
  Calendar,
  Phone,
  CheckSquare,
  MessageSquare,
  ExternalLink,
  ArrowRight,
  Bell,
  Check,
} from "lucide-react";

export default function SuperadminPage() {
  const { user } = useDashboard();
  const [activeTab, setActiveTab] = useState<
    "overview" | "crm" | "users" | "organizations" | "subscriptions" | "settings" | "audit"
  >("overview");

  // Overview Data
  const [overviewData, setOverviewData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);

  // Users Data
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("ALL");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");

  // Organizations Data
  const [orgsList, setOrgsList] = useState<any[]>([]);
  const [orgsPagination, setOrgsPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [orgSearch, setOrgSearch] = useState("");
  const [orgPlanFilter, setOrgPlanFilter] = useState("ALL");
  const [orgStatusFilter, setOrgStatusFilter] = useState("ALL");

  // Subscriptions Data
  const [subsList, setSubsList] = useState<any[]>([]);
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [subsPagination, setSubsPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [subTierFilter, setSubTierFilter] = useState("ALL");
  const [subStatusFilter, setSubStatusFilter] = useState("ALL");

  // Settings & Feature Flags Data
  const [settingsList, setSettingsList] = useState<any[]>([]);
  const [newSettingKey, setNewSettingKey] = useState("");
  const [newSettingVal, setNewSettingVal] = useState("");
  const [newSettingCategory, setNewSettingCategory] = useState("FEATURE_FLAG");
  const [newSettingDesc, setNewSettingDesc] = useState("");

  // Audit Logs Data
  const [auditList, setAuditList] = useState<any[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");

  // CRM & Leads Data (Phase 18)
  const [crmSubTab, setCrmSubTab] = useState<"leads" | "demos">("leads");
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [leadsMetrics, setLeadsMetrics] = useState<any>(null);
  const [leadsPagination, setLeadsPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [leadsSearch, setLeadsSearch] = useState("");
  const [leadsStatusFilter, setLeadsStatusFilter] = useState("ALL");
  const [leadsPriorityFilter, setLeadsPriorityFilter] = useState("ALL");
  const [leadsOverdueOnly, setLeadsOverdueOnly] = useState(false);
  const [leadsSortBy, setLeadsSortBy] = useState("createdAt");
  const [leadsSortOrder, setLeadsSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leadDetailLoading, setLeadDetailLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingStatus, setEditingStatus] = useState("NEW");
  const [editingPriority, setEditingPriority] = useState("MEDIUM");
  const [editingFollowUp, setEditingFollowUp] = useState("");
  const [newTimelineNote, setNewTimelineNote] = useState("");
  const [savingLeadChanges, setSavingLeadChanges] = useState(false);

  // Lead Conversion Modal State
  const [convertModalLead, setConvertModalLead] = useState<any | null>(null);
  const [convertPlan, setConvertPlan] = useState<"PRO" | "BUSINESS">("PRO");
  const [convertSubmitting, setConvertSubmitting] = useState(false);

  // Demo Requests Data
  const [demosList, setDemosList] = useState<any[]>([]);
  const [demosStatusFilter, setDemosStatusFilter] = useState("ALL");
  const [demosPendingCount, setDemosPendingCount] = useState(0);

  // Modals & Confirmation States
  const [actionModal, setActionModal] = useState<{
    type: "SUSPEND_USER" | "REACTIVATE_USER" | "SUSPEND_ORG" | "REACTIVATE_ORG" | "CANCEL_SUB" | "REACTIVATE_SUB";
    targetId: string;
    targetName: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionNotification, setActionNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Flash notification helper
  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setActionNotification({ type, message });
    setTimeout(() => setActionNotification(null), 5000);
  };

  // 1. Fetch Overview & Health
  const fetchOverview = async () => {
    try {
      const [resOver, resHealth] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch("/api/health"),
      ]);
      if (resOver.ok) {
        const d = await resOver.json();
        setOverviewData(d);
      }
      if (resHealth.ok) {
        const h = await resHealth.json();
        setHealthData(h);
      }
    } catch (err) {
      console.error("Overview error:", err);
    }
  };

  // 2. Fetch Users
  const fetchUsers = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        search: userSearch,
        status: userStatusFilter,
        role: userRoleFilter,
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const d = await res.json();
        setUsersList(d.users || []);
        setUsersPagination(d.pagination);
      }
    } catch (err) {
      console.error("Users fetch error:", err);
    }
  };

  // 3. Fetch Organizations
  const fetchOrganizations = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        search: orgSearch,
        plan: orgPlanFilter,
        status: orgStatusFilter,
      });
      const res = await fetch(`/api/admin/organizations?${params}`);
      if (res.ok) {
        const d = await res.json();
        setOrgsList(d.organizations || []);
        setOrgsPagination(d.pagination);
      }
    } catch (err) {
      console.error("Orgs fetch error:", err);
    }
  };

  // 4. Fetch Subscriptions & Invoices
  const fetchSubscriptions = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        tier: subTierFilter,
        status: subStatusFilter,
      });
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      if (res.ok) {
        const d = await res.json();
        setSubsList(d.subscriptions || []);
        setInvoicesList(d.recentInvoices || []);
        setSubsPagination(d.pagination);
      }
    } catch (err) {
      console.error("Subscriptions fetch error:", err);
    }
  };

  // 5. Fetch Settings & Feature Flags
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const d = await res.json();
        setSettingsList(d.settings || []);
      }
    } catch (err) {
      console.error("Settings fetch error:", err);
    }
  };

  // 6. Fetch Audit Logs
  const fetchAuditLogs = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        search: auditSearch,
        action: auditActionFilter,
      });
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (res.ok) {
        const d = await res.json();
        setAuditList(d.auditLogs || []);
        setAuditPagination(d.pagination);
      }
    } catch (err) {
      console.error("Audit logs fetch error:", err);
    }
  };

  // 7. Fetch CRM Leads & Metrics (Phase 18)
  const fetchLeads = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        search: leadsSearch,
        status: leadsStatusFilter,
        priority: leadsPriorityFilter,
        overdueOnly: leadsOverdueOnly ? "true" : "false",
        sortBy: leadsSortBy,
        sortOrder: leadsSortOrder,
      });
      const res = await fetch(`/api/admin/leads?${params}`);
      if (res.ok) {
        const d = await res.json();
        setLeadsList(d.leads || []);
        setLeadsMetrics(d.metrics || null);
        setLeadsPagination(d.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || "Failed to load CRM leads", "error");
      }
    } catch (err) {
      console.error("Leads fetch error:", err);
    }
  };

  // 8. Fetch Demo Requests
  const fetchDemoRequests = async () => {
    try {
      const params = new URLSearchParams({
        status: demosStatusFilter,
      });
      const res = await fetch(`/api/admin/demos?${params}`);
      if (res.ok) {
        const d = await res.json();
        setDemosList(d.demoRequests || []);
        setDemosPendingCount(d.pendingCount || 0);
      }
    } catch (err) {
      console.error("Demo requests fetch error:", err);
    }
  };

  // Open Lead Detail
  const openLeadDetail = async (leadId: string) => {
    setLeadDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedLead(d.lead);
        setEditingNotes(d.lead.internalNotes || "");
        setEditingStatus(d.lead.status || "NEW");
        setEditingPriority(d.lead.priority || "MEDIUM");
        setEditingFollowUp(d.lead.followUpDate ? new Date(d.lead.followUpDate).toISOString().slice(0, 10) : "");
        setNewTimelineNote("");
      } else {
        showNotification("Failed to fetch lead details", "error");
      }
    } catch {
      showNotification("Error loading lead record", "error");
    } finally {
      setLeadDetailLoading(false);
    }
  };

  // Save Lead Updates
  const handleSaveLeadUpdates = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedLead) return;
    setSavingLeadChanges(true);
    try {
      const res = await fetch(`/api/admin/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editingStatus,
          priority: editingPriority,
          internalNotes: editingNotes,
          followUpDate: editingFollowUp ? new Date(editingFollowUp).toISOString() : null,
          noteToAdd: newTimelineNote.trim() ? newTimelineNote.trim() : undefined,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        showNotification("Lead details updated successfully", "success");
        setSelectedLead(d.lead);
        setNewTimelineNote("");
        fetchLeads(leadsPagination.page);
      } else {
        showNotification(d.error || "Failed to update lead", "error");
      }
    } catch {
      showNotification("Error saving lead changes", "error");
    } finally {
      setSavingLeadChanges(false);
    }
  };

  // Convert Lead to Customer Workspace
  const handleConvertLead = async () => {
    if (!convertModalLead) return;
    setConvertSubmitting(true);
    try {
      const res = await fetch(`/api/admin/leads/${convertModalLead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: convertPlan,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        showNotification(d.message || "Lead converted successfully!", "success");
        setConvertModalLead(null);
        if (selectedLead?.id === convertModalLead.id) {
          openLeadDetail(convertModalLead.id);
        }
        fetchLeads(leadsPagination.page);
      } else {
        showNotification(d.error || "Conversion failed", "error");
      }
    } catch {
      showNotification("Error executing lead conversion", "error");
    } finally {
      setConvertSubmitting(false);
    }
  };

  // Update Demo Status
  const handleUpdateDemoStatus = async (demoId: string, status: string, notes?: string) => {
    try {
      const res = await fetch(`/api/admin/demos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: demoId, status, notes }),
      });
      const d = await res.json();
      if (res.ok) {
        showNotification("Demo booking request updated", "success");
        fetchDemoRequests();
      } else {
        showNotification(d.error || "Failed to update demo", "error");
      }
    } catch {
      showNotification("Error updating demo status", "error");
    }
  };

  // Master Initializer & Tab Sync
  const loadActiveTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === "overview") await fetchOverview();
      else if (activeTab === "crm") {
        await Promise.all([fetchLeads(1), fetchDemoRequests()]);
      }
      else if (activeTab === "users") await fetchUsers(1);
      else if (activeTab === "organizations") await fetchOrganizations(1);
      else if (activeTab === "subscriptions") await fetchSubscriptions(1);
      else if (activeTab === "settings") await fetchSettings();
      else if (activeTab === "audit") await fetchAuditLogs(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveTabData();
  }, [activeTab]);

  // Execute Sensitive Guarded Actions
  const handleExecuteAction = async () => {
    if (!actionModal) return;
    setSubmittingAction(true);
    try {
      if (actionModal.type === "SUSPEND_USER" || actionModal.type === "REACTIVATE_USER") {
        const action = actionModal.type === "SUSPEND_USER" ? "SUSPEND" : "REACTIVATE";
        const res = await fetch(`/api/admin/users/${actionModal.targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason: actionReason }),
        });
        const data = await res.json();
        if (res.ok) {
          showNotification(data.message, "success");
          fetchUsers(usersPagination.page);
        } else {
          showNotification(data.error || "Action failed", "error");
        }
      } else if (actionModal.type === "SUSPEND_ORG" || actionModal.type === "REACTIVATE_ORG") {
        const action = actionModal.type === "SUSPEND_ORG" ? "SUSPEND" : "REACTIVATE";
        const res = await fetch(`/api/admin/organizations/${actionModal.targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason: actionReason }),
        });
        const data = await res.json();
        if (res.ok) {
          showNotification(data.message, "success");
          fetchOrganizations(orgsPagination.page);
        } else {
          showNotification(data.error || "Action failed", "error");
        }
      } else if (actionModal.type === "CANCEL_SUB" || actionModal.type === "REACTIVATE_SUB") {
        const action = actionModal.type === "CANCEL_SUB" ? "CANCEL_IMMEDIATE" : "REACTIVATE";
        const res = await fetch(`/api/admin/subscriptions/${actionModal.targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason: actionReason }),
        });
        const data = await res.json();
        if (res.ok) {
          showNotification(data.message, "success");
          fetchSubscriptions(subsPagination.page);
        } else {
          showNotification(data.error || "Action failed", "error");
        }
      }
    } catch (err) {
      console.error(err);
      showNotification("A network error occurred while executing action.", "error");
    } finally {
      setSubmittingAction(false);
      setActionModal(null);
      setActionReason("");
    }
  };

  // Toggle Feature Flag or Save Setting
  const handleToggleSetting = async (key: string, currentValue: boolean) => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: !currentValue, category: "FEATURE_FLAG" }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(`Toggled ${key} to ${!currentValue ? "ENABLED" : "DISABLED"}`);
        fetchSettings();
      } else {
        showNotification(data.error || "Failed to update setting", "error");
      }
    } catch {
      showNotification("Failed to save setting", "error");
    }
  };

  const handleCreateCustomSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSettingKey.trim()) return;
    try {
      let val: any = newSettingVal.trim();
      if (val.toLowerCase() === "true") val = true;
      else if (val.toLowerCase() === "false") val = false;
      else if (!isNaN(Number(val)) && val !== "") val = Number(val);

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newSettingKey,
          value: val,
          category: newSettingCategory,
          description: newSettingDesc,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message);
        setNewSettingKey("");
        setNewSettingVal("");
        setNewSettingDesc("");
        fetchSettings();
      } else {
        showNotification(data.error || "Failed to add setting", "error");
      }
    } catch {
      showNotification("Failed to add custom setting", "error");
    }
  };

  // Strict Superadmin Authorization Guard
  if (user?.systemRole !== "SUPERADMIN") {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", maxWidth: "480px", margin: "40px auto" }} className="glass-card">
        <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: "16px" }} />
        <h2 style={{ fontSize: "22px", marginBottom: "8px", fontWeight: 700 }}>Superadmin Access Required</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
          This control panel provides server-wide multi-tenant controls, account suspensions, platform configuration, and cross-organization telemetry. Access is strictly limited to authenticated Superadmin operators.
        </p>
      </div>
    );
  }

  const metrics = overviewData?.metrics;
  const past7Days = overviewData?.charts?.past7Days || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1440px", margin: "0 auto", width: "100%" }}>
      {/* Action Notification Banner */}
      {actionNotification && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13.5px",
            fontWeight: 500,
            background: actionNotification.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${actionNotification.type === "success" ? "#10b981" : "#ef4444"}`,
            color: actionNotification.type === "success" ? "#34d399" : "#f87171",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {actionNotification.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{actionNotification.message}</span>
        </div>
      )}

      {/* Superadmin Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span className="badge badge-success" style={{ fontSize: "11px", letterSpacing: "0.5px" }}>
              SUPERADMIN PRIVILEGED CONSOLE
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Session Operator: <strong style={{ color: "#38bdf8" }}>{user?.email}</strong>
            </span>
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px" }}>Global Platform Management</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "2px" }}>
            Fleet-wide tenant directory, account suspensions, subscription controls, and platform flags.
          </p>
        </div>

        <button onClick={loadActiveTabData} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <RefreshCw size={13} /> Refresh Current Tab
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px", overflowX: "auto" }}>
        {[
          { id: "overview", label: "Fleet Overview", icon: Activity },
          { id: "crm", label: "CRM & Leads", icon: Briefcase },
          { id: "users", label: "Users & Accounts", icon: Users },
          { id: "organizations", label: "Organizations & Tenancy", icon: Building },
          { id: "subscriptions", label: "Subscriptions & Invoices", icon: CreditCard },
          { id: "settings", label: "Platform Flags & Settings", icon: Sliders },
          { id: "audit", label: "Enterprise Audit Logs", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: isActive ? "rgba(99, 102, 241, 0.2)" : "transparent",
                color: isActive ? "#818cf8" : "var(--text-muted)",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={15} color={isActive ? "#818cf8" : "var(--text-muted)"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: FLEET OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Top KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Total Platform Users</span>
                <Users size={17} color="#38bdf8" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>
                {metrics?.totalUsers?.toLocaleString() || 0}
              </div>
              <span style={{ fontSize: "12px", color: "#34d399" }}>Across all tenant tiers</span>
            </div>

            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Organizations</span>
                <Building size={17} color="#6366f1" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>
                {metrics?.totalOrganizations?.toLocaleString() || 0}
              </div>
              <span style={{ fontSize: "12px", color: "#818cf8" }}>{metrics?.totalWorkspaces || 0} active workspaces</span>
            </div>

            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Active Subscriptions</span>
                <CreditCard size={17} color="#10b981" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>
                {metrics?.activeSubscriptions || 0}
              </div>
              <span style={{ fontSize: "12px", color: "#34d399" }}>Paying and active tiers</span>
            </div>

            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Estimated MRR</span>
                <DollarSign size={17} color="#f59e0b" />
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fbbf24" }}>
                {metrics?.mrrFormatted || "$0.00"}
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Total Paid: {metrics?.totalRevenueFormatted || "$0.00"}</span>
            </div>
          </div>

          {/* Real Database 7-Day Activity Chart */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={18} color="#38bdf8" /> Past 7 Days Platform Activity (Real Database Records)
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px", alignItems: "flex-end", height: "160px", padding: "10px 0" }}>
              {past7Days.map((d: any, idx: number) => {
                const maxEvents = Math.max(...past7Days.map((x: any) => x.events), 1);
                const heightPercent = Math.max(15, Math.round((d.events / maxEvents) * 100));
                return (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700 }}>
                      {d.events} ev
                    </div>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "42px",
                        height: `${heightPercent}%`,
                        background: "linear-gradient(180deg, #6366f1 0%, rgba(99, 102, 241, 0.3) 100%)",
                        borderRadius: "6px 6px 2px 2px",
                        border: "1px solid rgba(99, 102, 241, 0.4)",
                      }}
                      title={`${d.date}: ${d.events} events, ${d.users} new users`}
                    />
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {d.date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Runtime Health & Latency */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Server size={17} color="#34d399" /> System Health & Latency Checks
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
              <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "4px" }}>System Status</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#34d399" }}>{healthData?.status || "HEALTHY"}</div>
              </div>
              <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "4px" }}>Database Latency</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#38bdf8" }}>{healthData?.database?.latencyMs ?? 5}ms roundtrip</div>
              </div>
              <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "4px" }}>Process Uptime</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0" }}>{Math.round(healthData?.uptimeSeconds || 0)}s</div>
              </div>
              <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "4px" }}>Total API Keys Active</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#a855f7" }}>{metrics?.activeApiKeys || 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CRM & LEAD MANAGEMENT (Phase 18) */}
      {activeTab === "crm" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* CRM Metric KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div className="glass-card" style={{ padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Total Platform Inquiries</span>
                <Briefcase size={16} color="#38bdf8" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff" }}>
                {leadsMetrics?.totalLeads ?? (leadsPagination?.total || 0)}
              </div>
              <span style={{ fontSize: "11.5px", color: "#38bdf8" }}>All time captured</span>
            </div>

            <div className="glass-card" style={{ padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>New Inquiries</span>
                <Mail size={16} color="#60a5fa" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#60a5fa" }}>
                {leadsMetrics?.newLeads ?? 0}
              </div>
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Awaiting response</span>
            </div>

            <div className="glass-card" style={{ padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Overdue Follow-ups</span>
                <Clock size={16} color="#ef4444" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: (leadsMetrics?.overdueFollowUps || 0) > 0 ? "#f87171" : "#34d399" }}>
                {leadsMetrics?.overdueFollowUps ?? 0}
              </div>
              <span style={{ fontSize: "11.5px", color: (leadsMetrics?.overdueFollowUps || 0) > 0 ? "#f87171" : "var(--text-muted)" }}>
                {(leadsMetrics?.overdueFollowUps || 0) > 0 ? "Requires attention" : "All up to date"}
              </span>
            </div>

            <div className="glass-card" style={{ padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Pending Demo Bookings</span>
                <Calendar size={16} color="#fbbf24" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#fbbf24" }}>
                {leadsMetrics?.pendingDemos ?? demosPendingCount}
              </div>
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Scheduled demos</span>
            </div>

            <div className="glass-card" style={{ padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Converted Customers</span>
                <CheckSquare size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#10b981" }}>
                {leadsMetrics?.converted ?? 0}
              </div>
              <span style={{ fontSize: "11.5px", color: "#34d399" }}>Active SaaS clients</span>
            </div>
          </div>

          {/* Sub Navigation (Leads vs Demos) */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
            <button
              onClick={() => setCrmSubTab("leads")}
              className={`btn btn-sm ${crmSubTab === "leads" ? "btn-primary" : "btn-secondary"}`}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Briefcase size={14} /> Contact Sales Inquiries ({leadsPagination.total})
            </button>
            <button
              onClick={() => setCrmSubTab("demos")}
              className={`btn btn-sm ${crmSubTab === "demos" ? "btn-primary" : "btn-secondary"}`}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Calendar size={14} /> Interactive Demo Bookings ({demosList.length})
              {demosPendingCount > 0 && (
                <span style={{ background: "#f59e0b", color: "#000", fontSize: "10px", padding: "1px 6px", borderRadius: "10px", fontWeight: 700 }}>
                  {demosPendingCount}
                </span>
              )}
            </button>
          </div>

          {/* CRM SUB-TAB 1: LEADS TABLE & FILTERS */}
          {crmSubTab === "leads" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Search & Filter Bar */}
              <div className="glass-card" style={{ padding: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flexGrow: 1, minWidth: "220px" }}>
                  <Search size={15} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search by name, email, company or source..."
                    value={leadsSearch}
                    onChange={(e) => setLeadsSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchLeads(1)}
                    className="input-field"
                    style={{ paddingLeft: "36px" }}
                  />
                </div>

                <select
                  value={leadsStatusFilter}
                  onChange={(e) => {
                    setLeadsStatusFilter(e.target.value);
                    setTimeout(() => fetchLeads(1), 50);
                  }}
                  className="input-field"
                  style={{ width: "auto" }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="CONVERTED">Converted</option>
                  <option value="LOST">Lost</option>
                </select>

                <select
                  value={leadsPriorityFilter}
                  onChange={(e) => {
                    setLeadsPriorityFilter(e.target.value);
                    setTimeout(() => fetchLeads(1), 50);
                  }}
                  className="input-field"
                  style={{ width: "auto" }}
                >
                  <option value="ALL">All Priorities</option>
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>

                <button
                  onClick={() => {
                    const nextVal = !leadsOverdueOnly;
                    setLeadsOverdueOnly(nextVal);
                    setTimeout(() => fetchLeads(1), 50);
                  }}
                  className={`btn btn-sm ${leadsOverdueOnly ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: leadsOverdueOnly ? "rgba(239, 68, 68, 0.2)" : undefined,
                    borderColor: leadsOverdueOnly ? "#ef4444" : undefined,
                    color: leadsOverdueOnly ? "#f87171" : undefined,
                  }}
                >
                  <Clock size={13} /> Overdue Follow-ups Only
                </button>

                <button onClick={() => fetchLeads(1)} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Filter size={13} /> Filter
                </button>
              </div>

              {/* Leads Table */}
              <div className="glass-card" style={{ padding: "20px" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Lead Info</th>
                        <th>Company & Size</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Follow-up Date</th>
                        <th>Submitted</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                            <Briefcase size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                            <div>No leads found matching your criteria.</div>
                          </td>
                        </tr>
                      ) : (
                        leadsList.map((lead) => {
                          const isOverdue = lead.followUpDate && new Date(lead.followUpDate).getTime() < Date.now() && lead.status !== "CONVERTED" && lead.status !== "LOST";
                          return (
                            <tr key={lead.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: "#fff" }}>{lead.name}</div>
                                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{lead.email}</div>
                                {lead.source && (
                                  <span style={{ fontSize: "10.5px", color: "#818cf8", background: "rgba(99, 102, 241, 0.12)", padding: "2px 6px", borderRadius: "4px" }}>
                                    {lead.source}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ color: "#e2e8f0", fontSize: "13.5px" }}>{lead.company || "-"}</div>
                                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{lead.teamSize ? `${lead.teamSize} seats` : "Unknown size"}</div>
                              </td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background:
                                      lead.status === "NEW" ? "rgba(59, 130, 246, 0.18)" :
                                      lead.status === "CONTACTED" ? "rgba(168, 85, 247, 0.18)" :
                                      lead.status === "QUALIFIED" ? "rgba(234, 179, 8, 0.18)" :
                                      lead.status === "CONVERTED" ? "rgba(16, 185, 129, 0.18)" : "rgba(100, 116, 139, 0.18)",
                                    color:
                                      lead.status === "NEW" ? "#60a5fa" :
                                      lead.status === "CONTACTED" ? "#c084fc" :
                                      lead.status === "QUALIFIED" ? "#facc15" :
                                      lead.status === "CONVERTED" ? "#34d399" : "#94a3b8",
                                    border: `1px solid ${
                                      lead.status === "NEW" ? "rgba(59, 130, 246, 0.4)" :
                                      lead.status === "CONTACTED" ? "rgba(168, 85, 247, 0.4)" :
                                      lead.status === "QUALIFIED" ? "rgba(234, 179, 8, 0.4)" :
                                      lead.status === "CONVERTED" ? "rgba(16, 185, 129, 0.4)" : "rgba(100, 116, 139, 0.4)"
                                    }`,
                                    fontSize: "11px",
                                    fontWeight: 700,
                                  }}
                                >
                                  {lead.status}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    color: lead.priority === "HIGH" ? "#f87171" : lead.priority === "MEDIUM" ? "#fbbf24" : "#94a3b8",
                                    background: lead.priority === "HIGH" ? "rgba(239, 68, 68, 0.15)" : lead.priority === "MEDIUM" ? "rgba(245, 158, 11, 0.15)" : "rgba(148, 163, 184, 0.12)",
                                    border: `1px solid ${lead.priority === "HIGH" ? "rgba(239, 68, 68, 0.3)" : lead.priority === "MEDIUM" ? "rgba(245, 158, 11, 0.3)" : "rgba(148, 163, 184, 0.2)"}`,
                                  }}
                                >
                                  {lead.priority}
                                </span>
                              </td>
                              <td>
                                {lead.followUpDate ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: isOverdue ? "#f87171" : "var(--text-secondary)", fontSize: "12.5px", fontWeight: isOverdue ? 700 : 500 }}>
                                    <Clock size={13} color={isOverdue ? "#f87171" : "var(--text-muted)"} />
                                    <span>{new Date(lead.followUpDate).toLocaleDateString()}</span>
                                    {isOverdue && <span style={{ fontSize: "10px", background: "rgba(239, 68, 68, 0.2)", padding: "1px 5px", borderRadius: "3px" }}>OVERDUE</span>}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>None set</span>
                                )}
                              </td>
                              <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                {new Date(lead.createdAt).toLocaleDateString()}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                  <button
                                    onClick={() => openLeadDetail(lead.id)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: "11.5px" }}
                                  >
                                    Manage
                                  </button>
                                  {lead.status !== "CONVERTED" && (
                                    <button
                                      onClick={() => setConvertModalLead(lead)}
                                      className="btn btn-primary btn-sm"
                                      style={{ fontSize: "11.5px", background: "#10b981", borderColor: "#10b981" }}
                                    >
                                      Convert
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-muted)" }}>
                    Showing Page {leadsPagination.page} of {leadsPagination.totalPages} ({leadsPagination.total} leads)
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      disabled={leadsPagination.page <= 1}
                      onClick={() => fetchLeads(leadsPagination.page - 1)}
                      className="btn btn-secondary btn-sm"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <button
                      disabled={leadsPagination.page >= leadsPagination.totalPages}
                      onClick={() => fetchLeads(leadsPagination.page + 1)}
                      className="btn btn-secondary btn-sm"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CRM SUB-TAB 2: DEMO REQUESTS */}
          {crmSubTab === "demos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="glass-card" style={{ padding: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Filter by Status:</span>
                <select
                  value={demosStatusFilter}
                  onChange={(e) => {
                    setDemosStatusFilter(e.target.value);
                    setTimeout(() => fetchDemoRequests(), 50);
                  }}
                  className="input-field"
                  style={{ width: "auto" }}
                >
                  <option value="ALL">All Demo Bookings</option>
                  <option value="SCHEDULED">Scheduled / Pending</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <button onClick={fetchDemoRequests} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              <div className="glass-card" style={{ padding: "20px" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Company & Role</th>
                        <th>Scheduled Date</th>
                        <th>Topics & Message</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demosList.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                            <Calendar size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                            <div>No demo requests found.</div>
                          </td>
                        </tr>
                      ) : (
                        demosList.map((demo) => (
                          <tr key={demo.id}>
                            <td>
                              <div style={{ fontWeight: 600, color: "#fff" }}>{demo.name}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{demo.email}</div>
                            </td>
                            <td>
                              <div style={{ color: "#e2e8f0", fontSize: "13px" }}>{demo.company || "-"}</div>
                              <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{demo.role || "Not specified"}</div>
                            </td>
                            <td>
                              <div style={{ fontSize: "13px", color: "#38bdf8", fontWeight: 600 }}>
                                {new Date(demo.preferredDate).toLocaleDateString()}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                                Booked {new Date(demo.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td style={{ maxWidth: "260px" }}>
                              <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {demo.message || "No specific message"}
                              </div>
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background:
                                    demo.status === "SCHEDULED" ? "rgba(234, 179, 8, 0.18)" :
                                    demo.status === "COMPLETED" ? "rgba(16, 185, 129, 0.18)" : "rgba(239, 68, 68, 0.18)",
                                  color:
                                    demo.status === "SCHEDULED" ? "#facc15" :
                                    demo.status === "COMPLETED" ? "#34d399" : "#f87171",
                                  fontSize: "11px",
                                }}
                              >
                                {demo.status}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                {demo.status === "SCHEDULED" && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateDemoStatus(demo.id, "COMPLETED")}
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: "11.5px", color: "#34d399" }}
                                    >
                                      Mark Completed
                                    </button>
                                    <button
                                      onClick={() => handleUpdateDemoStatus(demo.id, "CANCELLED")}
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: "11.5px", color: "#f87171" }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Filter Bar */}
          <div className="glass-card" style={{ padding: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flexGrow: 1, minWidth: "220px" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search by user name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchUsers(1)}
                className="input-field"
                style={{ paddingLeft: "36px" }}
              />
            </div>

            <select
              value={userStatusFilter}
              onChange={(e) => {
                setUserStatusFilter(e.target.value);
                setTimeout(() => fetchUsers(1), 50);
              }}
              className="input-field"
              style={{ width: "auto" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>

            <select
              value={userRoleFilter}
              onChange={(e) => {
                setUserRoleFilter(e.target.value);
                setTimeout(() => fetchUsers(1), 50);
              }}
              className="input-field"
              style={{ width: "auto" }}
            >
              <option value="ALL">All Roles</option>
              <option value="SUPERADMIN">Superadmins</option>
              <option value="USER">Standard Users</option>
            </select>

            <button onClick={() => fetchUsers(1)} className="btn btn-primary btn-sm">
              <Search size={13} /> Filter
            </button>
          </div>

          {/* Users Table */}
          <div className="glass-card" style={{ padding: "20px" }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Details</th>
                    <th>System Role</th>
                    <th>Account Status</th>
                    <th>Organizations / Workspaces</th>
                    <th>Registered</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                        No users match the active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "#fff" }}>{u.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{u.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${u.systemRole === "SUPERADMIN" ? "badge-success" : "badge-neutral"}`}>
                            {u.systemRole}
                          </span>
                        </td>
                        <td>
                          {u.suspended ? (
                            <div>
                              <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <XCircle size={10} /> Suspended
                              </span>
                              {u.suspensionReason && (
                                <div style={{ fontSize: "11px", color: "#f87171", marginTop: "2px", maxWidth: "200px" }}>
                                  {u.suspensionReason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={10} /> Active
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: "12.5px" }}>
                          <div>{u.organizationCount} orgs, {u.workspaceCount} workspaces</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{u.apiKeysCount} API keys</div>
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {u.suspended ? (
                            <button
                              onClick={() =>
                                setActionModal({
                                  type: "REACTIVATE_USER",
                                  targetId: u.id,
                                  targetName: `${u.name} (${u.email})`,
                                })
                              }
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#34d399" }}
                            >
                              <UserCheck size={13} /> Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setActionModal({
                                  type: "SUSPEND_USER",
                                  targetId: u.id,
                                  targetName: `${u.name} (${u.email})`,
                                })
                              }
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#f87171" }}
                              disabled={u.id === user?.id}
                              title={u.id === user?.id ? "Cannot suspend own account" : "Suspend User"}
                            >
                              <UserX size={13} /> Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "13px" }}>
              <span style={{ color: "var(--text-muted)" }}>
                Showing Page {usersPagination.page} of {usersPagination.totalPages} ({usersPagination.total} total users)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  disabled={usersPagination.page <= 1}
                  onClick={() => fetchUsers(usersPagination.page - 1)}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  disabled={usersPagination.page >= usersPagination.totalPages}
                  onClick={() => fetchUsers(usersPagination.page + 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ORGANIZATIONS MANAGEMENT */}
      {activeTab === "organizations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Search & Filters */}
          <div className="glass-card" style={{ padding: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flexGrow: 1, minWidth: "220px" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search by organization name or slug..."
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchOrganizations(1)}
                className="input-field"
                style={{ paddingLeft: "36px" }}
              />
            </div>

            <select
              value={orgPlanFilter}
              onChange={(e) => {
                setOrgPlanFilter(e.target.value);
                setTimeout(() => fetchOrganizations(1), 50);
              }}
              className="input-field"
              style={{ width: "auto" }}
            >
              <option value="ALL">All Plans</option>
              <option value="FREE">FREE</option>
              <option value="STARTER">STARTER</option>
              <option value="PRO">PRO</option>
              <option value="BUSINESS">BUSINESS</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>

            <select
              value={orgStatusFilter}
              onChange={(e) => {
                setOrgStatusFilter(e.target.value);
                setTimeout(() => fetchOrganizations(1), 50);
              }}
              className="input-field"
              style={{ width: "auto" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <button onClick={() => fetchOrganizations(1)} className="btn btn-primary btn-sm">
              <Search size={13} /> Filter
            </button>
          </div>

          {/* Organizations Table */}
          <div className="glass-card" style={{ padding: "20px" }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Plan Tier</th>
                    <th>Owner Account</th>
                    <th>Status</th>
                    <th>Monthly Requests & Quota</th>
                    <th>Workspaces</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                        No organizations found matching filter.
                      </td>
                    </tr>
                  ) : (
                    orgsList.map((org) => (
                      <tr key={org.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "#fff" }}>{org.name}</div>
                          <span className="code-pill">{org.slug}</span>
                        </td>
                        <td>
                          <span className="badge badge-indigo">{org.plan}</span>
                        </td>
                        <td style={{ fontSize: "12.5px" }}>
                          <div>{org.owner?.name || "System"}</div>
                          <div style={{ color: "var(--text-muted)" }}>{org.owner?.email || "-"}</div>
                        </td>
                        <td>
                          {org.suspended ? (
                            <div>
                              <span className="badge badge-danger">Suspended</span>
                              {org.suspensionReason && (
                                <div style={{ fontSize: "11px", color: "#f87171", marginTop: "2px", maxWidth: "160px" }}>
                                  {org.suspensionReason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="badge badge-success">Active</span>
                          )}
                        </td>
                        <td style={{ fontSize: "12.5px" }}>
                          <div>{org.usage?.requestsThisMonth?.toLocaleString()} / {org.usage?.monthlyLimit?.toLocaleString()}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{org.usage?.percentUsed}% quota used</div>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{org.workspaceCount} Workspaces</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {org.suspended ? (
                            <button
                              onClick={() =>
                                setActionModal({
                                  type: "REACTIVATE_ORG",
                                  targetId: org.id,
                                  targetName: `${org.name} (${org.slug})`,
                                })
                              }
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#34d399" }}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setActionModal({
                                  type: "SUSPEND_ORG",
                                  targetId: org.id,
                                  targetName: `${org.name} (${org.slug})`,
                                })
                              }
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#f87171" }}
                            >
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "13px" }}>
              <span style={{ color: "var(--text-muted)" }}>
                Showing Page {orgsPagination.page} of {orgsPagination.totalPages} ({orgsPagination.total} organizations)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  disabled={orgsPagination.page <= 1}
                  onClick={() => fetchOrganizations(orgsPagination.page - 1)}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  disabled={orgsPagination.page >= orgsPagination.totalPages}
                  onClick={() => fetchOrganizations(orgsPagination.page + 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUBSCRIPTIONS & INVOICES */}
      {activeTab === "subscriptions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Subscriptions Table */}
          <div className="glass-card" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Fleet Subscriptions</h3>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entity / Tenant</th>
                    <th>Tier & Cycle</th>
                    <th>Status</th>
                    <th>Current Period End</th>
                    <th>Billing Email</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                        No subscriptions found.
                      </td>
                    </tr>
                  ) : (
                    subsList.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "#fff" }}>
                            {sub.organization?.name || sub.workspace?.name || "System"}
                          </div>
                          <span className="code-pill">
                            {sub.organization?.slug || sub.workspace?.slug || sub.id}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-indigo">{sub.tier}</span>{" "}
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>({sub.billingCycle})</span>
                        </td>
                        <td>
                          <span className={`badge ${sub.status === "ACTIVE" ? "badge-success" : sub.status === "PAST_DUE" ? "badge-warning" : "badge-danger"}`}>
                            {sub.status}
                          </span>
                          {sub.cancelAtPeriodEnd && (
                            <div style={{ fontSize: "11px", color: "#f87171", marginTop: "2px" }}>Canceling at period end</div>
                          )}
                        </td>
                        <td style={{ fontSize: "12.5px" }}>
                          {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                        </td>
                        <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                          {sub.billingEmail || "-"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {sub.status === "ACTIVE" ? (
                            <button
                              onClick={() =>
                                setActionModal({
                                  type: "CANCEL_SUB",
                                  targetId: sub.id,
                                  targetName: sub.organization?.name || sub.workspace?.name || sub.id,
                                })
                              }
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#f87171" }}
                            >
                              Immediate Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setActionModal({
                                  type: "REACTIVATE_SUB",
                                  targetId: sub.id,
                                  targetName: sub.organization?.name || sub.workspace?.name || sub.id,
                                })
                              }
                              className="btn btn-secondary btn-sm"
                              style={{ color: "#34d399" }}
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historical Invoices */}
          <div className="glass-card" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Recent Invoices & Payment Ledger</h3>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice Number</th>
                    <th>Account / Entity</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Billing Email</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                        No invoice ledger entries recorded.
                      </td>
                    </tr>
                  ) : (
                    invoicesList.map((inv) => (
                      <tr key={inv.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{inv.invoiceNumber}</td>
                        <td>{inv.entityName}</td>
                        <td style={{ fontWeight: 700, color: "#fff" }}>{inv.amountFormatted}</td>
                        <td>
                          <span className={`badge ${inv.status === "PAID" ? "badge-success" : "badge-danger"}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ fontSize: "12.5px" }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                        <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>{inv.billingEmail || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PLATFORM SETTINGS & FEATURE FLAGS */}
      {activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Active Platform Feature Flags */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sliders size={18} color="#6366f1" /> Operational Feature Flags & Toggles
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {settingsList
                .filter((s) => s.category === "FEATURE_FLAG")
                .map((setting) => (
                  <div
                    key={setting.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px",
                      background: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{setting.key}</span>
                        <span className="badge badge-indigo" style={{ fontSize: "10px" }}>{setting.category}</span>
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                        {setting.description}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Updated by {setting.updatedBy || "System"} on {new Date(setting.updatedAt).toLocaleString()}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleSetting(setting.key, !!setting.value)}
                      className={`btn btn-sm ${setting.value ? "btn-primary" : "btn-secondary"}`}
                      style={{ minWidth: "100px" }}
                    >
                      {setting.value ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Configurable Numeric / Text Settings */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Platform System Configuration</h3>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Setting Key</th>
                    <th>Category</th>
                    <th>Value</th>
                    <th>Description</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {settingsList
                    .filter((s) => s.category !== "FEATURE_FLAG")
                    .map((s) => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600, color: "#fff" }}>{s.key}</td>
                        <td>
                          <span className="badge badge-neutral">{s.category}</span>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", color: "#38bdf8" }}>
                          {JSON.stringify(s.value)}
                        </td>
                        <td style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{s.description}</td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {new Date(s.updatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create Custom Platform Setting */}
          <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Plus size={16} color="#34d399" /> Add / Override Platform Setting
            </h3>

            <form onSubmit={handleCreateCustomSetting} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Setting Key</label>
                <input
                  type="text"
                  placeholder="e.g. SRE_ALERT_EMAIL"
                  value={newSettingKey}
                  onChange={(e) => setNewSettingKey(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Value</label>
                <input
                  type="text"
                  placeholder="true, 50, or string"
                  value={newSettingVal}
                  onChange={(e) => setNewSettingVal(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Category</label>
                <select
                  value={newSettingCategory}
                  onChange={(e) => setNewSettingCategory(e.target.value)}
                  className="input-field"
                >
                  <option value="FEATURE_FLAG">FEATURE_FLAG</option>
                  <option value="SECURITY">SECURITY</option>
                  <option value="BILLING">BILLING</option>
                  <option value="GENERAL">GENERAL</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Description</label>
                <input
                  type="text"
                  placeholder="Operational purpose..."
                  value={newSettingDesc}
                  onChange={(e) => setNewSettingDesc(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                  <Save size={14} /> Save Setting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: ENTERPRISE AUDIT LOGS */}
      {activeTab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Audit Search Bar */}
          <div className="glass-card" style={{ padding: "16px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flexGrow: 1, minWidth: "220px" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "11px", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search audit details or user email..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAuditLogs(1)}
                className="input-field"
                style={{ paddingLeft: "36px" }}
              />
            </div>

            <select
              value={auditActionFilter}
              onChange={(e) => {
                setAuditActionFilter(e.target.value);
                setTimeout(() => fetchAuditLogs(1), 50);
              }}
              className="input-field"
              style={{ width: "auto" }}
            >
              <option value="ALL">All Actions</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="USER_SUSPENDED">USER_SUSPENDED</option>
              <option value="USER_REACTIVATED">USER_REACTIVATED</option>
              <option value="ORGANIZATION_SUSPENDED">ORGANIZATION_SUSPENDED</option>
              <option value="ORGANIZATION_REACTIVATED">ORGANIZATION_REACTIVATED</option>
              <option value="SUBSCRIPTION_CANCELED">SUBSCRIPTION_CANCELED</option>
              <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
            </select>

            <button onClick={() => fetchAuditLogs(1)} className="btn btn-primary btn-sm">
              <Search size={13} /> Filter
            </button>
          </div>

          {/* Audit Table */}
          <div className="glass-card" style={{ padding: "20px" }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Operator</th>
                    <th>IP Address</th>
                    <th>Entity</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                        No audit logs found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    auditList.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span className="badge badge-neutral">{log.action}</span>
                        </td>
                        <td style={{ color: "#e2e8f0", maxWidth: "340px", wordBreak: "break-word" }}>{log.details}</td>
                        <td style={{ fontSize: "12.5px" }}>{log.userEmail || "System"}</td>
                        <td style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{log.ipAddress}</td>
                        <td style={{ fontSize: "12.5px" }}>{log.entityName || "-"}</td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "13px" }}>
              <span style={{ color: "var(--text-muted)" }}>
                Showing Page {auditPagination.page} of {auditPagination.totalPages} ({auditPagination.total} audit records)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  disabled={auditPagination.page <= 1}
                  onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  disabled={auditPagination.page >= auditPagination.totalPages}
                  onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sensitive Action Confirmation Modal */}
      {actionModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "20px",
          }}
        >
          <div className="glass-card" style={{ maxWidth: "480px", width: "100%", padding: "26px", borderRadius: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.8)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <AlertTriangle size={24} color="#f87171" />
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Confirm Privileged Action</h3>
            </div>

            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.5" }}>
              You are about to execute <strong>{actionModal.type.replace(/_/g, " ")}</strong> on{" "}
              <strong style={{ color: "#fff" }}>{actionModal.targetName}</strong>. This operation will be recorded in the enterprise audit log.
            </p>

            {actionModal.type.startsWith("SUSPEND") && (
              <div style={{ marginBottom: "18px" }}>
                <label style={{ fontSize: "12.5px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Reason for Suspension (required):
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Terms of service breach, payment default, or security hold..."
                  className="input-field"
                  rows={3}
                  required
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="btn btn-secondary btn-sm"
                disabled={submittingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                className="btn btn-primary btn-sm"
                style={{
                  background: actionModal.type.startsWith("SUSPEND") || actionModal.type.startsWith("CANCEL") ? "#ef4444" : "#10b981",
                  borderColor: actionModal.type.startsWith("SUSPEND") || actionModal.type.startsWith("CANCEL") ? "#ef4444" : "#10b981",
                }}
                disabled={submittingAction || (actionModal.type.startsWith("SUSPEND") && !actionReason.trim())}
              >
                {submittingAction ? "Executing..." : "Confirm & Execute"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lead Detail & Timeline Drawer / Modal (Phase 18) */}
      {selectedLead && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 998,
            padding: "20px",
          }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "28px",
              borderRadius: "14px",
              boxShadow: "0 24px 48px rgba(0,0,0,0.85)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "14px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#fff" }}>{selectedLead.name}</h3>
                  <span
                    className="badge"
                    style={{
                      background:
                        selectedLead.status === "NEW" ? "rgba(59, 130, 246, 0.18)" :
                        selectedLead.status === "CONTACTED" ? "rgba(168, 85, 247, 0.18)" :
                        selectedLead.status === "QUALIFIED" ? "rgba(234, 179, 8, 0.18)" :
                        selectedLead.status === "CONVERTED" ? "rgba(16, 185, 129, 0.18)" : "rgba(100, 116, 139, 0.18)",
                      color:
                        selectedLead.status === "NEW" ? "#60a5fa" :
                        selectedLead.status === "CONTACTED" ? "#c084fc" :
                        selectedLead.status === "QUALIFIED" ? "#facc15" :
                        selectedLead.status === "CONVERTED" ? "#34d399" : "#94a3b8",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {selectedLead.status}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {selectedLead.email} • {selectedLead.company || "Individual"} ({selectedLead.teamSize || "unknown"} team size)
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                {selectedLead.status !== "CONVERTED" && (
                  <button
                    onClick={() => setConvertModalLead(selectedLead)}
                    className="btn btn-primary btn-sm"
                    style={{ background: "#10b981", borderColor: "#10b981", fontSize: "12px" }}
                  >
                    Convert to Customer
                  </button>
                )}
                <button onClick={() => setSelectedLead(null)} className="btn btn-secondary btn-sm">
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Submission Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)", marginBottom: "18px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Source & Acquisition</span>
                <span style={{ fontSize: "13px", color: "#818cf8", fontWeight: 600 }}>{selectedLead.source || "Website Inbound"}</span>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Original Submission Date</span>
                <span style={{ fontSize: "13px", color: "#e2e8f0" }}>{new Date(selectedLead.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Inquiry Message</span>
                <p style={{ fontSize: "13px", color: "#e2e8f0", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px", lineHeight: "1.5", margin: 0 }}>
                  {selectedLead.message || "No custom message entered."}
                </p>
              </div>
            </div>

            {/* Editing Form: Status, Priority, Follow-Up Date, Notes */}
            <form onSubmit={handleSaveLeadUpdates} style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                    Lead Status
                  </label>
                  <select
                    value={editingStatus}
                    onChange={(e) => setEditingStatus(e.target.value)}
                    className="input-field"
                  >
                    <option value="NEW">NEW</option>
                    <option value="CONTACTED">CONTACTED</option>
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="CONVERTED">CONVERTED</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                    Priority
                  </label>
                  <select
                    value={editingPriority}
                    onChange={(e) => setEditingPriority(e.target.value)}
                    className="input-field"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                    Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={editingFollowUp}
                    onChange={(e) => setEditingFollowUp(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Persistent Internal Notes (Shared with Superadmin operators)
                </label>
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="e.g. Lead requested enterprise SOC2 compliance package and 50 seat custom deployment..."
                  className="input-field"
                  rows={3}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  Add Contact Activity / Touchpoint to Timeline:
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={newTimelineNote}
                    onChange={(e) => setNewTimelineNote(e.target.value)}
                    placeholder="e.g. Called lead on phone, agreed to product architecture demo on Thursday..."
                    className="input-field"
                    style={{ flexGrow: 1 }}
                  />
                  <button
                    type="submit"
                    disabled={savingLeadChanges}
                    className="btn btn-primary btn-sm"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {savingLeadChanges ? "Saving..." : "Save Updates"}
                  </button>
                </div>
              </div>
            </form>

            {/* Contact History & Timeline */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "#e2e8f0", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={15} color="#38bdf8" /> Contact History & Audit Timeline
              </h4>

              {(() => {
                let history: any[] = [];
                try {
                  history = typeof selectedLead.contactHistory === "string" ? JSON.parse(selectedLead.contactHistory) : (selectedLead.contactHistory || []);
                } catch {
                  history = [];
                }

                if (history.length === 0) {
                  return <div style={{ fontSize: "12.5px", color: "var(--text-muted)", fontStyle: "italic" }}>No contact history recorded yet.</div>;
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {history.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.02)",
                          borderLeft: "3px solid #6366f1",
                          borderRadius: "4px",
                          fontSize: "12.5px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: "var(--text-muted)", fontSize: "11px" }}>
                          <span>{item.author || "Operator"} • {item.type || "NOTE"}</span>
                          <span>{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <div style={{ color: "#e2e8f0" }}>{item.note}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Convert Lead to Customer Modal (Phase 18) */}
      {convertModalLead && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "20px",
          }}
        >
          <div className="glass-card" style={{ maxWidth: "500px", width: "100%", padding: "26px", borderRadius: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.85)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <CheckSquare size={24} color="#10b981" />
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Convert Qualified Lead</h3>
            </div>

            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.5" }}>
              Convert <strong style={{ color: "#fff" }}>{convertModalLead.name}</strong> ({convertModalLead.email}) into an active customer workspace.
            </p>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "12.5px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                Select Workspace Tier Plan:
              </label>
              <select
                value={convertPlan}
                onChange={(e) => setConvertPlan(e.target.value as any)}
                className="input-field"
              >
                <option value="PRO">PRO Tier (Advanced team workspace)</option>
                <option value="BUSINESS">BUSINESS Tier (Enterprise multi-tenant suite)</option>
              </select>
            </div>

            <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "6px", marginBottom: "20px", fontSize: "12.5px", color: "#34d399" }}>
              This will link or create the customer user, provision an active workspace organization, mark the lead as CONVERTED, and dispatch transactional onboarding details.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setConvertModalLead(null)}
                className="btn btn-secondary btn-sm"
                disabled={convertSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvertLead}
                className="btn btn-primary btn-sm"
                style={{ background: "#10b981", borderColor: "#10b981" }}
                disabled={convertSubmitting}
              >
                {convertSubmitting ? "Converting..." : "Confirm & Convert Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
