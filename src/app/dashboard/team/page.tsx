"use client";

import React, { useEffect, useState } from "react";
import { useDashboard } from "../layout";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Mail,
  Copy,
  Check,
  Clock,
  Link as LinkIcon,
} from "lucide-react";

interface MemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  createdAt: string;
}

export default function TeamPage() {
  const { activeWorkspace, user } = useDashboard();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("VIEWER");
  const [loading, setLoading] = useState(true);

  // Invite modal
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setPendingInvitations(data.pendingInvitations || []);
        setCurrentUserRole(data.currentUserRole || "VIEWER");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeWorkspace?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setCreatedInviteUrl(null);

    if (!inviteEmail.trim() || !activeWorkspace) return;

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
          sendInviteLink: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to invite member");
        return;
      }

      if (data.invitation) {
        const fullUrl = `${window.location.origin}${data.invitation.inviteUrl}`;
        setCreatedInviteUrl(fullUrl);
      }

      setInviteEmail("");
      setInviteName("");
      setSuccessMsg(`Invitation dispatched for ${inviteRole}!`);
      await fetchMembers();
    } catch {
      setError("Network or server connection failed");
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!activeWorkspace || !confirm("Revoke this pending invitation?")) return;

    try {
      const res = await fetch(
        `/api/workspaces/${activeWorkspace.id}/members?invitationId=${invitationId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!activeWorkspace) return;

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        await fetchMembers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!activeWorkspace) return;
    if (!confirm(`Are you sure you want to remove ${email} from this workspace?`)) return;

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/members/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchMembers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const canManageTeam = ["OWNER", "ADMIN"].includes(currentUserRole);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Team & RBAC Permissions</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Manage workspace collaborators, access tiers, and pending invitation tokens
          </p>
        </div>

        {canManageTeam && (
          <button
            onClick={() => {
              setError("");
              setCreatedInviteUrl(null);
              setInviteModal(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <UserPlus size={15} /> Invite Teammate
          </button>
        )}
      </div>

      {successMsg && (
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
          <span>{successMsg}</span>
        </div>
      )}

      {/* Role Definitions Legend */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span className="badge badge-indigo">OWNER</span>
          </div>
          <p style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
            Full cluster control, billing administration, member removal, and workspace deletion.
          </p>
        </div>

        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span className="badge badge-success">ADMIN</span>
          </div>
          <p style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
            Provision & revoke API keys, manage outbound webhooks, and invite new collaborators.
          </p>
        </div>

        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span className="badge badge-neutral">MEMBER</span>
          </div>
          <p style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
            View metrics overview, query latency percentiles, and run live sandbox simulations.
          </p>
        </div>

        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span className="badge badge-neutral" style={{ opacity: 0.8 }}>VIEWER</span>
          </div>
          <p style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
            Read-only access to dashboard monitoring charts without mutation permissions.
          </p>
        </div>
      </div>

      {/* Pending Invitations Table */}
      {pendingInvitations.length > 0 && (
        <div className="glass-card" style={{ padding: "24px", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
          <h3 style={{ fontSize: "16px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={16} color="#06b6d4" /> Pending Workspace Invitations ({pendingInvitations.length})
          </h3>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invited Email</th>
                  <th>Assigned Role</th>
                  <th>Invitation Link</th>
                  <th>Expires</th>
                  {canManageTeam && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.map((inv) => {
                  const isCopied = copiedTokenId === inv.id;
                  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${inv.inviteUrl}` : inv.inviteUrl;

                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600, color: "#fff" }}>{inv.email}</td>
                      <td>
                        <span className="badge badge-indigo" style={{ fontSize: "11px" }}>
                          {inv.role}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(fullUrl, inv.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: "11.5px", padding: "4px 8px", gap: "6px" }}
                        >
                          {isCopied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          <span>{isCopied ? "Link Copied" : "Copy Onboarding Link"}</span>
                        </button>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      {canManageTeam && (
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: "4px 8px", fontSize: "11.5px" }}
                          >
                            <Trash2 size={12} /> Revoke
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Members Table */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Active Workspace Members</h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Collaborator</th>
                <th>Role</th>
                <th>Member Since</th>
                {canManageTeam && <th style={{ textAlign: "right" }}>Governance</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    Loading active workspace members...
                  </td>
                </tr>
              ) : members.length > 0 ? (
                members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                          }}
                        >
                          {m.name ? m.name.charAt(0) : "U"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#fff" }}>{m.name || "Workspace Member"}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{m.email}</div>
                        </div>
                      </div>
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
                      >
                        {m.role}
                      </span>
                    </td>
                    <td style={{ fontSize: "12.5px" }}>{new Date(m.joinedAt).toLocaleDateString()}</td>
                    {canManageTeam && (
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                          {currentUserRole === "OWNER" && m.role !== "OWNER" && (
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                              className="form-input"
                              style={{ padding: "4px 8px", fontSize: "12px", width: "auto" }}
                            >
                              <option value="ADMIN">ADMIN</option>
                              <option value="MEMBER">MEMBER</option>
                              <option value="VIEWER">VIEWER</option>
                            </select>
                          )}

                          {m.role !== "OWNER" && (
                            <button
                              onClick={() => handleRemoveMember(m.id, m.email)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: "4px 8px", fontSize: "12px" }}
                              title="Remove member"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {inviteModal && (
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
          <div className="glass-card" style={{ width: "100%", maxWidth: "480px", padding: "28px", background: "#0e121e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                <UserPlus size={18} color="#06b6d4" /> Invite Teammate to Workspace
              </h3>
              <button onClick={() => setInviteModal(false)} style={{ color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  color: "#fca5a5",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {createdInviteUrl && (
              <div
                style={{
                  padding: "14px",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "8px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ fontSize: "12.5px", color: "#34d399", fontWeight: 600, marginBottom: "6px" }}>
                  Invitation Token Created Successfully!
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    readOnly
                    value={createdInviteUrl}
                    className="form-input mono"
                    style={{ fontSize: "11.5px", padding: "6px 8px" }}
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdInviteUrl, "new_invite")}
                    className="btn btn-secondary btn-sm"
                  >
                    {copiedTokenId === "new_invite" ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="form-label" htmlFor="invEmail">Email Address *</label>
                <input
                  id="invEmail"
                  type="email"
                  required
                  placeholder="collaborator@company.com"
                  className="form-input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="invName">Full Name (Optional)</label>
                <input
                  id="invName"
                  type="text"
                  placeholder="e.g. Alex Sterling"
                  className="form-input"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="invRole">Access Role Tier</label>
                <select
                  id="invRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="form-input"
                >
                  <option value="ADMIN">ADMIN (API keys & webhook configuration)</option>
                  <option value="MEMBER">MEMBER (Metrics & live sandbox)</option>
                  <option value="VIEWER">VIEWER (Read-only monitoring)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setInviteModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Close
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Generate Invitation Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
