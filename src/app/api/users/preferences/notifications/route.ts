import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    let pref = await prisma.notificationPreference.findUnique({
      where: { userId: session.id },
    });

    if (!pref) {
      pref = await prisma.notificationPreference.create({
        data: {
          userId: session.id,
          securityAlerts: true,
          billingAlerts: true,
          usageAlerts: true,
          teamAlerts: true,
          apiKeyAlerts: true,
          marketingEmails: false,
          emailFrequency: "IMMEDIATE",
        },
      });
    }

    return NextResponse.json({ preferences: pref });
  } catch (error) {
    console.error("Fetch preferences error:", error);
    return NextResponse.json({ error: "Failed to load notification preferences" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      billingAlerts,
      usageAlerts,
      teamAlerts,
      apiKeyAlerts,
      marketingEmails,
      emailFrequency,
    } = body;

    // Note: securityAlerts is enforced true (essential security notifications cannot be disabled)
    const validFrequencies = ["IMMEDIATE", "DAILY_DIGEST", "WEEKLY"];
    const frequency = validFrequencies.includes(emailFrequency) ? emailFrequency : "IMMEDIATE";

    const updated = await prisma.notificationPreference.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        securityAlerts: true,
        billingAlerts: billingAlerts !== undefined ? Boolean(billingAlerts) : true,
        usageAlerts: usageAlerts !== undefined ? Boolean(usageAlerts) : true,
        teamAlerts: teamAlerts !== undefined ? Boolean(teamAlerts) : true,
        apiKeyAlerts: apiKeyAlerts !== undefined ? Boolean(apiKeyAlerts) : true,
        marketingEmails: marketingEmails !== undefined ? Boolean(marketingEmails) : false,
        emailFrequency: frequency,
      },
      update: {
        securityAlerts: true,
        billingAlerts: billingAlerts !== undefined ? Boolean(billingAlerts) : undefined,
        usageAlerts: usageAlerts !== undefined ? Boolean(usageAlerts) : undefined,
        teamAlerts: teamAlerts !== undefined ? Boolean(teamAlerts) : undefined,
        apiKeyAlerts: apiKeyAlerts !== undefined ? Boolean(apiKeyAlerts) : undefined,
        marketingEmails: marketingEmails !== undefined ? Boolean(marketingEmails) : undefined,
        emailFrequency: frequency,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences: updated,
    });
  } catch (error) {
    console.error("Save preferences error:", error);
    return NextResponse.json({ error: "Failed to update notification preferences" }, { status: 500 });
  }
}
