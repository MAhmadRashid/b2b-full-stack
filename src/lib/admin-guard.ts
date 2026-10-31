import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export interface SuperAdminSession {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  systemRole: string;
}

/**
 * Server-side guard strictly verifying that the caller is an authenticated SUPERADMIN.
 * Prevents regular users, workspace owners, and unauthenticated callers from accessing admin functionality.
 */
export async function requireSuperAdmin(req: NextRequest): Promise<
  { user: SuperAdminSession; errorResponse?: never } | { user?: never; errorResponse: NextResponse }
> {
  const user = await getSessionUser(req);

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Superadmin session required" },
        { status: 401 }
      ),
    };
  }

  if (user.systemRole !== "SUPERADMIN") {
    return {
      errorResponse: NextResponse.json(
        { error: "Forbidden: Superadmin privileges required" },
        { status: 403 }
      ),
    };
  }

  return { user };
}
