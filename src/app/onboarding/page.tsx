"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Building,
  Layers,
  Users,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Plus,
  Mail,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { NexoraLogo } from "@/components/ui/NexoraLogo";

interface OnboardingStatus {
  currentStep: number;
  completed: boolean;
  skipped: boolean;
  tourCompleted: boolean;
  completedSteps: string[];
}

export default function OnboardingPage() {
  const router = useRouter();

  // Master loading & authentication state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Profile state
  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("Product & Platform Lead");

  // Step 2: Organization state
  const [orgMode, setOrgMode] = useState<"create" | "existing">("create");
  const [orgName, setOrgName] = useState("");
  const [existingOrgs, setExistingOrgs] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");

  // Step 3: Workspace state
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspacePlan, setWorkspacePlan] = useState("STARTER");
  const [existingWorkspaces, setExistingWorkspaces] = useState<any[]>([]);

  // Step 4: Team Invitations state
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [invitedCount, setInvitedCount] = useState(0);

  // Initialize data from API
  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, onbRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/onboarding"),
        ]);

        if (!meRes.ok) {
          router.push("/login");
          return;
        }

        const meData = await meRes.json();
        setUser(meData.user);
        setFullName(meData.user?.name || "");
        setExistingOrgs(meData.organizations || []);
        setExistingWorkspaces(meData.workspaces || []);

        if (meData.organizations?.length > 0) {
          setSelectedOrgId(meData.organizations[0].id);
          setOrgMode("existing");
        } else {
          setOrgName(`${meData.user?.name || "Company"} Technologies`);
        }

        if (meData.workspaces?.length > 0) {
          setWorkspaceName(meData.workspaces[0].name);
        } else {
          setWorkspaceName("Production Cluster");
        }

        if (onbRes.ok) {
          const onbData = await onbRes.json();
          setOnboarding(onbData.progress);
          // If already marked completed and not explicitly visiting to reconfigure, proceed
          if (onbData.progress?.completed) {
            router.push("/dashboard");
            return;
          }
          if (onbData.progress?.currentStep) {
            setActiveStep(onbData.progress.currentStep);
          }
        }
      } catch (err) {
        console.error("Failed to load onboarding context", err);
        setErrorMsg("Failed to synchronize onboarding status. Please refresh.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // Persist progress to server safely
  const updateProgress = async (step: number, completedStepId?: string, isFinished = false, isSkipped = false) => {
    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: step,
          completedStepId,
          completed: isFinished,
          skipped: isSkipped,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save progress");
      }

      const data = await res.json();
      setOnboarding(data.progress);
      setActiveStep(step);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to persist onboarding state");
    } finally {
      setSaving(false);
    }
  };

  // Step 1: Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg("Please provide your full name");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile name");
      }

      await updateProgress(2, "profile");
    } catch (err: any) {
      setErrorMsg(err.message || "Error saving profile");
      setSaving(false);
    }
  };

  // Step 2: Handle Organization
  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);

      if (orgMode === "create") {
        if (!orgName.trim()) {
          setErrorMsg("Please enter an organization name");
          setSaving(false);
          return;
        }

        const res = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: orgName.trim() }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create organization");
        }

        const data = await res.json();
        if (data.organization?.id) {
          setSelectedOrgId(data.organization.id);
          localStorage.setItem("pulseflow_active_org", data.organization.id);
        }
      } else {
        if (!selectedOrgId && existingOrgs.length > 0) {
          setSelectedOrgId(existingOrgs[0].id);
          localStorage.setItem("pulseflow_active_org", existingOrgs[0].id);
        }
      }

      await updateProgress(3, "organization");
    } catch (err: any) {
      setErrorMsg(err.message || "Error configuring organization");
      setSaving(false);
    }
  };

  // Step 3: Handle Workspace
  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);

      if (!workspaceName.trim()) {
        setErrorMsg("Please enter a workspace cluster name");
        setSaving(false);
        return;
      }

      const match = existingWorkspaces.find(
        (w) => w.name.toLowerCase() === workspaceName.trim().toLowerCase()
      );

      if (!match) {
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workspaceName.trim(),
            plan: workspacePlan,
            organizationId: selectedOrgId || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create workspace");
        }

        const data = await res.json();
        if (data.workspace?.id) {
          localStorage.setItem("pulseflow_active_ws", data.workspace.id);
        }
      } else {
        localStorage.setItem("pulseflow_active_ws", match.id);
      }

      await updateProgress(4, "workspace");
    } catch (err: any) {
      setErrorMsg(err.message || "Error configuring workspace");
      setSaving(false);
    }
  };

  // Step 4: Handle Team Invitations
  const handleInviteTeammates = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);

      const validEmails = inviteEmails
        .map((em) => em.trim().toLowerCase())
        .filter((em) => em.length > 0 && em.includes("@"));

      if (validEmails.length > 0) {
        const targetWsId =
          localStorage.getItem("pulseflow_active_ws") ||
          (existingWorkspaces.length > 0 ? existingWorkspaces[0].id : null);

        if (targetWsId) {
          let count = 0;
          for (const email of validEmails) {
            try {
              const res = await fetch(`/api/workspaces/${targetWsId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, role: inviteRole }),
              });
              if (res.ok) count++;
            } catch {
              // Ignore single failure to allow remaining invites
            }
          }
          setInvitedCount(count);
        }
      }

      await updateProgress(5, "invite_team");
    } catch (err: any) {
      setErrorMsg(err.message || "Error dispatching invitations");
      setSaving(false);
    }
  };

  // Step 5: Finalize Onboarding and Redirect
  const handleFinishOnboarding = async () => {
    try {
      setSaving(true);
      await updateProgress(5, "complete", true, false);
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Error finalizing onboarding");
      setSaving(false);
    }
  };

  const handleSkipToDashboard = async () => {
    try {
      setSaving(true);
      await updateProgress(activeStep, undefined, true, true);
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  };

  const addInviteField = () => {
    if (inviteEmails.length < 5) {
      setInviteEmails([...inviteEmails, ""]);
    }
  };

  const updateInviteField = (index: number, val: string) => {
    const updated = [...inviteEmails];
    updated[index] = val;
    setInviteEmails(updated);
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)" }}>
          <RefreshCw size={22} className="animate-spin" color="#818cf8" />
          <span style={{ fontSize: "15px", fontWeight: 500 }}>Initializing your Nexora onboarding...</span>
        </div>
      </div>
    );
  }

  const stepsMeta = [
    { num: 1, title: "Profile", icon: ShieldCheck },
    { num: 2, title: "Organization", icon: Building },
    { num: 3, title: "Workspace", icon: Layers },
    { num: 4, title: "Team Invites", icon: Users },
    { num: 5, title: "Launch Ready", icon: Sparkles },
  ];

  const progressPercent = Math.round(((activeStep - 1) / (stepsMeta.length - 1)) * 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div className="glow-mesh" />

      {/* Top Navigation Bar */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(10, 15, 30, 0.7)",
          backdropFilter: "blur(12px)",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <NexoraLogo size="md" variant="full" href="/" />
          <span
            className="badge badge-accent"
            style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", marginLeft: "4px" }}
          >
            Fast-Track Setup
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={handleSkipToDashboard}
            style={{
              background: "transparent",
              border: "1px solid var(--border-medium)",
              color: "var(--text-secondary)",
              padding: "7px 14px",
              borderRadius: "6px",
              fontSize: "12.5px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Skip for now &rarr;
          </button>
        </div>
      </header>

      {/* Main Stepper Container */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 20px",
          zIndex: 10,
        }}
      >
        <div style={{ width: "100%", maxWidth: "640px" }}>
          {/* Visual Progress Bar */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Step {activeStep} of {stepsMeta.length}: {stepsMeta[activeStep - 1]?.title}
              </span>
              <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--accent-cyan)" }}>
                {progressPercent}% Completed
              </span>
            </div>

            <div
              style={{
                height: "6px",
                width: "100%",
                background: "rgba(255, 255, 255, 0.08)",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: "linear-gradient(90deg, #6366f1, #06b6d4)",
                  borderRadius: "3px",
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            {/* Stepper Dots */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "16px",
              }}
            >
              {stepsMeta.map((s) => {
                const isPast = s.num < activeStep;
                const isCurrent = s.num === activeStep;
                const Icon = s.icon;
                return (
                  <div
                    key={s.num}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 700,
                        background: isPast
                          ? "rgba(16, 185, 129, 0.2)"
                          : isCurrent
                          ? "rgba(99, 102, 241, 0.3)"
                          : "rgba(255, 255, 255, 0.05)",
                        border: isPast
                          ? "1px solid #10b981"
                          : isCurrent
                          ? "1px solid #6366f1"
                          : "1px solid var(--border-subtle)",
                        color: isPast ? "#10b981" : isCurrent ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      {isPast ? <CheckCircle2 size={16} /> : <Icon size={14} />}
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: isCurrent ? 600 : 400,
                        color: isCurrent ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                color: "#fca5a5",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Step 1: User Profile Details */}
          {activeStep === 1 && (
            <div className="glass-card" style={{ padding: "32px", borderRadius: "12px" }}>
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>
                  Complete Your Profile
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                  Let's personalize your telemetry dashboard and notifications.
                </p>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="form-group" style={{ marginBottom: "18px" }}>
                  <label className="form-label" htmlFor="fullName">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Elena Rostova"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "18px" }}>
                  <label className="form-label" htmlFor="email">Verified Work Email</label>
                  <input
                    id="email"
                    type="email"
                    disabled
                    className="form-input"
                    value={user?.email || ""}
                    style={{ opacity: 0.7, cursor: "not-allowed" }}
                  />
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    Email linked to your authentication token.
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: "26px" }}>
                  <label className="form-label" htmlFor="roleTitle">Your Role / Discipline</label>
                  <select
                    id="roleTitle"
                    className="form-input"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                  >
                    <option value="Product & Platform Lead">Product & Platform Lead</option>
                    <option value="DevOps & SRE Engineer">DevOps & SRE Engineer</option>
                    <option value="Backend Architect">Backend Architect</option>
                    <option value="Engineering Manager">Engineering Manager</option>
                    <option value="Security & Compliance Officer">Security & Compliance Officer</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ padding: "9px 22px", fontSize: "13.5px" }}
                  >
                    {saving ? "Saving..." : "Continue to Organization"} <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: Organization Setup */}
          {activeStep === 2 && (
            <div className="glass-card" style={{ padding: "32px", borderRadius: "12px" }}>
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>
                  Establish Your Organization
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                  Organizations group multiple workspace clusters, team members, and billing plans.
                </p>
              </div>

              {existingOrgs.length > 0 && (
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                  <button
                    type="button"
                    onClick={() => setOrgMode("existing")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: orgMode === "existing" ? "2px solid #6366f1" : "1px solid var(--border-medium)",
                      background: orgMode === "existing" ? "rgba(99, 102, 241, 0.15)" : "var(--bg-card)",
                      color: orgMode === "existing" ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Use Existing Organization
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrgMode("create")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: orgMode === "create" ? "2px solid #6366f1" : "1px solid var(--border-medium)",
                      background: orgMode === "create" ? "rgba(99, 102, 241, 0.15)" : "var(--bg-card)",
                      color: orgMode === "create" ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Create New Organization
                  </button>
                </div>
              )}

              <form onSubmit={handleSaveOrganization}>
                {orgMode === "create" ? (
                  <div className="form-group" style={{ marginBottom: "26px" }}>
                    <label className="form-label" htmlFor="orgName">Organization Name</label>
                    <input
                      id="orgName"
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Acme Cloud Corp"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                    <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                      This represents your parent company or primary operational entity.
                    </span>
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: "26px" }}>
                    <label className="form-label" htmlFor="selectedOrg">Select Organization</label>
                    <select
                      id="selectedOrg"
                      className="form-input"
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                    >
                      {existingOrgs.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="btn btn-secondary"
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ padding: "9px 22px", fontSize: "13.5px" }}
                  >
                    {saving ? "Saving..." : "Configure Workspace"} <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 3: Workspace Setup */}
          {activeStep === 3 && (
            <div className="glass-card" style={{ padding: "32px", borderRadius: "12px" }}>
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>
                  Configure Initial Telemetry Cluster
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                  Workspaces isolate API tokens, logs, webhooks, and rate limits for environments or apps.
                </p>
              </div>

              <form onSubmit={handleSaveWorkspace}>
                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <label className="form-label" htmlFor="workspaceName">Workspace Name</label>
                  <input
                    id="workspaceName"
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Production Cluster or Staging EU"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "26px" }}>
                  <label className="form-label">Cluster Tier / Quota Plan</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div
                      onClick={() => setWorkspacePlan("STARTER")}
                      style={{
                        padding: "14px",
                        borderRadius: "8px",
                        border: workspacePlan === "STARTER" ? "2px solid #6366f1" : "1px solid var(--border-medium)",
                        background: workspacePlan === "STARTER" ? "rgba(99, 102, 241, 0.12)" : "var(--bg-card)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>Developer Starter</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        50,000 monthly telemetry events, standard retention, email alerts.
                      </div>
                    </div>

                    <div
                      onClick={() => setWorkspacePlan("PRO")}
                      style={{
                        padding: "14px",
                        borderRadius: "8px",
                        border: workspacePlan === "PRO" ? "2px solid #06b6d4" : "1px solid var(--border-medium)",
                        background: workspacePlan === "PRO" ? "rgba(6, 182, 212, 0.12)" : "var(--bg-card)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px", color: "var(--accent-cyan)" }}>
                        Professional Tier
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        500,000 monthly events, webhook dispatching, team RBAC.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="btn btn-secondary"
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ padding: "9px 22px", fontSize: "13.5px" }}
                  >
                    {saving ? "Saving..." : "Next: Invite Team"} <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 4: Team Invitations */}
          {activeStep === 4 && (
            <div className="glass-card" style={{ padding: "32px", borderRadius: "12px" }}>
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>
                  Invite Collaborators (Optional)
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                  Invite teammates to collaborate on telemetry insights and alerts. You can also skip this and invite later.
                </p>
              </div>

              <form onSubmit={handleInviteTeammates}>
                <div style={{ marginBottom: "16px" }}>
                  <label className="form-label">Role for Invites</label>
                  <select
                    className="form-input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{ marginBottom: "16px" }}
                  >
                    <option value="MEMBER">Member (Read & Ingest Metrics)</option>
                    <option value="ADMIN">Admin (Manage API Keys & Settings)</option>
                    <option value="VIEWER">Viewer (Read-Only Insights)</option>
                  </select>

                  <label className="form-label">Teammate Work Emails</label>
                  {inviteEmails.map((email, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="colleague@company.com"
                        value={email}
                        onChange={(e) => updateInviteField(idx, e.target.value)}
                      />
                    </div>
                  ))}

                  {inviteEmails.length < 5 && (
                    <button
                      type="button"
                      onClick={addInviteField}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--accent-cyan)",
                        fontSize: "12.5px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 0",
                      }}
                    >
                      <Plus size={14} /> Add another colleague
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="btn btn-secondary"
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => updateProgress(5, "invite_team")}
                      className="btn btn-secondary"
                      style={{ padding: "9px 18px", fontSize: "13px" }}
                    >
                      Skip Step
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                      style={{ padding: "9px 22px", fontSize: "13.5px" }}
                    >
                      {saving ? "Sending..." : "Send & Continue"} <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Step 5: Activation Complete */}
          {activeStep === 5 && (
            <div className="glass-card" style={{ padding: "36px", borderRadius: "12px", textAlign: "center" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "2px solid #10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px auto",
                  boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)",
                }}
              >
                <Sparkles size={30} color="#10b981" />
              </div>

              <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>
                You're All Set!
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "14.5px",
                  maxWidth: "460px",
                  margin: "0 auto 26px auto",
                  lineHeight: 1.6,
                }}
              >
                Your organization and initial telemetry cluster are provisioned. In your dashboard, you'll
                find an interactive product tour and checklist to guide your first API event ingestion.
              </p>

              {invitedCount > 0 && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(99, 102, 241, 0.12)",
                    borderRadius: "8px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    color: "#a5b4fc",
                    marginBottom: "24px",
                  }}
                >
                  <Users size={16} /> {invitedCount} teammate invitation(s) dispatched!
                </div>
              )}

              <div>
                <button
                  id="btn-launch-dashboard"
                  onClick={handleFinishOnboarding}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{
                    padding: "12px 32px",
                    fontSize: "15px",
                    fontWeight: 700,
                    boxShadow: "0 0 25px rgba(99, 102, 241, 0.5)",
                  }}
                >
                  {saving ? "Launching..." : "Launch Nexora Dashboard"} <ArrowRight size={17} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
