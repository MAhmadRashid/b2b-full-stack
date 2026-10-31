import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    // 1. Fetch or initialize onboarding progress for the user
    let progress = await prisma.onboardingProgress.findUnique({
      where: { userId: session.id },
    });

    if (!progress) {
      // For existing users who registered earlier, check if they already have an organization or workspace
      const [existingOrgs, existingWorkspaces] = await Promise.all([
        prisma.organizationMembership.count({ where: { userId: session.id } }),
        prisma.membership.count({ where: { userId: session.id } }),
      ]);

      // If user already has orgs or workspaces, mark onboarding completed so existing users are never forced through onboarding again
      const isExistingActiveUser = existingOrgs > 0 || existingWorkspaces > 0;

      progress = await prisma.onboardingProgress.create({
        data: {
          userId: session.id,
          currentStep: isExistingActiveUser ? 4 : 1,
          completed: isExistingActiveUser,
          skipped: false,
          tourCompleted: isExistingActiveUser,
          completedSteps: isExistingActiveUser
            ? JSON.stringify(["profile", "organization", "workspace"])
            : JSON.stringify([]),
        },
      });
    }

    // 2. Fetch verified live database state for getting started checklist tasks
    const [
      userProfile,
      orgMemberships,
      wsMemberships,
      createdKeysCount,
      notificationPrefs,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.id },
        select: { id: true, name: true, email: true, avatarUrl: true, emailVerified: true },
      }),
      prisma.organizationMembership.findMany({
        where: { userId: session.id },
        include: {
          organization: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      }),
      prisma.membership.findMany({
        where: { userId: session.id },
        include: {
          workspace: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      }),
      prisma.apiKey.count({
        where: { userId: session.id, revoked: false },
      }),
      prisma.notificationPreference.findUnique({
        where: { userId: session.id },
      }),
    ]);

    // Compute live, verified checklist status
    const hasCompletedProfile = !!(userProfile?.name && userProfile.name.trim() !== "");
    const hasOrg = orgMemberships.length > 0;
    const hasWorkspace = wsMemberships.length > 0;
    const isOwnerOrAdmin = orgMemberships.some((m) => ["OWNER", "ADMIN"].includes(m.role)) ||
      wsMemberships.some((m) => ["OWNER", "ADMIN"].includes(m.role));

    // Check if team member has been invited (for owners/admins)
    let hasInvitedTeammates = false;
    if (hasOrg) {
      const primaryOrgId = orgMemberships[0].organizationId;
      const [membersCount, pendingInvites] = await Promise.all([
        prisma.organizationMembership.count({ where: { organizationId: primaryOrgId } }),
        prisma.invitation.count({ where: { organizationId: primaryOrgId } }),
      ]);
      hasInvitedTeammates = membersCount > 1 || pendingInvites > 0;
    }

    const hasGeneratedApiKey = createdKeysCount > 0;
    const hasConfiguredNotifications = !!notificationPrefs;

    let parsedCompletedSteps: string[] = [];
    try {
      parsedCompletedSteps = JSON.parse(progress.completedSteps);
    } catch {
      parsedCompletedSteps = [];
    }

    // Dynamic checklist tailored to user role and verified state
    const checklist = [
      {
        id: "profile",
        title: "Complete your profile",
        description: "Add your full name and display information",
        completed: hasCompletedProfile,
        link: "/dashboard/settings",
      },
      {
        id: "organization",
        title: "Create or join an organization",
        description: "Establish your team's tenant account or accept an invite",
        completed: hasOrg,
        link: "/dashboard/organization",
      },
      {
        id: "workspace",
        title: "Set up a workspace",
        description: "Configure an isolated telemetry cluster and quotas",
        completed: hasWorkspace,
        link: "/dashboard/workspaces",
      },
      ...(isOwnerOrAdmin
        ? [
            {
              id: "invite_team",
              title: "Invite teammates",
              description: "Add engineers, admins, or viewers with RBAC permissions",
              completed: hasInvitedTeammates,
              link: "/dashboard/team",
            },
          ]
        : []),
      {
        id: "api_key",
        title: "Generate a developer API key",
        description: "Create a secure bearer token to start ingesting telemetry",
        completed: hasGeneratedApiKey,
        link: "/dashboard/api-keys",
      },
      {
        id: "notifications",
        title: "Configure notification preferences",
        description: "Select which email and in-app alerts you want to receive",
        completed: hasConfiguredNotifications,
        link: "/dashboard/settings",
      },
    ];

    const completedChecklistCount = checklist.filter((item) => item.completed).length;
    const checklistProgressPercent = Math.round((completedChecklistCount / checklist.length) * 100);

    return NextResponse.json({
      progress: {
        id: progress.id,
        currentStep: progress.currentStep,
        completed: progress.completed,
        skipped: progress.skipped,
        tourCompleted: progress.tourCompleted,
        tourDismissed: progress.tourDismissed,
        completedSteps: parsedCompletedSteps,
        checklistDismissed: progress.checklistDismissed,
      },
      checklist: {
        items: checklist,
        completedCount: completedChecklistCount,
        totalCount: checklist.length,
        progressPercent: checklistProgressPercent,
      },
      verifiedState: {
        hasProfile: hasCompletedProfile,
        hasOrg,
        hasWorkspace,
        isOwnerOrAdmin,
        primaryOrg: orgMemberships[0]?.organization || null,
        primaryWorkspace: wsMemberships[0]?.workspace || null,
      },
    });
  } catch (error) {
    console.error("Onboarding progress fetch error:", error);
    return NextResponse.json({ error: "Failed to load onboarding status" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      currentStep,
      completed,
      skipped,
      tourCompleted,
      tourDismissed,
      checklistDismissed,
      completedStepId,
    } = body;

    let progress = await prisma.onboardingProgress.findUnique({
      where: { userId: session.id },
    });

    if (!progress) {
      progress = await prisma.onboardingProgress.create({
        data: {
          userId: session.id,
          currentStep: 1,
          completed: false,
          skipped: false,
        },
      });
    }

    let parsedCompletedSteps: string[] = [];
    try {
      parsedCompletedSteps = JSON.parse(progress.completedSteps);
    } catch {
      parsedCompletedSteps = [];
    }

    if (completedStepId && !parsedCompletedSteps.includes(completedStepId)) {
      parsedCompletedSteps.push(completedStepId);
    }

    const updated = await prisma.onboardingProgress.update({
      where: { userId: session.id },
      data: {
        ...(currentStep !== undefined && { currentStep: Number(currentStep) }),
        ...(completed !== undefined && { completed: Boolean(completed) }),
        ...(skipped !== undefined && { skipped: Boolean(skipped) }),
        ...(tourCompleted !== undefined && { tourCompleted: Boolean(tourCompleted) }),
        ...(tourDismissed !== undefined && { tourDismissed: Boolean(tourDismissed) }),
        ...(checklistDismissed !== undefined && { checklistDismissed: Boolean(checklistDismissed) }),
        completedSteps: JSON.stringify(parsedCompletedSteps),
      },
    });

    // Stage 6: Onboarding Step Completed
    try {
      const { recordFunnelEvent } = await import("@/lib/funnel-analytics");
      await recordFunnelEvent({
        sessionId: `usr_${session.id}`,
        stage: "ONBOARDING_STEP_COMPLETED",
        eventName: completed ? "onboarding_completed" : `step_${completedStepId || currentStep || "progress"}`,
        userId: session.id,
        path: "/onboarding",
        metadata: {
          currentStep: updated.currentStep,
          completed: updated.completed,
          completedStepId,
        },
      });
    } catch {
      // Analytics non-blocking
    }

    return NextResponse.json({
      success: true,
      progress: {
        id: updated.id,
        currentStep: updated.currentStep,
        completed: updated.completed,
        skipped: updated.skipped,
        tourCompleted: updated.tourCompleted,
        tourDismissed: updated.tourDismissed,
        checklistDismissed: updated.checklistDismissed,
        completedSteps: parsedCompletedSteps,
      },
    });
  } catch (error) {
    console.error("Onboarding progress update error:", error);
    return NextResponse.json({ error: "Failed to update onboarding progress" }, { status: 500 });
  }
}
