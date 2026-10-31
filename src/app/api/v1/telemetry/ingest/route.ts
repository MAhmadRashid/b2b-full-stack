import { NextRequest, NextResponse } from "next/server";
import { POST as ingestPost } from "@/app/api/v1/ingest/route";

/**
 * Route Alias: POST /api/v1/telemetry/ingest
 * Direct drop-in alias for /api/v1/ingest to support canonical telemetry endpoints.
 */
export async function POST(req: NextRequest) {
  return ingestPost(req);
}
