import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateEnvironment } from "@/lib/env-check";

export async function GET() {
  const start = Date.now();
  try {
    // Quick DB query to verify connection
    await prisma.user.count();
    const dbLatencyMs = Date.now() - start;
    const envCheck = validateEnvironment();

    return NextResponse.json({
      status: "HEALTHY",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      database: {
        status: "CONNECTED",
        latencyMs: dbLatencyMs,
        type: envCheck.features.database.type,
      },
      readiness: {
        envValid: envCheck.valid,
        billingMode: envCheck.features.billing.mode,
        emailConfigured: envCheck.features.email.configured,
      },
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "DEGRADED",
        timestamp: new Date().toISOString(),
        database: {
          status: "DISCONNECTED",
          error: (error as Error).message,
        },
      },
      { status: 503 }
    );
  }
}
