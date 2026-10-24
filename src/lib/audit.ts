import { prisma } from "./prisma";

interface AuditLogParams {
  workspaceId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  details: string;
  ipAddress?: string;
}

export async function recordAuditLog(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: params.workspaceId || null,
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        action: params.action,
        details: params.details,
        ipAddress: params.ipAddress || "127.0.0.1",
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
