import { prisma } from "./prisma";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

const ROLE_RANKS: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userRank = ROLE_RANKS[userRole?.toUpperCase()];
  const reqRank = ROLE_RANKS[requiredRole?.toUpperCase()];
  if (userRank === undefined || reqRank === undefined) return false;
  return userRank >= reqRank;
}

/**
 * Validates whether the actor can assign the specified target role.
 * Prevents unauthorized privilege escalation:
 * - Only an OWNER can assign or transfer the OWNER role.
 * - An ADMIN can only assign ADMIN, MEMBER, or VIEWER.
 * - MEMBER and VIEWER cannot assign roles.
 */
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  const normActor = actorRole?.toUpperCase();
  const normTarget = targetRole?.toUpperCase();

  if (normActor === "OWNER") {
    return ["OWNER", "ADMIN", "MEMBER", "VIEWER"].includes(normTarget);
  }
  if (normActor === "ADMIN") {
    return ["ADMIN", "MEMBER", "VIEWER"].includes(normTarget);
  }
  return false;
}

export async function getWorkspaceMembership(userId: string, workspaceId: string) {
  return prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    include: {
      workspace: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          systemRole: true,
        },
      },
    },
  });
}

export async function checkWorkspacePermission(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole = "VIEWER"
): Promise<{ allowed: boolean; role?: WorkspaceRole; workspace?: any; error?: string }> {
  // Check if system superadmin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === "SUPERADMIN") {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) return { allowed: false, error: "Workspace not found" };
    return { allowed: true, role: "OWNER", workspace: ws };
  }

  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    return { allowed: false, error: "You are not a member of this workspace" };
  }

  const role = membership.role as WorkspaceRole;
  if (!hasMinimumRole(role, minRole)) {
    return {
      allowed: false,
      role,
      error: `Requires ${minRole} permission. Current role: ${role}`,
    };
  }

  return { allowed: true, role, workspace: membership.workspace };
}

export async function getOrganizationMembership(userId: string, organizationId: string) {
  return prisma.organizationMembership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    include: {
      organization: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          systemRole: true,
        },
      },
    },
  });
}

export async function checkOrganizationPermission(
  userId: string,
  organizationId: string,
  minRole: OrganizationRole = "VIEWER"
): Promise<{ allowed: boolean; role?: OrganizationRole; organization?: any; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (user?.systemRole === "SUPERADMIN") {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return { allowed: false, error: "Organization not found" };
    return { allowed: true, role: "OWNER", organization: org };
  }

  const membership = await getOrganizationMembership(userId, organizationId);
  if (!membership) {
    return { allowed: false, error: "You are not a member of this organization" };
  }

  const role = membership.role as OrganizationRole;
  if (!hasMinimumRole(role, minRole)) {
    return {
      allowed: false,
      role,
      error: `Requires ${minRole} permission. Current role: ${role}`,
    };
  }

  return { allowed: true, role, organization: membership.organization };
}

/**
 * Checks whether the given user is the only OWNER of the organization.
 * Used to prevent removing or demoting the last owner.
 */
export async function isLastOrganizationOwner(organizationId: string, userId: string): Promise<boolean> {
  const owners = await prisma.organizationMembership.findMany({
    where: {
      organizationId,
      role: "OWNER",
    },
    select: { userId: true },
  });

  if (owners.length <= 1 && owners.some((o) => o.userId === userId)) {
    return true;
  }
  return false;
}

/**
 * Checks whether the given user is the only OWNER of the workspace.
 * Used to prevent removing or demoting the last owner.
 */
export async function isLastWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  const owners = await prisma.membership.findMany({
    where: {
      workspaceId,
      role: "OWNER",
    },
    select: { userId: true },
  });

  if (owners.length <= 1 && owners.some((o) => o.userId === userId)) {
    return true;
  }
  return false;
}
