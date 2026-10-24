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

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
  plan: string;
  organizationId?: string | null;
  subscriptionStatus: string;
  requestsThisMonth: number;
  monthlyRequestLimit: number;
}

interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
  plan?: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  systemRole: string;
  emailVerified?: string | null;
}

interface DashboardContextType {
  user: UserInfo | null;
  workspaces: WorkspaceInfo[];
  organizations: OrganizationInfo[];
  activeWorkspace: WorkspaceInfo | null;
  setActiveWorkspaceId: (id: string) => void;
  refreshUserData: () => Promise<void>;
}

export const DashboardContext = createContext<DashboardContextType>({
  user: null,
  workspaces: [],
  organizations: [],
  activeWorkspace: null,
  setActiveWorkspaceId: () => {},
  refreshUserData: async () => {},
});

export const useDashboard = () => useContext(DashboardContext);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [createWorkspaceModal, setCreateWorkspaceModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
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
      setWorkspaces(data.workspaces || []);
      setOrganizations(data.organizations || []);

      if (data.workspaces?.length > 0 && !activeWorkspaceId) {
        // Retrieve stored active workspace or default to first
        const savedWs = localStorage.getItem("pulseflow_active_ws");
        const found = data.workspaces.find((w: WorkspaceInfo) => w.id === savedWs);
        setActiveWorkspaceId(found ? found.id : data.workspaces[0].id);
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
        body: JSON.stringify({ name: newWsName.trim() }),
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

  const handleQuickIngestPing = async () => {
    if (!activeWorkspace) return;
    try {
      // Ingest real event via internal request
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

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;

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
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "var(--accent-gradient)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "spin 2s linear infinite",
            }}
          >
            <Activity size={26} color="#ffffff" />
          </div>
          <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Initializing Workspace Clusters...
          </span>
        </div>
      </div>
    );
  }

  const navLinks = [
    { label: "Overview", href: "/dashboard", icon: Activity },
    { label: "Analytics & Telemetry", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "Developer API Keys", href: "/dashboard/api-keys", icon: Key },
    { label: "Team & Permissions", href: "/dashboard/team", icon: Users },
    { label: "Organization", href: "/dashboard/organization", icon: Building },
    { label: "Plans & Billing", href: "/dashboard/billing", icon: CreditCard },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  if (user?.systemRole === "SUPERADMIN") {
    navLinks.push({ label: "Admin Ops Panel", href: "/dashboard/admin", icon: ShieldAlert });
  }

  return (
    <DashboardContext.Provider
      value={{
        user,
        workspaces,
        organizations,
        activeWorkspace,
        setActiveWorkspaceId: handleSelectWorkspace,
        refreshUserData: fetchSession,
      }}
    >
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-main)" }}>
        {/* Desktop Sidebar */}
        <aside
          style={{
            width: "270px",
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
              padding: "20px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: "var(--accent-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 12px rgba(99, 102, 241, 0.4)",
              }}
            >
              <Activity size={20} color="#ffffff" />
            </div>
            <Link href="/" style={{ fontSize: "19px", fontWeight: "800", letterSpacing: "-0.03em" }}>
              Pulse<span className="gradient-text">Flow</span>
            </Link>
          </div>

          {/* Workspace Switcher */}
          <div style={{ padding: "16px 20px", position: "relative" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
              Active Workspace
            </div>
            <button
              onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-medium)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "#fff",
                fontSize: "13.5px",
                fontWeight: 600,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeWorkspace?.name || "Select Workspace"}
              </span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {/* Dropdown Menu */}
            {workspaceMenuOpen && (
              <div
                className="glass-card"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "20px",
                  right: "20px",
                  marginTop: "6px",
                  zIndex: 50,
                  padding: "8px",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.6)",
                }}
              >
                {workspaces.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => handleSelectWorkspace(w.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      background: w.id === activeWorkspace?.id ? "rgba(99, 102, 241, 0.15)" : "transparent",
                      color: w.id === activeWorkspace?.id ? "#818cf8" : "var(--text-secondary)",
                    }}
                  >
                    <span>{w.name}</span>
                    <span className="badge badge-neutral" style={{ fontSize: "10px" }}>{w.role}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "6px", paddingTop: "6px" }}>
                  <button
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      setCreateWorkspaceModal(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "var(--accent-cyan)",
                    }}
                  >
                    <Plus size={14} /> Create Workspace
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: "4px", flexGrow: 1 }}>
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "13.5px",
                    fontWeight: 500,
                    color: isActive ? "#ffffff" : "var(--text-secondary)",
                    background: isActive ? "rgba(99, 102, 241, 0.15)" : "transparent",
                    borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <Icon size={17} color={isActive ? "#818cf8" : "var(--text-muted)"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile Footer */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  background: "var(--accent-gradient)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "13px",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {user?.name?.charAt(0) || "U"}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {user?.email}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{ color: "var(--text-muted)", padding: "6px", borderRadius: "6px", transition: "color 0.2s" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <LogOut size={16} />
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
              background: "rgba(14, 17, 26, 0.7)",
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 28px",
              position: "sticky",
              top: 0,
              zIndex: 30,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>
                {activeWorkspace?.name}
              </span>
              <span className="badge badge-indigo">{activeWorkspace?.plan}</span>
              <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
                Role: {activeWorkspace?.role}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              {/* Quota Indicator */}
              {activeWorkspace && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(255, 255, 255, 0.03)",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Quota:</span>
                  <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                    {activeWorkspace.requestsThisMonth?.toLocaleString()} / {activeWorkspace.monthlyRequestLimit?.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Ping Telemetry Button */}
              <button
                onClick={handleQuickIngestPing}
                className="btn btn-secondary btn-sm"
                title="Send test heartbeat event into active workspace"
              >
                <Send size={13} color="#06b6d4" />
                <span>Simulate Ingest</span>
              </button>

              {/* Live Notifications Bell & Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    setShowNotifsDropdown(!showNotifsDropdown);
                    if (!showNotifsDropdown) fetchNotifications();
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ position: "relative", padding: "7px 10px" }}
                  title="Notifications & Alerts"
                >
                  <Bell size={15} color={unreadNotifsCount > 0 ? "#f59e0b" : "var(--text-secondary)"} />
                  {unreadNotifsCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-4px",
                        right: "-4px",
                        width: "18px",
                        height: "18px",
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
                      {unreadNotifsCount > 9 ? "9+" : unreadNotifsCount}
                    </span>
                  )}
                </button>

                {showNotifsDropdown && (
                  <div
                    className="glass-card"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      width: "360px",
                      zIndex: 100,
                      padding: "16px",
                      boxShadow: "0 16px 36px rgba(0,0,0,0.8)",
                      border: "1px solid var(--border-medium)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        paddingBottom: "8px",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: 700 }}>Notifications</div>
                      {unreadNotifsCount > 0 && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent-indigo)",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            style={{
                              padding: "10px",
                              borderRadius: "6px",
                              background: n.read ? "rgba(255, 255, 255, 0.02)" : "rgba(99, 102, 241, 0.1)",
                              border: n.read ? "1px solid transparent" : "1px solid rgba(99, 102, 241, 0.3)",
                              fontSize: "12px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                              <span style={{ fontWeight: 600, color: n.read ? "var(--text-secondary)" : "#fff" }}>
                                {n.title}
                              </span>
                              <span
                                className={`badge ${
                                  n.type === "WARNING"
                                    ? "badge-warning"
                                    : n.type === "BILLING"
                                    ? "badge-indigo"
                                    : "badge-neutral"
                                }`}
                                style={{ fontSize: "9px", padding: "1px 6px" }}
                              >
                                {n.type}
                              </span>
                            </div>
                            <p style={{ color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{n.message}</p>
                            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px" }}>
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "12.5px" }}>
                          No notifications yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Unverified Email Alert Banner */}
          {user && !user.emailVerified && (
            <div
              style={{
                background: "rgba(234, 179, 8, 0.1)",
                borderBottom: "1px solid rgba(234, 179, 8, 0.25)",
                padding: "10px 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                fontSize: "13px",
                color: "#fde047",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>
                  Your email address <strong style={{ color: "#fff" }}>({user.email})</strong> is unverified.
                  Please check your inbox or request a verification link.
                </span>
              </div>
              <button
                onClick={handleResendVerification}
                disabled={sendingVerification || !!verificationSentMessage}
                className="btn btn-secondary btn-sm"
                style={{
                  background: "rgba(234, 179, 8, 0.15)",
                  borderColor: "rgba(234, 179, 8, 0.35)",
                  color: "#fef08a",
                  fontSize: "12px",
                  padding: "4px 12px",
                }}
              >
                {sendingVerification ? "Sending Link..." : verificationSentMessage || "Resend Verification Email"}
              </button>
            </div>
          )}

          {/* Event Toast alert */}
          {testEventToast && (
            <div
              style={{
                position: "fixed",
                bottom: "24px",
                right: "24px",
                zIndex: 9999,
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
          <main style={{ padding: "32px 36px", flexGrow: 1 }}>{children}</main>
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
                <h3 style={{ fontSize: "18px" }}>Create New Workspace</h3>
                <button onClick={() => setCreateWorkspaceModal(false)} style={{ color: "var(--text-muted)" }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateWorkspace}>
                <div className="form-group">
                  <label className="form-label" htmlFor="newWs">Workspace Name</label>
                  <input
                    id="newWs"
                    type="text"
                    required
                    placeholder="e.g. Starlight Analytics EU"
                    className="form-input"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                  />
                </div>

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
      </div>
    </DashboardContext.Provider>
  );
}
