import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

// Default platform settings and feature flags seeded dynamically
const DEFAULT_SETTINGS: { key: string; value: any; category: string; description: string }[] = [
  {
    key: "ENABLE_USER_REGISTRATION",
    value: true,
    category: "FEATURE_FLAG",
    description: "Allow new users to self-register on the public landing page",
  },
  {
    key: "ENABLE_EMAIL_INVITATIONS",
    value: true,
    category: "FEATURE_FLAG",
    description: "Enable outbound invitation emails via transactional mailer",
  },
  {
    key: "ENABLE_SANDBOX_PAYMENTS",
    value: true,
    category: "BILLING",
    description: "Permit zero-cost sandbox checkouts when live Stripe keys are not configured",
  },
  {
    key: "MAINTENANCE_MODE",
    value: false,
    category: "SECURITY",
    description: "Put the application into read-only maintenance mode",
  },
  {
    key: "MAX_FREE_WORKSPACES_PER_ORG",
    value: 1,
    category: "BILLING",
    description: "Maximum workspaces permissible under FREE tier organizations",
  },
  {
    key: "GLOBAL_RATE_LIMIT_CEILING",
    value: 120,
    category: "SECURITY",
    description: "Default per-minute rate limit for developer API ingest endpoints",
  },
];

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "ALL";

    // Ensure default settings exist in the database
    for (const def of DEFAULT_SETTINGS) {
      const exists = await prisma.platformSetting.findUnique({
        where: { key: def.key },
      });
      if (!exists) {
        await prisma.platformSetting.create({
          data: {
            key: def.key,
            value: JSON.stringify(def.value),
            category: def.category,
            description: def.description,
            updatedBy: "System",
          },
        });
      }
    }

    const where: any = {};
    if (category !== "ALL") {
      where.category = category.toUpperCase();
    }

    const settings = await prisma.platformSetting.findMany({
      where,
      orderBy: { category: "asc" },
    });

    const parsedSettings = settings.map((s) => {
      let parsedValue: any = s.value;
      try {
        parsedValue = JSON.parse(s.value);
      } catch {
        parsedValue = s.value;
      }
      return {
        id: s.id,
        key: s.key,
        value: parsedValue,
        category: s.category,
        description: s.description,
        updatedBy: s.updatedBy,
        updatedAt: s.updatedAt,
      };
    });

    return NextResponse.json({ settings: parsedSettings });
  } catch (error) {
    console.error("Superadmin settings fetch error:", error);
    return NextResponse.json({ error: "Failed to load platform settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin(req);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json().catch(() => ({}));
    const { key, value, category, description } = body;

    if (!key || typeof key !== "string" || !key.trim()) {
      return NextResponse.json({ error: "Setting key is required" }, { status: 400 });
    }

    const cleanKey = key.trim().toUpperCase().replace(/\s+/g, "_");
    const jsonValue = JSON.stringify(value);

    const setting = await prisma.platformSetting.upsert({
      where: { key: cleanKey },
      update: {
        value: jsonValue,
        category: category?.toUpperCase() || "GENERAL",
        description: description || undefined,
        updatedBy: auth.user.email,
      },
      create: {
        key: cleanKey,
        value: jsonValue,
        category: category?.toUpperCase() || "GENERAL",
        description: description || "Custom platform setting",
        updatedBy: auth.user.email,
      },
    });

    await recordAuditLog({
      userId: auth.user.id,
      userEmail: auth.user.email,
      action: "SETTINGS_UPDATED",
      details: `Superadmin set platform setting '${cleanKey}' to ${jsonValue}`,
      ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
    });

    return NextResponse.json({
      success: true,
      message: `Setting ${cleanKey} successfully saved`,
      setting: {
        id: setting.id,
        key: setting.key,
        value,
        category: setting.category,
        description: setting.description,
        updatedBy: setting.updatedBy,
        updatedAt: setting.updatedAt,
      },
    });
  } catch (error) {
    console.error("Superadmin save setting error:", error);
    return NextResponse.json({ error: "Failed to save platform setting" }, { status: 500 });
  }
}
