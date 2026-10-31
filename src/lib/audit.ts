import { prisma } from "./prisma";

interface AuditLogParams {
  workspaceId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  details: string;
  ipAddress?: string;
}

function sanitizeAuditDetails(details: string): string {
  if (!details) return "";
  return details
    .replace(/(pfl_[a-zA-Z0-9_-]{8,})/g, (m) => `${m.substring(0, 8)}...[REDACTED]`)
    .replace(/(whsec_[a-zA-Z0-9_-]{6,})/g, "whsec_...[REDACTED]")
    .replace(/(rst_[a-zA-Z0-9_-]{6,})/g, "rst_...[REDACTED]")
    .replace(/(vfy_[a-zA-Z0-9_-]{6,})/g, "vfy_...[REDACTED]")
    .replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"[REDACTED]"');
}

export async function recordAuditLog(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: params.workspaceId || null,
        organizationId: params.organizationId || null,
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        action: params.action,
        details: sanitizeAuditDetails(params.details),
        ipAddress: params.ipAddress || "127.0.0.1",
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

