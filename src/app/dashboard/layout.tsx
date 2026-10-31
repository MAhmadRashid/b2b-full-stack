"use client";

import React, { useEffect, useState, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Key,
  Users,
  CreditCard,
  Settings,
  ShieldAlert,
  LogOut,
  ChevronDown,
  Plus,
  Send,
  CheckCircle2,
  Menu,
  X,
  Sparkles,
  Building,
  AlertTriangle,
  Bell,
  Check,
  Layers,
  ArrowRight,
  Sun,
  Moon,
} from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

import {
  DashboardContext,
  useDashboard,
  type WorkspaceInfo,
  type OrganizationInfo,
  type UserInfo,
  type DashboardContextType,
} from "./DashboardContext";
import { NexoraLogo, NexoraIcon } from "@/components/ui/NexoraLogo";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>("");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Sync theme with localStorage or default to dark
  useEffect(() => {
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

  const toggleDashboardTheme = () => {
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
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  // Workspace creation modal
  const [createWorkspaceModal, setCreateWorkspaceModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsPlan, setNewWsPlan] = useState("STARTER");

  // Organization creation modal
  const [createOrgModal, setCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgLogo, setNewOrgLogo] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

  const [testEventToast, setTestEventToast] = useState<string | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSentMessage, setVerificationSentMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [showNotifsDropdown, setShowNotifsDropdown] = useState(false);

  const fetchNotifications = async (wsId?: string) => {
    const targetId = wsId || activeWorkspaceId;
    if (!targetId) return;
    try {
      const res = await fetch(`/api/workspaces/${targetId}/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadNotifsCount(data.unreadCount || 0);
      }
    } catch {
      // Fail silently
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadNotifsCount(0);
      }
    } catch {
      // Fail silently
    }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setUser(data.user);
      const userWorkspaces: WorkspaceInfo[] = data.workspaces || [];
      const userOrgs: OrganizationInfo[] = data.organizations || [];
      setWorkspaces(userWorkspaces);
      setOrganizations(userOrgs);

      // Determine active organization
      let currentOrgId = activeOrgId;
      if (!currentOrgId && userOrgs.length > 0) {
        const savedOrg = localStorage.getItem("pulseflow_active_org");
        const foundOrg = userOrgs.find((o) => o.id === savedOrg);
        currentOrgId = foundOrg ? foundOrg.id : userOrgs[0].id;
        setActiveOrgId(currentOrgId);
      }

      // Determine active workspace
      if (userWorkspaces.length > 0 && !activeWorkspaceId) {
        const savedWs = localStorage.getItem("pulseflow_active_ws");
        const matchingOrgWs = currentOrgId
          ? userWorkspaces.filter((w) => w.organizationId === currentOrgId)
          : userWorkspaces;

        const foundSaved = userWorkspaces.find((w) => w.id === savedWs);
        if (foundSaved && (!currentOrgId || foundSaved.organizationId === currentOrgId)) {
          setActiveWorkspaceId(foundSaved.id);
        } else if (matchingOrgWs.length > 0) {
          setActiveWorkspaceId(matchingOrgWs[0].id);
        } else {
          setActiveWorkspaceId(userWorkspaces[0].id);
        }
      }
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setSendingVerification(true);
    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setVerificationSentMessage("Verification link sent! Check your inbox.");
        setTimeout(() => setVerificationSentMessage(null), 5000);
      } else {
        setVerificationSentMessage(data.error || "Failed to send verification link.");
        setTimeout(() => setVerificationSentMessage(null), 4000);
      }
    } catch {
      setVerificationSentMessage("Network error sending verification link.");
      setTimeout(() => setVerificationSentMessage(null), 4000);
    } finally {
      setSendingVerification(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleSelectOrganization = (orgId: string) => {
    setActiveOrgId(orgId);
    localStorage.setItem("pulseflow_active_org", orgId);
    setOrgMenuOpen(false);

    // Switch active workspace to the first workspace in this organization
    const orgWorkspaces = workspaces.filter((w) => w.organizationId === orgId);
    if (orgWorkspaces.length > 0) {
      handleSelectWorkspace(orgWorkspaces[0].id);
    }
  };

  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    localStorage.setItem("pulseflow_active_ws", id);
    setWorkspaceMenuOpen(false);
    fetchNotifications(id);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWsName.trim(),
          plan: newWsPlan,
          organizationId: activeOrgId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewWsName("");
        setCreateWorkspaceModal(false);
        await fetchSession();
        handleSelectWorkspace(data.workspace.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreatingOrg(true);
    setCreateOrgError(null);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName.trim(),
          logoUrl: newOrgLogo.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewOrgName("");
        setNewOrgLogo("");
        setCreateOrgModal(false);
        await fetchSession();
        handleSelectOrganization(data.organization.id);
        if (data.organization.defaultWorkspaceId) {
          handleSelectWorkspace(data.organization.defaultWorkspaceId);
        }
      } else {
        setCreateOrgError(data.error || "Failed to create organization");
      }
    } catch {
      setCreateOrgError("Network error while creating organization");
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleQuickIngestPing = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "quick_stream_probe",
          source: "dashboard_ui_ping",
        }),
      });
      if (res.ok) {
        setTestEventToast("Telemetry packet emitted and persisted to database!");
        setTimeout(() => setTestEventToast(null), 3500);
        await fetchSession();
      }
    } catch {
      setTestEventToast("Telemetry ping emitted");
      setTimeout(() => setTestEventToast(null), 3000);
    }
  };

  const activeOrganization =
    organizations.find((o) => o.id === activeOrgId) || organizations[0] || null;

  // Workspaces filtered by current active organization (or all if no org)
  const filteredWorkspaces = activeOrganization
    ? workspaces.filter((w) => w.organizationId === activeOrganization.id)
    : workspaces;

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || filteredWorkspaces[0] || workspaces[0] || null;

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-main)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(23, 30, 50, 0.95), rgba(10, 15, 30, 0.98))",
              border: "1px solid rgba(124, 92, 252, 0.35)",
              boxShadow: "0 0 24px rgba(124, 92, 252, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <NexoraIcon size={38} animated={true} withGlow={true} />
          </div>
          <span style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>
            Initializing Workspace Clusters...
          </span>
        </div>
      </div>
    );
  }

  const navLinks = [
    { id: "tour-nav-overview", label: "Overview", href: "/dashboard", icon: Activity },
    { id: "tour-nav-workspaces", label: "Workspaces", href: "/dashboard/workspaces", icon: Layers },
    { id: "tour-nav-analytics", label: "Analytics & Telemetry", href: "/dashboard/analytics", icon: BarChart3 },
    { id: "tour-nav-apikeys", label: "Developer API Keys", href: "/dashboard/api-keys", icon: Key },
    { id: "tour-nav-team", label: "Team & Permissions", href: "/dashboard/team", icon: Users },
    { id: "tour-nav-organization", label: "Organization", href: "/dashboard/organization", icon: Building },
    { id: "tour-nav-billing", label: "Plans & Billing", href: "/dashboard/billing", icon: CreditCard },
    { id: "tour-nav-settings", label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  if (user?.systemRole === "SUPERADMIN") {
    navLinks.push({ id: "tour-nav-admin", label: "Admin Ops Panel", href: "/dashboard/admin", icon: ShieldAlert });
  }

  return (
    <DashboardContext.Provider
      value={{
        user,
        workspaces,
        organizations,
        activeWorkspace,
        activeOrganization,
        setActiveWorkspaceId: handleSelectWorkspace,
        setActiveOrgId: handleSelectOrganization,
        refreshUserData: fetchSession,
      }}
    >
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-main)" }}>
        {/* Desktop Sidebar */}
        <aside
          style={{
            width: "275px",
            background: "var(--bg-surface)",
            borderRight: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            position: "sticky",
            top: 0,
            height: "100vh",
            zIndex: 40,
          }}
          className="desktop-sidebar"
        >
          {/* Logo */}
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <NexoraLogo size="md" variant="full" theme={isDarkMode ? "dark" : "light"} href="/" />
          </div>

          {/* Switchers Section: Organization Switcher & Workspace Switcher */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "10px" }}>
            
            {/* 1. Organization Switcher */}
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.05em" }}>
                Organization
              </div>
              <button
                id="org-switcher-button"
                onClick={() => {
                  setOrgMenuOpen(!orgMenuOpen);
                  setWorkspaceMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "7px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                  {activeOrganization?.logoUrl ? (
                    <img
                      src={activeOrganization.logoUrl}
                      alt=""
                      style={{ width: "18px", height: "18px", borderRadius: "4px", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: "var(--soft-accent-bg, rgba(99, 102, 241, 0.2))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Building size={12} color="var(--accent-indigo)" />
                    </div>
                  )}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeOrganization?.name || "Select Organization"}
                  </span>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" />
              </button>

              {/* Organization Dropdown Menu */}
              {orgMenuOpen && (
                <div
                  className="glass-card"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: "6px",
                    zIndex: 60,
                    padding: "6px",
                    boxShadow: "var(--shadow-lg)",
                    borderRadius: "8px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-medium)",
                  }}
                >
                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {organizations.map((org) => (
                      <div
                        key={org.id}
                        onClick={() => handleSelectOrganization(org.id)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "12.5px",
                          background: org.id === activeOrganization?.id ? "var(--soft-accent-bg, rgba(99, 102, 241, 0.15))" : "transparent",
                          color: org.id === activeOrganization?.id ? "var(--accent-primary)" : "var(--text-secondary)",
                          marginBottom: "2px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                          {org.logoUrl ? (
                            <img src={org.logoUrl} alt="" style={{ width: "16px", height: "16px", borderRadius: "3px", objectFit: "cover" }} />
                          ) : (
                            <Building size={13} color="var(--text-muted)" />
                          )}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org.name}</span>
                        </div>
                        <span className="badge badge-neutral" style={{ fontSize: "9.5px", padding: "1px 5px" }}>{org.role}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "4px", paddingTop: "4px" }}>
                    <button
                      id="btn-new-org-modal"
                      onClick={() => {
                        setOrgMenuOpen(false);
                        setCreateOrgModal(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: "var(--accent-primary)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={13} /> New Organization
                    </button>
                    <Link
                      href="/dashboard/organization"
                      onClick={() => setOrgMenuOpen(false)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        textDecoration: "none",
                      }}
                    >
                      <Settings size={13} /> Organization Settings
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Workspace Switcher */}
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.05em" }}>
                Active Workspace
              </div>
              <button
                id="ws-switcher-button"
                onClick={() => {
                  setWorkspaceMenuOpen(!workspaceMenuOpen);
                  setOrgMenuOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "7px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                  <Layers size={14} color="var(--accent-primary)" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeWorkspace?.name || "Select Workspace"}
                  </span>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" />
              </button>

              {/* Workspace Dropdown Menu */}
              {workspaceMenuOpen && (
                <div
                  className="glass-card"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: "6px",
                    zIndex: 60,
                    padding: "6px",
                    boxShadow: "var(--shadow-lg)",
                    borderRadius: "8px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-medium)",
                  }}
                >
                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {(filteredWorkspaces.length > 0 ? filteredWorkspaces : workspaces).map((w) => (
                      <div
                        key={w.id}
                        onClick={() => handleSelectWorkspace(w.id)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "12.5px",
                          background: w.id === activeWorkspace?.id ? "var(--soft-accent-bg, rgba(99, 102, 241, 0.15))" : "transparent",
                          color: w.id === activeWorkspace?.id ? "var(--accent-primary)" : "var(--text-secondary)",
                          marginBottom: "2px",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                        <span className="badge badge-neutral" style={{ fontSize: "9.5px", padding: "1px 5px" }}>{w.role}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "4px", paddingTop: "4px" }}>
                    <button
                      id="btn-new-ws-modal"
                      onClick={() => {
                        setWorkspaceMenuOpen(false);
                        setCreateWorkspaceModal(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: "var(--accent-cyan)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={13} /> Create Workspace
                    </button>
                    <Link
                      href="/dashboard/workspaces"
                      onClick={() => setWorkspaceMenuOpen(false)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        textDecoration: "none",
                      }}
                    >
                      <Layers size={13} /> Manage Workspaces
                    </Link>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Navigation Links */}
          <nav style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "3px", flexGrow: 1, overflowY: "auto" }}>
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  id={item.id}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "11px",
                    padding: "9px 12px",
                    borderRadius: "7px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: isActive ? (isDarkMode ? "#ffffff" : "#4F46E5") : "var(--text-secondary)",
                    background: isActive ? (isDarkMode ? "rgba(99, 102, 241, 0.15)" : "#EEF2FF") : "transparent",
                    borderLeft: isActive ? "3px solid var(--accent-primary)" : "3px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <Icon size={16} color={isActive ? "var(--accent-primary)" : "var(--text-muted)"} />
                  <span style={{ fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile Footer */}
          <div
            style={{
              padding: "14px 18px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "var(--accent-gradient)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {user?.name?.charAt(0) || "U"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {user?.email}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{ color: "var(--text-muted)", padding: "6px", borderRadius: "6px", transition: "color 0.2s", background: "none", border: "none", cursor: "pointer" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <LogOut size={15} />
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Top Header */}
          <header
            style={{
              height: "64px",
              borderBottom: "1px solid var(--border-subtle)",
              background: isDarkMode ? "rgba(10, 14, 23, 0.82)" : "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 32px",
              position: "sticky",
              top: 0,
              zIndex: 30,
            }}
          >
            {/* Breadcrumb Context: Org / Workspace */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "13px" }}>
                <Building size={14} color="var(--accent-indigo)" />
                <span style={{ fontWeight: 500 }}>{activeOrganization?.name || "Organization"}</span>
                <span style={{ color: "var(--border-medium)" }}>/</span>
              </div>
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {activeWorkspace?.name || "Workspace"}
              </span>
              <span className="badge badge-indigo" style={{ fontSize: "10.5px", padding: "2px 8px" }}>
                {activeWorkspace?.plan || "PLAN"}
              </span>
              <span className="badge badge-neutral" style={{ textTransform: "capitalize", fontSize: "10.5px", padding: "2px 8px" }}>
                {activeWorkspace?.role || "Role"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Quota Indicator */}
              {activeWorkspace && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    background: "var(--bg-card)",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-medium)",
                    fontSize: "12px",
                  }}
                >
                  <Activity size={12} color="var(--accent-primary)" />
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Quota:</span>
                  <span style={{ color: "var(--accent-primary)", fontWeight: 700, letterSpacing: "-0.01em" }}>
                    {activeWorkspace.requestsThisMonth?.toLocaleString()} / {activeWorkspace.monthlyRequestLimit?.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Ping Telemetry Button */}
              <button
                onClick={handleQuickIngestPing}
                className="btn btn-secondary btn-sm"
                title="Send test heartbeat event into active workspace"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  height: "34px",
                  padding: "0 14px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: "1px solid var(--border-medium)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
              >
                <Send size={13} color="var(--accent-primary)" />
                <span>Simulate Ingest</span>
              </button>

              {/* Theme Toggle Button */}
              <button
                id="dashboard-theme-toggle"
                onClick={toggleDashboardTheme}
                aria-label={`Switch to ${isDarkMode ? "Light" : "Dark"} mode`}
                title={`Switch to ${isDarkMode ? "Light" : "Dark"} mode`}
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-medium)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {isDarkMode ? (
                  <Sun size={15} color="#FBBF24" />
                ) : (
                  <Moon size={15} color="#4F46E5" />
                )}
              </button>

              {/* Notifications */}
              <div style={{ position: "relative" }}>
                <button
                  id="tour-nav-notifications"
                  onClick={() => {
                    setShowNotifsDropdown(!showNotifsDropdown);
                    if (!showNotifsDropdown) fetchNotifications();
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{
                    position: "relative",
                    width: "34px",
                    height: "34px",
                    padding: 0,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border-medium)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                  }}
                  title="Notifications & Alerts"
                >
                  <Bell size={15} color={unreadNotifsCount > 0 ? "#f59e0b" : "var(--text-secondary)"} />
                  {unreadNotifsCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-3px",
                        right: "-3px",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {unreadNotifsCount}
                    </span>
                  )}
                </button>

                {showNotifsDropdown && (
                  <div
                    className="glass-card"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: "8px",
                      width: "320px",
                      zIndex: 50,
                      padding: "12px",
                      boxShadow: "var(--shadow-lg)",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-medium)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>Notifications</span>
                      {unreadNotifsCount > 0 && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          style={{ fontSize: "11px", color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer" }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "18px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                        <CheckCircle2 size={24} color="#10b981" style={{ margin: "0 auto 6px", display: "block", opacity: 0.7 }} />
                        All caught up! No unread notifications.
                      </div>
                    ) : (
                      <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                        {notifications.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (n.link) {
                                router.push(n.link);
                                setShowNotifsDropdown(false);
                              }
                            }}
                            style={{
                              padding: "9px 10px",
                              borderRadius: "6px",
                              background: n.read ? "transparent" : (isDarkMode ? "rgba(99, 102, 241, 0.1)" : "#EEF2FF"),
                              borderLeft: n.read ? "2px solid transparent" : "2px solid var(--accent-primary)",
                              marginBottom: "5px",
                              fontSize: "12px",
                              cursor: n.link ? "pointer" : "default",
                              transition: "background 0.15s ease",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "12px" }}>{n.title}</div>
                              <span style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                {new Date(n.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div style={{ color: "var(--text-secondary)", fontSize: "11px", marginTop: "2px", lineHeight: "1.4" }}>
                              {n.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setShowNotifsDropdown(false)}
                        style={{ color: "var(--text-muted)", textDecoration: "none" }}
                      >
                        Notification Preferences
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Test Toast Message */}
          {testEventToast && (
            <div
              style={{
                position: "fixed",
                bottom: "24px",
                right: "24px",
                zIndex: 100,
                padding: "12px 18px",
                background: "#0f172a",
                border: "1px solid #10b981",
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#34d399",
                fontSize: "13.5px",
                fontWeight: 500,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{testEventToast}</span>
            </div>
          )}

          {/* Page Body */}
          <main style={{ padding: "28px 32px", flexGrow: 1 }}>{children}</main>
        </div>

        {/* Modal: Create Workspace */}
        {createWorkspaceModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "20px",
            }}
          >
            <div
              className="glass-card"
              style={{ width: "100%", maxWidth: "440px", padding: "28px", boxShadow: "0 20px 40px rgba(0,0,0,0.8)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <h3 style={{ fontSize: "18px", margin: 0 }}>Create New Workspace</h3>
                <button onClick={() => setCreateWorkspaceModal(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace}>
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label" htmlFor="newWs">Workspace Name</label>
                  <input
                    id="newWs"
                    type="text"
                    required
                    placeholder="e.g. EU Edge Ingress Cluster"
                    className="form-input"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label">Subscription Tier</label>
                  <select
                    className="form-input"
                    value={newWsPlan}
                    onChange={(e) => setNewWsPlan(e.target.value)}
                  >
                    <option value="STARTER">Starter (50,000 monthly requests)</option>
                    <option value="PRO">Pro (250,000 monthly requests)</option>
                    <option value="ENTERPRISE">Enterprise (1,000,000 monthly requests)</option>
                  </select>
                </div>

                {activeOrganization && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
                    Will be created in organization: <strong style={{ color: "var(--text-primary)" }}>{activeOrganization.name}</strong>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={() => setCreateWorkspaceModal(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Create Workspace
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Organization */}
        {createOrgModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "20px",
            }}
          >
            <div
              className="glass-card"
              style={{ width: "100%", maxWidth: "460px", padding: "28px", boxShadow: "0 20px 40px rgba(0,0,0,0.8)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <h3 style={{ fontSize: "18px", margin: 0 }}>Create New Organization</h3>
                <button onClick={() => setCreateOrgModal(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>

              {createOrgError && (
                <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#fca5a5", fontSize: "13px", marginBottom: "16px" }}>
                  {createOrgError}
                </div>
              )}

              <form onSubmit={handleCreateOrganization}>
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label" htmlFor="newOrg">Organization Name *</label>
                  <input
                    id="newOrg"
                    type="text"
                    required
                    placeholder="e.g. Acme Corporation"
                    className="form-input"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label" htmlFor="newOrgLogo">Organization Logo URL (Optional)</label>
                  <input
                    id="newOrgLogo"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    className="form-input"
                    value={newOrgLogo}
                    onChange={(e) => setNewOrgLogo(e.target.value)}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    Image link for your company logo or branding
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={() => setCreateOrgModal(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={creatingOrg} className="btn btn-primary btn-sm">
                    {creatingOrg ? "Creating..." : "Create Organization"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardContext.Provider>
  );
}
