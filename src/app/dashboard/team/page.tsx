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

export default function TeamPage() {
  const { activeWorkspace, user } = useDashboard();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("VIEWER");
  const [loading, setLoading] = useState(true);

  // Invite modal
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchMembers = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
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

    if (!inviteEmail.trim() || !activeWorkspace) return;

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to invite member");
        return;
      }

      setInviteModal(false);
      setInviteEmail("");
      setInviteName("");
      setSuccessMsg(`Teammate invited successfully as ${inviteRole}!`);
      setTimeout(() => setSuccessMsg(""), 3500);
      await fetchMembers();
    } catch {
      setError("Network or server connection failed");
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
      } else {
        const d = await res.json();
        alert(d.error || "Failed to change role");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from this workspace?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace?.id}/members/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchMembers();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to remove member");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const canManageTeam = ["OWNER", "ADMIN"].includes(currentUserRole);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Team & Role-Based Access Control</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Manage team seats and assign granular security roles for {activeWorkspace?.name}
          </p>
        </div>

        {canManageTeam && (
          <button onClick={() => setInviteModal(true)} className="btn btn-primary btn-sm">
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

      {/* Members Table Card */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>Workspace Members ({members.length})</h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined</th>
                {canManageTeam && <th style={{ textAlign: "right" }}>Permissions & Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
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
                        {/* Role selector */}
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

                        {/* Remove button */}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RBAC Security Guidelines Card */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Shield size={16} color="#818cf8" /> Role-Based Access Hierarchy
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", fontSize: "13px" }}>
          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <span className="badge badge-indigo" style={{ marginBottom: "6px" }}>OWNER</span>
            <p style={{ color: "var(--text-secondary)" }}>Full control including billing tiers, transfer of ownership, deletion, and all API keys.</p>
          </div>
          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <span className="badge badge-success" style={{ marginBottom: "6px" }}>ADMIN</span>
            <p style={{ color: "var(--text-secondary)" }}>Can provision & revoke API keys, invite members, modify cluster settings, and inspect audits.</p>
          </div>
          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <span className="badge badge-neutral" style={{ marginBottom: "6px" }}>MEMBER</span>
            <p style={{ color: "var(--text-secondary)" }}>Can execute live sandbox requests, view active API keys, and monitor telemetry charts.</p>
          </div>
          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <span className="badge badge-neutral" style={{ marginBottom: "6px" }}>VIEWER</span>
            <p style={{ color: "var(--text-secondary)" }}>Read-only access to high-level metric summaries and latency statistics.</p>
          </div>
        </div>
      </div>

      {/* Modal: Invite Teammate */}
      {inviteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
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
              <h3 style={{ fontSize: "18px" }}>Invite Teammate</h3>
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
                  padding: "10px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "6px",
                  color: "#fca5a5",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  className="form-input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  className="form-input"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Role</label>
                <select
                  className="form-input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="ADMIN">ADMIN (Can manage keys & invite)</option>
                  <option value="MEMBER">MEMBER (Standard developer)</option>
                  <option value="VIEWER">VIEWER (Read-only)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button type="button" onClick={() => setInviteModal(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
