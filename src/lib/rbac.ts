import { prisma } from "./prisma";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

const ROLE_RANKS: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export function hasMinimumRole(userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  const userRank = ROLE_RANKS[userRole] ?? 0;
  const reqRank = ROLE_RANKS[requiredRole] ?? 0;
  return userRank >= reqRank;
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
