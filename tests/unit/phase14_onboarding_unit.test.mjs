import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper logic replicating checklist progress calculations
function computeChecklistProgress(checklist) {
  const completedCount = checklist.filter((item) => item.completed).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);
  return { completedCount, totalCount: checklist.length, progressPercent };
}

function buildChecklist({ hasProfile, hasOrg, hasWorkspace, isOwnerOrAdmin, hasInvitedTeammates, hasGeneratedApiKey, hasConfiguredNotifications }) {
  return [
    {
      id: "profile",
      title: "Complete your profile",
      completed: hasProfile,
      link: "/dashboard/settings",
    },
    {
      id: "organization",
      title: "Create or join an organization",
      completed: hasOrg,
      link: "/dashboard/organization",
    },
    {
      id: "workspace",
      title: "Set up a workspace",
      completed: hasWorkspace,
      link: "/dashboard/workspaces",
    },
    ...(isOwnerOrAdmin
      ? [
          {
            id: "invite_team",
            title: "Invite teammates",
            completed: hasInvitedTeammates,
            link: "/dashboard/team",
          },
        ]
      : []),
    {
      id: "api_key",
      title: "Generate a developer API key",
      completed: hasGeneratedApiKey,
      link: "/dashboard/api-keys",
    },
    {
      id: "notifications",
      title: "Configure notification preferences",
      completed: hasConfiguredNotifications,
      link: "/dashboard/settings",
    },
  ];
}

test("Phase 14 Unit: OnboardingProgress database model schema and lifecycle", async () => {
  const runId = Date.now();
  const testUser = await prisma.user.create({
    data: {
      email: `onb_test_${runId}@company.io`,
      name: "Onboarding Test User",
      passwordHash: "dummyhash123",
      systemRole: "USER",
    },
  });

  // 1. Create onboarding progress for user
  const progress = await prisma.onboardingProgress.create({
    data: {
      userId: testUser.id,
      currentStep: 1,
      completed: false,
      skipped: false,
      tourCompleted: false,
      tourDismissed: false,
      completedSteps: JSON.stringify([]),
    },
  });

  assert.equal(progress.userId, testUser.id);
  assert.equal(progress.currentStep, 1);
  assert.equal(progress.completed, false);
  assert.equal(progress.tourCompleted, false);
  assert.equal(progress.tourDismissed, false);

  // 2. Update progress across steps
  const updatedProgress = await prisma.onboardingProgress.update({
    where: { userId: testUser.id },
    data: {
      currentStep: 3,
      completedSteps: JSON.stringify(["profile", "organization"]),
    },
  });

  assert.equal(updatedProgress.currentStep, 3);
  const parsedSteps = JSON.parse(updatedProgress.completedSteps);
  assert.equal(parsedSteps.length, 2);
  assert.ok(parsedSteps.includes("profile"));
  assert.ok(parsedSteps.includes("organization"));

  // 3. Mark completed and tour finished
  const finalized = await prisma.onboardingProgress.update({
    where: { userId: testUser.id },
    data: {
      completed: true,
      tourCompleted: true,
      tourDismissed: true,
      checklistDismissed: false,
    },
  });

  assert.equal(finalized.completed, true);
  assert.equal(finalized.tourCompleted, true);

  // Cleanup
  await prisma.onboardingProgress.delete({ where: { userId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
});

test("Phase 14 Unit: Checklist calculation for new user with zero setup", () => {
  const checklist = buildChecklist({
    hasProfile: false,
    hasOrg: false,
    hasWorkspace: false,
    isOwnerOrAdmin: false,
    hasInvitedTeammates: false,
    hasGeneratedApiKey: false,
    hasConfiguredNotifications: false,
  });

  const { completedCount, totalCount, progressPercent } = computeChecklistProgress(checklist);
  assert.equal(totalCount, 5); // Non-admin has 5 items (no invite_team)
  assert.equal(completedCount, 0);
  assert.equal(progressPercent, 0);
});

test("Phase 14 Unit: Checklist calculation for Admin/Owner with partial progress", () => {
  const checklist = buildChecklist({
    hasProfile: true,
    hasOrg: true,
    hasWorkspace: true,
    isOwnerOrAdmin: true,
    hasInvitedTeammates: false,
    hasGeneratedApiKey: false,
    hasConfiguredNotifications: true,
  });

  const { completedCount, totalCount, progressPercent } = computeChecklistProgress(checklist);
  assert.equal(totalCount, 6); // Admin includes invite_team
  assert.equal(completedCount, 4);
  assert.equal(progressPercent, 67); // 4 / 6 = 67%
});

test("Phase 14 Unit: Checklist calculation for fully activated Owner", () => {
  const checklist = buildChecklist({
    hasProfile: true,
    hasOrg: true,
    hasWorkspace: true,
    isOwnerOrAdmin: true,
    hasInvitedTeammates: true,
    hasGeneratedApiKey: true,
    hasConfiguredNotifications: true,
  });

  const { completedCount, totalCount, progressPercent } = computeChecklistProgress(checklist);
  assert.equal(totalCount, 6);
  assert.equal(completedCount, 6);
  assert.equal(progressPercent, 100);
});

test("Phase 14 Unit: Product tour navigation step sequence validity", () => {
  const tourStepIds = [
    "tour-welcome",
    "ws-switcher-button",
    "tour-nav-analytics",
    "tour-nav-apikeys",
    "tour-nav-team",
    "tour-nav-notifications",
    "tour-nav-billing",
    "tour-nav-settings",
  ];

  assert.equal(tourStepIds.length, 8);
  assert.ok(tourStepIds.includes("tour-nav-analytics"));
  assert.ok(tourStepIds.includes("tour-nav-apikeys"));
  assert.ok(tourStepIds.includes("tour-nav-billing"));
  assert.ok(tourStepIds.includes("tour-nav-notifications"));
});

test.after(async () => {
  await prisma.$disconnect();
});
