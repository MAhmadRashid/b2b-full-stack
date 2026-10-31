"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../DashboardContext";
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
  ArrowRight,
  Mail,
  UserCheck,
  Clock,
  RefreshCw,
  Image as ImageIcon,
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
  creator?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt?: string;
}

interface OrgMember {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface OrgPendingInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  createdAt: string;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  ownerId?: string | null;
  owner?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  role: string;
  isOwner: boolean;
  createdAt: string;
  members: OrgMember[];
  workspaces: WorkspaceUnderOrg[];
  pendingInvitations: OrgPendingInvitation[];
  canManage: boolean;
}

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  role: string;
  memberCount: number;
  workspaceCount: number;
  createdAt: string;
}

export default function OrganizationPage() {
  const { user, setActiveWorkspaceId, refreshUserData, activeOrganization, setActiveOrgId } = useDashboard();
  const [orgList, setOrgList] = useState<OrgSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit organization modal / state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Transfer ownership modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Create org modal
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgLogo, setNewOrgLogo] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // Create workspace in org modal
  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsPlan, setNewWsPlan] = useState("STARTER");
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  // Invite member to org modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  const [copiedSlug, setCopiedSlug] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

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
          const defaultId = activeOrganization?.id && orgs.some((o) => o.id === activeOrganization.id)
            ? activeOrganization.id
            : orgs[0].id;
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
        setEditLogoUrl(data.organization.logoUrl || "");
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
    setActiveOrgId(orgId);
    loadOrgDetail(orgId);
  };

  // 3. Handle Organization Settings Update
  const handleUpdateOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !editName.trim()) return;

    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          logoUrl: editLogoUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Organization settings saved successfully!");
        setTimeout(() => setSuccess(null), 3000);
        setIsEditing(false);
        await loadOrgDetail(selectedOrgId);
        await fetchOrganizations();
        await refreshUserData();
      } else {
        setError(data.error || "Failed to update organization");
      }
    } catch {
      setError("Network error updating organization");
    } finally {
      setIsUpdating(false);
    }
  };

  // 4. Handle Transfer Ownership
  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !transferTargetUserId) return;

    setIsTransferring(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: transferTargetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Ownership successfully transferred!");
        setTimeout(() => setSuccess(null), 4000);
        setShowTransferModal(false);
        await loadOrgDetail(selectedOrgId);
        await fetchOrganizations();
        await refreshUserData();
      } else {
        setError(data.error || "Failed to transfer ownership");
      }
    } catch {
      setError("Network error transferring ownership");
    } finally {
      setIsTransferring(false);
    }
  };

  // 5. Handle Create New Org
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setIsCreatingOrg(true);
    setError(null);
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
        setSuccess(`Organization "${data.organization.name}" created!`);
        setTimeout(() => setSuccess(null), 3000);
        setShowCreateOrgModal(false);
        setNewOrgName("");
        setNewOrgLogo("");
        await fetchOrganizations();
        setSelectedOrgId(data.organization.id);
        setActiveOrgId(data.organization.id);
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

  // 6. Handle Invite Member to Org
  const handleInviteToOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !inviteEmail.trim()) return;

    setIsInviting(true);
    setError(null);
    setCreatedInviteUrl(null);
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Invitation generated for ${inviteEmail.trim()}!`);
        setCreatedInviteUrl(data.invitation.inviteUrl);
        setInviteEmail("");
        setTimeout(() => setSuccess(null), 4000);
        await loadOrgDetail(selectedOrgId);
      } else {
        setError(data.error || "Failed to create invitation");
      }
    } catch {
      setError("Network error creating invitation");
    } finally {
      setIsInviting(false);
    }
  };

  // 7. Handle Update Member Role
  const handleUpdateMemberRole = async (memberId: string, role: string) => {
    if (!selectedOrgId) return;
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Member role updated!");
        setTimeout(() => setSuccess(null), 3000);
        await loadOrgDetail(selectedOrgId);
      } else {
        setError(data.error || "Failed to update role");
      }
    } catch {
      setError("Network error updating role");
    }
  };

  // 8. Handle Remove Member
  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!selectedOrgId) return;
    if (!confirm(`Are you sure you want to remove ${email} from this organization?`)) return;

    setError(null);
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/members/${memberId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Removed ${email} from organization.`);
        setTimeout(() => setSuccess(null), 3000);
        await loadOrgDetail(selectedOrgId);
      } else {
        setError(data.error || "Failed to remove member");
      }
    } catch {
      setError("Network error removing member");
    }
  };

  // 9. Handle Resend Invitation
  const handleResendInvite = async (invitationId: string) => {
    if (!selectedOrgId) return;
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/members/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Invitation refreshed and validity extended!");
        setTimeout(() => setSuccess(null), 3500);
        await loadOrgDetail(selectedOrgId);
      } else {
        setError(data.error || "Failed to renew invitation");
      }
    } catch {
      setError("Network error renewing invitation");
    }
  };

  // 10. Handle Revoke Invitation
  const handleRevokeInvite = async (invitationId: string) => {
    if (!selectedOrgId) return;
    if (!confirm("Revoke this pending invitation?")) return;

    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/members?invitationId=${invitationId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Invitation revoked.");
        setTimeout(() => setSuccess(null), 3000);
        await loadOrgDetail(selectedOrgId);
      } else {
        setError(data.error || "Failed to revoke invitation");
      }
    } catch {
      setError("Network error revoking invitation");
    }
  };

  // 11. Handle Provision Workspace in Org
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

  // 12. Handle Delete Org
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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Top Alerts */}
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
          <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 4px 0" }}>Organizations & Governance</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
            Oversee tenant hierarchies, multi-cluster workspace deployments, and organization-wide governance.
          </p>
        </div>

        <button
          id="btn-create-org-top"
          onClick={() => setShowCreateOrgModal(true)}
          className="btn btn-primary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Plus size={16} /> Create Organization
        </button>
      </div>

      {/* Organization Switcher Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "4px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {orgList.map((org) => {
          const isSelected = org.id === selectedOrgId;
          return (
            <button
              key={org.id}
              onClick={() => handleSelectOrg(org.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: isSelected ? "rgba(99, 102, 241, 0.15)" : "transparent",
                border: isSelected ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                color: isSelected ? "#fff" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {org.logoUrl ? (
                <img src={org.logoUrl} alt="" style={{ width: "18px", height: "18px", borderRadius: "4px", objectFit: "cover" }} />
              ) : (
                <Building size={14} color={isSelected ? "#818cf8" : "var(--text-muted)"} />
              )}
              <span>{org.name}</span>
              <span className="badge badge-neutral" style={{ fontSize: "10px", padding: "1px 5px" }}>{org.role}</span>
            </button>
          );
        })}
      </div>

      {/* Organization Content */}
      {detailLoading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
          Loading organization details...
        </div>
      ) : !orgDetail ? (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          <h3>No Organization Selected</h3>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Organization Overview Card */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {orgDetail.logoUrl ? (
                  <img
                    src={orgDetail.logoUrl}
                    alt={orgDetail.name}
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "12px",
                      objectFit: "cover",
                      border: "1px solid var(--border-medium)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "12px",
                      background: "rgba(99, 102, 241, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    <Building size={28} color="#818cf8" />
                  </div>
                )}

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>{orgDetail.name}</h2>
                    <span className="badge badge-indigo">{orgDetail.role}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px", fontSize: "12.5px", color: "var(--text-muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>slug:</span>
                      <code style={{ color: "#38bdf8" }}>{orgDetail.slug}</code>
                      <button onClick={copySlug} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                        {copiedSlug ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                      </button>
                    </span>
                    <span>&bull;</span>
                    <span>Created: {new Date(orgDetail.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {orgDetail.canManage && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Settings size={14} /> Organization Settings
                  </button>
                )}

                {orgDetail.isOwner && (
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="btn btn-secondary btn-sm"
                    title="Transfer ownership of organization"
                  >
                    <Shield size={14} /> Transfer Ownership
                  </button>
                )}

                {orgDetail.isOwner && (
                  <button
                    onClick={handleDeleteOrg}
                    className="btn btn-secondary btn-sm"
                    style={{ color: "#f87171" }}
                    title="Delete Organization"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Owner Details Bar */}
            <div
              style={{
                marginTop: "20px",
                padding: "12px 16px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)" }}>Organization Owner:</span>
                <strong style={{ color: "#fff" }}>{orgDetail.owner?.name || orgDetail.owner?.email || "Founder"}</strong>
                <span style={{ color: "var(--text-muted)" }}>({orgDetail.owner?.email})</span>
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                {orgDetail.workspaces.length} Workspaces &bull; {orgDetail.members.length} Members
              </div>
            </div>
          </div>

          {/* Organization Workspaces Section */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 2px 0" }}>Workspaces in this Organization</h3>
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                  Each workspace provides isolated metrics, members, and API key policies
                </span>
              </div>

              {orgDetail.canManage && (
                <button
                  onClick={() => setShowCreateWsModal(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Plus size={14} /> Add Workspace
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {orgDetail.workspaces.map((ws) => (
                <div
                  key={ws.id}
                  style={{
                    padding: "16px",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-medium)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontWeight: 700, fontSize: "15px", color: "#fff" }}>{ws.name}</div>
                      <span className="badge badge-indigo" style={{ fontSize: "10px" }}>{ws.plan}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      /{ws.slug}
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" }}>
                      {ws.memberCount} members &bull; {ws.requestsThisMonth?.toLocaleString()} requests this cycle
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid var(--border-subtle)" }}>
                    <button
                      onClick={() => setActiveWorkspaceId(ws.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "11.5px" }}
                    >
                      Set as Active
                    </button>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Limit: {ws.monthlyRequestLimit?.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Organization Members & Roles */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 2px 0" }}>Organization Members & Roles</h3>
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                  Assign organizational governance roles across all workspace clusters
                </span>
              </div>

              {orgDetail.canManage && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Users size={14} /> Invite Team Member
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {orgDetail.members.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "var(--accent-gradient)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "13px",
                        color: "#fff",
                      }}
                    >
                      {m.name ? m.name.charAt(0) : m.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13.5px", color: "#fff" }}>
                        {m.name || m.email.split("@")[0]}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{m.email}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {orgDetail.canManage && m.userId !== user?.id ? (
                      <>
                        <select
                          className="form-input"
                          style={{ padding: "4px 8px", fontSize: "12px", width: "110px" }}
                          value={m.role}
                          onChange={(e) => handleUpdateMemberRole(m.id, e.target.value)}
                        >
                          {orgDetail.isOwner && <option value="OWNER">Owner</option>}
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                          <option value="VIEWER">Viewer</option>
                        </select>

                        <button
                          onClick={() => handleRemoveMember(m.id, m.email)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: "#f87171", padding: "5px 7px" }}
                          title="Remove Member"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <span className="badge badge-neutral">{m.role}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Invitations Section */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 2px 0" }}>Pending Invitations</h3>
              <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                Invitations sent to email addresses awaiting acceptance
              </span>
            </div>

            {orgDetail.pendingInvitations.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                No pending invitations for this organization.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {orgDetail.pendingInvitations.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 600, color: "#fff", fontSize: "13.5px" }}>{inv.email}</span>
                        <span className="badge badge-neutral" style={{ fontSize: "10px" }}>{inv.role}</span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                        Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/invite/${inv.token}`
                          );
                          setCopiedInviteId(inv.id);
                          setTimeout(() => setCopiedInviteId(null), 2000);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: "12px" }}
                      >
                        {copiedInviteId === inv.id ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                        <span>{copiedInviteId === inv.id ? "Copied Link" : "Copy Link"}</span>
                      </button>

                      {orgDetail.canManage && (
                        <>
                          <button
                            onClick={() => handleResendInvite(inv.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "12px" }}
                            title="Renew invitation"
                          >
                            <RefreshCw size={13} /> Resend
                          </button>
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "12px", color: "#f87171" }}
                            title="Revoke invitation"
                          >
                            <X size={13} /> Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modal: Organization Settings (Name & Logo) */}
      {isEditing && (
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
          <div className="glass-card" style={{ width: "100%", maxWidth: "460px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "18px", margin: 0 }}>Organization Settings</h3>
              <button onClick={() => setIsEditing(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateOrgSettings}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" htmlFor="editOrgName">Organization Name *</label>
                <input
                  id="editOrgName"
                  type="text"
                  required
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" htmlFor="editLogo">Logo Image URL</label>
                <input
                  id="editLogo"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  className="form-input"
                  value={editLogoUrl}
                  onChange={(e) => setEditLogoUrl(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isUpdating} className="btn btn-primary btn-sm">
                  {isUpdating ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Ownership */}
      {showTransferModal && (
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
          <div className="glass-card" style={{ width: "100%", maxWidth: "460px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", margin: 0, color: "#fff" }}>Transfer Organization Ownership</h3>
              <button onClick={() => setShowTransferModal(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", lineHeight: "1.5", marginBottom: "16px" }}>
              Select an active organization member to become the new primary Owner. You will remain an organization member.
            </p>

            <form onSubmit={handleTransferOwnership}>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label">New Owner</label>
                <select
                  className="form-input"
                  required
                  value={transferTargetUserId}
                  onChange={(e) => setTransferTargetUserId(e.target.value)}
                >
                  <option value="">-- Choose Member --</option>
                  {orgDetail?.members
                    .filter((m) => m.userId !== user?.id)
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name || m.email} ({m.email})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferring || !transferTargetUserId}
                  className="btn btn-primary btn-sm"
                >
                  {isTransferring ? "Transferring..." : "Confirm Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invite Member to Org */}
      {showInviteModal && (
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
          <div className="glass-card" style={{ width: "100%", maxWidth: "460px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", margin: 0 }}>Invite Member to Organization</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {createdInviteUrl ? (
              <div>
                <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", marginBottom: "16px", color: "#34d399", fontSize: "13px" }}>
                  Invitation created! Share this secure link with the invited member:
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                  <input
                    type="text"
                    readOnly
                    value={createdInviteUrl}
                    className="form-input"
                    style={{ fontSize: "12px" }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdInviteUrl);
                      alert("Copied invite link to clipboard!");
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Copy
                  </button>
                </div>
                <button onClick={() => setShowInviteModal(false)} className="btn btn-primary btn-sm" style={{ width: "100%" }}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviteToOrg}>
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label" htmlFor="invEmail">Member Email Address *</label>
                  <input
                    id="invEmail"
                    type="email"
                    required
                    placeholder="colleague@company.com"
                    className="form-input"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <label className="form-label">Assigned Role</label>
                  <select
                    className="form-input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    {orgDetail?.isOwner && <option value="OWNER">Owner (Full control)</option>}
                    <option value="ADMIN">Admin (Manage members & workspaces)</option>
                    <option value="MEMBER">Member (Access assigned resources)</option>
                    <option value="VIEWER">Viewer (Read-only access)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isInviting} className="btn btn-primary btn-sm">
                    {isInviting ? "Sending Invitation..." : "Send Invitation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Org */}
      {showCreateOrgModal && (
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
          <div className="glass-card" style={{ width: "100%", maxWidth: "460px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "18px", margin: 0 }}>Create New Organization</h3>
              <button onClick={() => setShowCreateOrgModal(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrg}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" htmlFor="createOrgNameInput">Organization Name *</label>
                <input
                  id="createOrgNameInput"
                  type="text"
                  required
                  placeholder="e.g. Apex Global Systems"
                  className="form-input"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label" htmlFor="createOrgLogoInput">Logo URL (Optional)</label>
                <input
                  id="createOrgLogoInput"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  className="form-input"
                  value={newOrgLogo}
                  onChange={(e) => setNewOrgLogo(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateOrgModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isCreatingOrg} className="btn btn-primary btn-sm">
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
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-card" style={{ width: "100%", maxWidth: "460px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "18px", margin: 0 }}>Add Workspace to {orgDetail?.name || "Organization"}</h3>
              <button onClick={() => setShowCreateWsModal(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspaceInOrg}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" htmlFor="orgWsNameInput">Workspace Name *</label>
                <input
                  id="orgWsNameInput"
                  type="text"
                  required
                  placeholder="e.g. Ingestion Gateway East"
                  className="form-input"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label">Subscription Tier</label>
                <select
                  className="form-input"
                  value={newWsPlan}
                  onChange={(e) => setNewWsPlan(e.target.value)}
                >
                  <option value="STARTER">Starter Tier (50,000 monthly requests)</option>
                  <option value="PRO">Pro Tier (250,000 monthly requests)</option>
                  <option value="ENTERPRISE">Enterprise Tier (1,000,000 monthly requests)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateWsModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isCreatingWs} className="btn btn-primary btn-sm">
                  {isCreatingWs ? "Creating..." : "Provision Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
