"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../DashboardContext";
import Link from "next/link";
import {
  Layers,
  Plus,
  Users,
  Building,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Settings,
  Trash2,
  Edit2,
  ExternalLink,
  Shield,
  Activity,
  ArrowRight,
  UserPlus,
  X,
  UserCheck,
  Check,
  BarChart2,
} from "lucide-react";

interface WorkspaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
  organizationId: string | null;
  subscriptionStatus: string;
  requestsThisMonth: number;
  monthlyRequestLimit: number;
  creator: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  memberCount: number;
  activeKeysCount: number;
  members: WorkspaceMember[];
  createdAt: string;
}

export default function WorkspacesPage() {
  const { activeWorkspace, activeOrganization, setActiveWorkspaceId, refreshUserData, user } = useDashboard();

  const [workspacesList, setWorkspacesList] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter state
  const [filterOrgOnly, setFilterOrgOnly] = useState(true);

  // Create Workspace Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsPlan, setNewWsPlan] = useState("STARTER");
  const [isCreating, setIsCreating] = useState(false);

  // Rename Workspace Modal
  const [renameTarget, setRenameTarget] = useState<WorkspaceItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete Workspace Modal
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Members Management Modal
  const [membersModalTarget, setMembersModalTarget] = useState<WorkspaceItem | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersList, setMembersList] = useState<WorkspaceMember[]>([]);
  const [targetCurrentUserRole, setTargetCurrentUserRole] = useState<string>("VIEWER");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [memberActionSuccess, setMemberActionSuccess] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = filterOrgOnly && activeOrganization?.id
        ? `/api/workspaces?orgId=${activeOrganization.id}`
        : `/api/workspaces`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWorkspacesList(data.workspaces || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to load workspaces");
      }
    } catch {
      setError("Network error loading workspaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [activeOrganization?.id, filterOrgOnly]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWsName.trim(),
          plan: newWsPlan,
          organizationId: activeOrganization?.id || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`Workspace '${data.workspace.name}' successfully created!`);
        setTimeout(() => setSuccess(null), 4000);
        setNewWsName("");
        setShowCreateModal(false);
        await refreshUserData();
        await fetchWorkspaces();
        setActiveWorkspaceId(data.workspace.id);
      } else {
        setError(data.error || "Failed to create workspace");
      }
    } catch {
      setError("Network error while creating workspace");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    setIsRenaming(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`Workspace successfully renamed to '${renameValue.trim()}'`);
        setTimeout(() => setSuccess(null), 4000);
        setRenameTarget(null);
        await refreshUserData();
        await fetchWorkspaces();
      } else {
        setError(data.error || "Failed to rename workspace");
      }
    } catch {
      setError("Network error while renaming workspace");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`Workspace '${deleteTarget.name}' has been deleted.`);
        setTimeout(() => setSuccess(null), 4000);
        setDeleteTarget(null);
        await refreshUserData();
        await fetchWorkspaces();
      } else {
        setError(data.error || "Failed to delete workspace");
      }
    } catch {
      setError("Network error while deleting workspace");
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Workspace Member Management Modal
  const openMembersModal = async (ws: WorkspaceItem) => {
    setMembersModalTarget(ws);
    setMemberActionError(null);
    setMemberActionSuccess(null);
    setMembersLoading(true);

    try {
      const res = await fetch(`/api/workspaces/${ws.id}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembersList(data.members || []);
        setTargetCurrentUserRole(data.currentUserRole || "VIEWER");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    if (!membersModalTarget) return;
    setMemberActionError(null);

    try {
      const res = await fetch(`/api/workspaces/${membersModalTarget.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (res.ok) {
        setMembersList((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
        setMemberActionSuccess("Member role updated successfully.");
        setTimeout(() => setMemberActionSuccess(null), 3000);
        await fetchWorkspaces();
      } else {
        setMemberActionError(data.error || "Failed to update member role");
      }
    } catch {
      setMemberActionError("Network error while updating role");
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!membersModalTarget) return;
    if (!confirm(`Are you sure you want to remove ${email} from this workspace?`)) return;

    setMemberActionError(null);
    try {
      const res = await fetch(`/api/workspaces/${membersModalTarget.id}/members/${memberId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setMembersList((prev) => prev.filter((m) => m.id !== memberId));
        setMemberActionSuccess(`Member ${email} removed.`);
        setTimeout(() => setMemberActionSuccess(null), 3000);
        await fetchWorkspaces();
      } else {
        setMemberActionError(data.error || "Failed to remove member");
      }
    } catch {
      setMemberActionError("Network error while removing member");
    }
  };

  const handleInviteToWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membersModalTarget || !inviteEmail.trim()) return;

    setIsInviting(true);
    setMemberActionError(null);

    try {
      const res = await fetch(`/api/workspaces/${membersModalTarget.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMemberActionSuccess(`Invitation sent to ${inviteEmail.trim()} as ${inviteRole}!`);
        setInviteEmail("");
        setTimeout(() => setMemberActionSuccess(null), 4000);
        await fetchWorkspaces();
      } else {
        setMemberActionError(data.error || "Failed to send invitation");
      }
    } catch {
      setMemberActionError("Network error sending invitation");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner / Alerts */}
      {success && (
        <div
          style={{
            padding: "12px 18px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
            color: "#34d399",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 18px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "#fca5a5",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 800, margin: 0 }}>Team Workspaces</h1>
            {activeOrganization && (
              <span className="badge badge-indigo" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Building size={12} /> {activeOrganization.name}
              </span>
            )}
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
            Manage isolated cluster environments, telemetry partitions, and member access permissions.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {activeOrganization && (
            <button
              onClick={() => setFilterOrgOnly(!filterOrgOnly)}
              className="btn btn-secondary btn-sm"
              title="Toggle organization filter"
            >
              <Building size={14} />
              <span>{filterOrgOnly ? "Viewing Current Org" : "Viewing All Workspaces"}</span>
            </button>
          )}

          <button
            id="btn-create-workspace-page"
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={15} />
            <span>Create Workspace</span>
          </button>
        </div>
      </div>

      {/* Workspaces Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{
                height: "240px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.02)",
                animation: "pulse 1.5s infinite",
              }}
            />
          ))}
        </div>
      ) : workspacesList.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "rgba(99, 102, 241, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers size={28} color="#818cf8" />
          </div>
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px 0" }}>No Workspaces Found</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "420px", margin: 0 }}>
              {filterOrgOnly && activeOrganization
                ? `No workspaces have been provisioned in '${activeOrganization.name}' yet.`
                : "You don't belong to any workspaces yet. Create your first workspace to start streaming telemetry."}
            </p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
            <Plus size={15} /> Create First Workspace
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {workspacesList.map((ws) => {
            const isActive = ws.id === activeWorkspace?.id;
            const canManage = ["OWNER", "ADMIN"].includes(ws.role);
            const isOwner = ws.role === "OWNER";
            const usagePercent = Math.min(100, Math.round((ws.requestsThisMonth / ws.monthlyRequestLimit) * 100));

            return (
              <div
                key={ws.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: "12px",
                  padding: "20px",
                  position: "relative",
                  border: isActive ? "1px solid #6366f1" : "1px solid var(--border-medium)",
                  background: isActive ? "rgba(99, 102, 241, 0.04)" : "var(--bg-surface)",
                  boxShadow: isActive ? "0 0 20px rgba(99, 102, 241, 0.15)" : "none",
                }}
              >
                <div>
                  {/* Top Bar: Name, Badges & Options */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h3 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>{ws.name}</h3>
                        {isActive && (
                          <span
                            className="badge badge-indigo"
                            style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px" }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80" }} />
                            Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                        /{ws.slug}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="badge badge-indigo" style={{ fontSize: "10px" }}>{ws.plan}</span>
                      <span className="badge badge-neutral" style={{ fontSize: "10px" }}>{ws.role}</span>
                    </div>
                  </div>

                  {/* Creator & Creation Date Info */}
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      marginBottom: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Creator:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: "var(--accent-gradient)",
                            fontSize: "10px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                          }}
                        >
                          {ws.creator?.name ? ws.creator.name.charAt(0) : "C"}
                        </div>
                        <span style={{ color: "#fff", fontWeight: 500 }}>
                          {ws.creator?.name || ws.creator?.email || "Workspace Admin"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Created:</span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {new Date(ws.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Quota Progress */}
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", marginBottom: "4px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Monthly Telemetry Usage</span>
                      <span style={{ color: "#38bdf8", fontWeight: 600 }}>{usagePercent}% ({ws.requestsThisMonth.toLocaleString()})</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${usagePercent}%`,
                          height: "100%",
                          background: usagePercent > 85 ? "#f59e0b" : "var(--accent-gradient)",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                  </div>

                  {/* Members Preview */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "-6px" }}>
                      {ws.members.slice(0, 4).map((m, idx) => (
                        <div
                          key={m.id}
                          title={`${m.name || m.email} (${m.role})`}
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "50%",
                            background: "var(--accent-gradient)",
                            border: "2px solid var(--bg-surface)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#fff",
                            marginLeft: idx > 0 ? "-6px" : 0,
                          }}
                        >
                          {m.name ? m.name.charAt(0) : m.email.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {ws.members.length > 4 && (
                        <div
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.1)",
                            border: "2px solid var(--bg-surface)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            color: "var(--text-muted)",
                            marginLeft: "-6px",
                          }}
                        >
                          +{ws.members.length - 4}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => openMembersModal(ws)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "11.5px", padding: "4px 8px" }}
                    >
                      <Users size={12} />
                      <span>{ws.memberCount} Members</span>
                    </button>
                  </div>
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    paddingTop: "12px",
                    borderTop: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  {!isActive ? (
                    <button
                      onClick={() => setActiveWorkspaceId(ws.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "12px" }}
                    >
                      <span>Switch to Workspace</span>
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                      <Check size={14} /> Currently Selected
                    </span>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {canManage && (
                      <button
                        onClick={() => {
                          setRenameTarget(ws);
                          setRenameValue(ws.name);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "6px" }}
                        title="Rename Workspace"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}

                    {isOwner && (
                      <button
                        onClick={() => setDeleteTarget(ws)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "6px", color: "#f87171" }}
                        title="Delete Workspace"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Workspace */}
      {showCreateModal && (
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
              <h3 style={{ fontSize: "18px", margin: 0 }}>Provision New Workspace</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" htmlFor="pageWsName">Workspace Name *</label>
                <input
                  id="pageWsName"
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
                  <option value="STARTER">Starter Tier (50,000 events/mo)</option>
                  <option value="PRO">Pro Tier (250,000 events/mo)</option>
                  <option value="ENTERPRISE">Enterprise Tier (1,000,000 events/mo)</option>
                </select>
              </div>

              {activeOrganization && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Building size={14} color="#818cf8" />
                  <span>Will be grouped under organization: <strong style={{ color: "#fff" }}>{activeOrganization.name}</strong></span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isCreating} className="btn btn-primary btn-sm">
                  {isCreating ? "Provisioning..." : "Provision Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Workspace */}
      {renameTarget && (
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
            style={{ width: "100%", maxWidth: "440px", padding: "28px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "18px", margin: 0 }}>Rename Workspace</h3>
              <button onClick={() => setRenameTarget(null)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRenameWorkspace}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" htmlFor="renameInput">Workspace Name *</label>
                <input
                  id="renameInput"
                  type="text"
                  required
                  className="form-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isRenaming} className="btn btn-primary btn-sm">
                  {isRenaming ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Workspace Confirmation */}
      {deleteTarget && (
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
            style={{ width: "100%", maxWidth: "440px", padding: "28px", border: "1px solid rgba(239, 68, 68, 0.4)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={20} color="#f87171" />
              </div>
              <h3 style={{ fontSize: "18px", margin: 0, color: "#fff" }}>Delete Workspace</h3>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", lineHeight: "1.5", marginBottom: "20px" }}>
              Are you sure you want to permanently delete <strong style={{ color: "#fff" }}>{deleteTarget.name}</strong>? All telemetry data, API keys, and workspace members will be permanently removed.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteWorkspace}
                disabled={isDeleting}
                className="btn btn-sm"
                style={{ background: "#dc2626", color: "#fff" }}
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Workspace Members Management */}
      {membersModalTarget && (
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
            style={{ width: "100%", maxWidth: "600px", padding: "28px", maxHeight: "85vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", margin: 0 }}>Members of {membersModalTarget.name}</h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Configure role-based access for this workspace
                </span>
              </div>
              <button onClick={() => setMembersModalTarget(null)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {memberActionSuccess && (
              <div style={{ padding: "8px 12px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "6px", color: "#34d399", fontSize: "12.5px", marginBottom: "14px" }}>
                {memberActionSuccess}
              </div>
            )}

            {memberActionError && (
              <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", color: "#fca5a5", fontSize: "12.5px", marginBottom: "14px" }}>
                {memberActionError}
              </div>
            )}

            {/* Invite Form */}
            {["OWNER", "ADMIN"].includes(targetCurrentUserRole) && (
              <form onSubmit={handleInviteToWorkspace} style={{ marginBottom: "20px", padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#fff", marginBottom: "8px" }}>
                  Invite New Member to Workspace
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="email"
                    required
                    placeholder="teammate@company.com"
                    className="form-input"
                    style={{ flexGrow: 1, fontSize: "13px" }}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <select
                    className="form-input"
                    style={{ width: "120px", fontSize: "13px" }}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    {targetCurrentUserRole === "OWNER" && <option value="OWNER">Owner</option>}
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button type="submit" disabled={isInviting} className="btn btn-primary btn-sm">
                    {isInviting ? "Sending..." : "Invite"}
                  </button>
                </div>
              </form>
            )}

            {/* Members List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {membersLoading ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>Loading members...</div>
              ) : membersList.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No members found</div>
              ) : (
                membersList.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "10px 14px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                        }}
                      >
                        {m.name ? m.name.charAt(0) : m.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                          {m.name || m.email.split("@")[0]}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.email}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {["OWNER", "ADMIN"].includes(targetCurrentUserRole) && m.userId !== user?.id ? (
                        <>
                          <select
                            className="form-input"
                            style={{ padding: "4px 8px", fontSize: "12px", width: "105px" }}
                            value={m.role}
                            onChange={(e) => handleUpdateMemberRole(m.id, e.target.value)}
                          >
                            {targetCurrentUserRole === "OWNER" && <option value="OWNER">Owner</option>}
                            <option value="ADMIN">Admin</option>
                            <option value="MEMBER">Member</option>
                            <option value="VIEWER">Viewer</option>
                          </select>

                          <button
                            onClick={() => handleRemoveMember(m.id, m.email)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "5px 7px", color: "#f87171" }}
                            title="Remove Member"
                          >
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: "11px" }}>{m.role}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
              <Link
                href="/dashboard/team"
                onClick={() => setMembersModalTarget(null)}
                style={{ fontSize: "12.5px", color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
              >
                <span>Full Team & Permissions Console</span>
                <ArrowRight size={13} />
              </Link>
              <button onClick={() => setMembersModalTarget(null)} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
