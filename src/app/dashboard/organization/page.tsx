"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../layout";
import {
  Building,
  Plus,
  Shield,
  Layers,
  Settings,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Users,
  Key,
  X,
  Sparkles,
} from "lucide-react";

interface WorkspaceUnderOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  requestsThisMonth: number;
  monthlyRequestLimit: number;
  memberCount: number;
  activeKeysCount: number;
}

interface OrgMember {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
  members: OrgMember[];
  workspaces: WorkspaceUnderOrg[];
  canManage: boolean;
}

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
  workspaceCount: number;
  createdAt: string;
}

export default function OrganizationPage() {
  const { user, setActiveWorkspaceId, refreshUserData } = useDashboard();
  const [orgList, setOrgList] = useState<OrgSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Rename org modal / state
  const [editName, setEditName] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Create org modal
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // Create workspace in org modal
  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsPlan, setNewWsPlan] = useState("STARTER");
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  const [copiedSlug, setCopiedSlug] = useState(false);

  // 1. Fetch user's organizations
  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        const orgs: OrgSummary[] = data.organizations || [];
        setOrgList(orgs);
        if (orgs.length > 0) {
          // If no org selected yet or currently selected not in list, select first
          const exists = orgs.find((o) => o.id === selectedOrgId);
          const defaultId = exists ? exists.id : orgs[0].id;
          setSelectedOrgId(defaultId);
          await loadOrgDetail(defaultId);
        } else {
          setOrgDetail(null);
        }
      } else {
        setError("Unable to load organizations");
      }
    } catch {
      setError("Network error loading organizations");
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch specific organization details
  const loadOrgDetail = async (orgId: string) => {
    try {
      setDetailLoading(true);
      setError(null);
      const res = await fetch(`/api/organizations/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setOrgDetail(data.organization);
        setEditName(data.organization.name);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to load organization details");
      }
    } catch {
      setError("Network error loading organization details");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    loadOrgDetail(orgId);
  };

  // 3. Handle Org Update
  const handleUpdateOrgName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !editName.trim()) return;

    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Organization name updated successfully!");
        setTimeout(() => setSuccess(null), 3000);
        setIsEditing(false);
        await fetchOrganizations();
        await refreshUserData();
      } else {
        setError(data.error || "Failed to update organization");
      }
    } catch {
      setError("Network error updating organization");
    }
  };

  // 4. Handle Create New Org
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setIsCreatingOrg(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Organization "${data.organization.name}" created!`);
        setTimeout(() => setSuccess(null), 3000);
        setShowCreateOrgModal(false);
        setNewOrgName("");
        await fetchOrganizations();
        setSelectedOrgId(data.organization.id);
        await loadOrgDetail(data.organization.id);
        await refreshUserData();
      } else {
        setError(data.error || "Failed to create organization");
      }
    } catch {
      setError("Network error creating organization");
    } finally {
      setIsCreatingOrg(false);
    }
  };

  // 5. Handle Provision Workspace in Org
  const handleCreateWorkspaceInOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newWsName.trim()) return;

    setIsCreatingWs(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWsName.trim(), plan: newWsPlan }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Workspace "${data.workspace.name}" provisioned under this organization!`);
        setTimeout(() => setSuccess(null), 3500);
        setShowCreateWsModal(false);
        setNewWsName("");
        await loadOrgDetail(selectedOrgId);
        await refreshUserData();
      } else {
        setError(data.error || "Failed to create workspace");
      }
    } catch {
      setError("Network error creating workspace");
    } finally {
      setIsCreatingWs(false);
    }
  };

  // 6. Handle Delete Org
  const handleDeleteOrg = async () => {
    if (!selectedOrgId || !orgDetail) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete organization "${orgDetail.name}"? All associated workspaces will be unlinked.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Organization deleted successfully.");
        setTimeout(() => setSuccess(null), 3000);
        await fetchOrganizations();
        await refreshUserData();
      } else {
        setError(data.error || "Failed to delete organization");
      }
    } catch {
      setError("Network error deleting organization");
    }
  };

  const copySlug = () => {
    if (orgDetail?.slug) {
      navigator.clipboard.writeText(orgDetail.slug);
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Loading organization clusters and access permissions...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", maxWidth: "1200px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Organization & Multi-Workspace Hub</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Oversee tenant hierarchies, multi-cluster workspace deployments, and organization-wide governance
          </p>
        </div>

        <button
          onClick={() => setShowCreateOrgModal(true)}
          className="btn btn-primary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Plus size={16} /> Create Organization
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "#fca5a5",
            fontSize: "13.5px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
            color: "#34d399",
            fontSize: "13.5px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Empty State: No Orgs */}
      {orgList.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: "60px 24px",
            textAlign: "center",
            border: "1px dashed rgba(255, 255, 255, 0.15)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "rgba(99, 102, 241, 0.12)",
              color: "var(--accent-indigo)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <Building size={28} />
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
            No Organizations Configured
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "14px",
              maxWidth: "480px",
              margin: "0 auto 24px auto",
            }}
          >
            Create an organization to group multiple workspaces, manage team members at the enterprise level,
            and enforce cross-workspace RBAC governance.
          </p>
          <button
            onClick={() => setShowCreateOrgModal(true)}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={16} /> Create Your First Organization
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px", alignItems: "start" }}>
          {/* Left Column: Organization List / Selector */}
          <div className="glass-card" style={{ padding: "16px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "12px",
                paddingLeft: "4px",
              }}
            >
              Your Organizations ({orgList.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {orgList.map((org) => {
                const isSelected = org.id === selectedOrgId;
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      textAlign: "left",
                      background: isSelected ? "rgba(99, 102, 241, 0.15)" : "transparent",
                      border: isSelected ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent",
                      color: isSelected ? "#fff" : "var(--text-secondary)",
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: isSelected ? "#fff" : "var(--text-primary)" }}>
                        {org.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {org.workspaceCount} {org.workspaceCount === 1 ? "workspace" : "workspaces"}
                      </div>
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: "10px" }}>
                      {org.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Organization Details */}
          {detailLoading ? (
            <div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                Loading organization details...
              </span>
            </div>
          ) : orgDetail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Org Summary Card */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: "var(--accent-gradient)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                      }}
                    >
                      <Building size={24} />
                    </div>
                    <div>
                      {isEditing ? (
                        <form onSubmit={handleUpdateOrgName} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="form-input"
                            style={{ padding: "6px 10px", fontSize: "16px", fontWeight: 700 }}
                            required
                          />
                          <button type="submit" className="btn btn-primary btn-sm">
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditing(false);
                              setEditName(orgDetail.name);
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <h2 style={{ fontSize: "20px", fontWeight: 800 }}>{orgDetail.name}</h2>
                          {orgDetail.canManage && (
                            <button
                              onClick={() => setIsEditing(true)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "2px 8px", fontSize: "11px" }}
                            >
                              Rename
                            </button>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {orgDetail.slug}
                        </span>
                        <button
                          onClick={copySlug}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                          title="Copy Slug"
                        >
                          {copiedSlug ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="badge badge-indigo" style={{ fontSize: "12px" }}>
                      Your Role: {orgDetail.role}
                    </span>
                    {orgDetail.role === "OWNER" && (
                      <button
                        onClick={handleDeleteOrg}
                        className="btn btn-danger btn-sm"
                        style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
                        title="Delete organization"
                      >
                        <Trash2 size={13} /> Delete Org
                      </button>
                    )}
                  </div>
                </div>

                {/* Org Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Total Workspaces</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "2px" }}>
                      {orgDetail.workspaces?.length || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Organization Members</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "2px" }}>
                      {orgDetail.members?.length || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Created On</div>
                    <div style={{ fontSize: "14px", fontWeight: 500, marginTop: "4px", color: "var(--text-secondary)" }}>
                      {new Date(orgDetail.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Workspaces Section */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: 700 }}>Attached Workspaces</h3>
                    <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Workspaces hosted under {orgDetail.name}
                    </p>
                  </div>

                  {orgDetail.canManage && (
                    <button
                      onClick={() => setShowCreateWsModal(true)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Plus size={14} /> New Workspace
                    </button>
                  )}
                </div>

                {orgDetail.workspaces && orgDetail.workspaces.length > 0 ? (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Workspace</th>
                          <th>Tier Plan</th>
                          <th>Members</th>
                          <th>Active Keys</th>
                          <th>Monthly Quota</th>
                          <th style={{ textAlign: "right" }}>Switch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgDetail.workspaces.map((ws) => (
                          <tr key={ws.id}>
                            <td>
                              <div style={{ fontWeight: 600, color: "#fff" }}>{ws.name}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                {ws.slug}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-neutral" style={{ fontSize: "11px" }}>
                                {ws.plan}
                              </span>
                            </td>
                            <td style={{ fontSize: "13px" }}>{ws.memberCount}</td>
                            <td style={{ fontSize: "13px" }}>{ws.activeKeysCount}</td>
                            <td style={{ fontSize: "12.5px", color: "var(--accent-cyan)", fontFamily: "monospace" }}>
                              {ws.requestsThisMonth.toLocaleString()} / {ws.monthlyRequestLimit.toLocaleString()}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                onClick={() => {
                                  setActiveWorkspaceId(ws.id);
                                  setSuccess(`Switched to active workspace: ${ws.name}`);
                                  setTimeout(() => setSuccess(null), 2500);
                                }}
                                className="btn btn-primary btn-sm"
                                style={{ padding: "4px 10px", fontSize: "11.5px" }}
                              >
                                Activate
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", fontSize: "13px" }}>
                    No workspaces yet provisioned under this organization.
                  </div>
                )}
              </div>

              {/* Organization Members Section */}
              <div className="glass-card" style={{ padding: "24px" }}>
                <div style={{ marginBottom: "18px" }}>
                  <h3 style={{ fontSize: "17px", fontWeight: 700 }}>Organization Members & Governance</h3>
                  <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Users with direct organization-level governance authority
                  </p>
                </div>

                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Organization Role</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgDetail.members?.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: "#fff" }}>{m.name || "Org Collaborator"}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{m.email}</div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                m.role === "OWNER"
                                  ? "badge-indigo"
                                  : m.role === "ADMIN"
                                  ? "badge-success"
                                  : "badge-neutral"
                              }`}
                              style={{ fontSize: "11px" }}
                            >
                              {m.role}
                            </span>
                          </td>
                          <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                            {new Date(m.joinedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Modal: Create Organization */}
      {showCreateOrgModal && (
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
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-card" style={{ width: "100%", maxWidth: "440px", padding: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
              }}
            >
              <h3 style={{ fontSize: "18px" }}>Create Organization</h3>
              <button
                onClick={() => setShowCreateOrgModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrg}>
              <div className="form-group">
                <label className="form-label" htmlFor="newOrg">
                  Organization Name *
                </label>
                <input
                  id="newOrg"
                  type="text"
                  required
                  placeholder="e.g. Acme Global Enterprises"
                  className="form-input"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateOrgModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrg}
                  className="btn btn-primary btn-sm"
                >
                  {isCreatingOrg ? "Creating..." : "Create Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Workspace in Org */}
      {showCreateWsModal && (
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
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-card" style={{ width: "100%", maxWidth: "440px", padding: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
              }}
            >
              <h3 style={{ fontSize: "18px" }}>New Workspace in Organization</h3>
              <button
                onClick={() => setShowCreateWsModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspaceInOrg}>
              <div className="form-group">
                <label className="form-label" htmlFor="wsNameInOrg">
                  Workspace Name *
                </label>
                <input
                  id="wsNameInOrg"
                  type="text"
                  required
                  placeholder="e.g. North America Edge Fleet"
                  className="form-input"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="wsPlanInOrg">
                  Plan Tier
                </label>
                <select
                  id="wsPlanInOrg"
                  className="form-input"
                  value={newWsPlan}
                  onChange={(e) => setNewWsPlan(e.target.value)}
                >
                  <option value="STARTER">STARTER (50k events/mo)</option>
                  <option value="PRO">PRO (250k events/mo)</option>
                  <option value="ENTERPRISE">ENTERPRISE (1M events/mo)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateWsModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWs}
                  className="btn btn-primary btn-sm"
                >
                  {isCreatingWs ? "Provisioning..." : "Provision Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
