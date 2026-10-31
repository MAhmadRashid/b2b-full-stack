import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function run() {
  console.log("=== STEP 1: Resolving / Creating User ===");
  let user = await prisma.user.findFirst({
    where: { email: "demo@acmecorp.com" },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    user = await prisma.user.create({
      data: {
        email: "demo@acmecorp.com",
        name: "Elena Rostova",
        passwordHash,
        systemRole: "USER",
      },
    });
    console.log("Created user:", user.email);
  } else {
    console.log("Found existing user:", user.email, `(${user.id})`);
  }

  console.log("\n=== STEP 2: Resolving / Creating Organization 'For Console\'s Team' ===");
  let org = await prisma.organization.findFirst({
    where: { name: "For Console's Team" },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "For Console's Team",
        slug: "for-consoles-team",
        ownerId: user.id,
      },
    });
    console.log("Created organization 'For Console\'s Team':", org.id);
  } else {
    console.log("Found existing organization:", org.name, `(${org.id})`);
  }

  // Ensure organization membership
  const orgMember = await prisma.organizationMembership.findFirst({
    where: { userId: user.id, organizationId: org.id },
  });
  if (!orgMember) {
    await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "OWNER",
      },
    });
    console.log("Linked user as OWNER of organization.");
  }

  console.log("\n=== STEP 3: Resolving / Creating Workspace 'Default Workspace' ===");
  let ws = await prisma.workspace.findFirst({
    where: {
      name: "Default Workspace",
      organizationId: org.id,
    },
  });

  if (!ws) {
    ws = await prisma.workspace.create({
      data: {
        name: "Default Workspace",
        slug: "default-workspace",
        plan: "PRO",
        billingCycle: "MONTHLY",
        subscriptionStatus: "ACTIVE",
        monthlyRequestLimit: 100000,
        requestsThisMonth: 14250,
        organizationId: org.id,
        creatorId: user.id,
      },
    });
    console.log("Created 'Default Workspace' with quota 14,250 / 100,000:", ws.id);
  } else {
    // Ensure the quota matches user expectation (14,250 / 100,000)
    ws = await prisma.workspace.update({
      where: { id: ws.id },
      data: {
        requestsThisMonth: 14250,
        monthlyRequestLimit: 100000,
      },
    });
    console.log("Found & updated 'Default Workspace' quota to 14,250 / 100,000:", ws.id);
  }

  // Ensure workspace membership
  const wsMember = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: ws.id },
  });
  if (!wsMember) {
    await prisma.membership.create({
      data: {
        userId: user.id,
        workspaceId: ws.id,
        role: "OWNER",
      },
    });
    console.log("Linked user as OWNER of Default Workspace.");
  }

  console.log("\n=== STEP 4: Generating High-Entropy Secret API Key 'Production-Ingest-Key' ===");
  const entropyHex = crypto.randomBytes(24).toString("hex");
  const rawKey = `pfl_live_${entropyHex}`;
  const keyPrefix = `${rawKey.substring(0, 13)}...${rawKey.substring(rawKey.length - 4)}`;
  const hashedKey = await bcrypt.hash(rawKey, 10);

  const apiKey = await prisma.apiKey.create({
    data: {
      name: "Production-Ingest-Key",
      keyPrefix,
      hashedKey,
      scopes: "events:write,metrics:read",
      rateLimit: 120,
      workspaceId: ws.id,
      userId: user.id,
    },
  });

  console.log("Generated API Key successfully:");
  console.log("  Key ID:        ", apiKey.id);
  console.log("  Key Name:      ", apiKey.name);
  console.log("  Key Prefix:    ", apiKey.keyPrefix);
  console.log("  Raw Secret Token: ", rawKey);

  console.log("\n=== STEP 5: Testing Telemetry Ingestion HTTP Call ===");
  const testPayload = {
    eventType: "test_telemetry",
    source: "automation-script",
    payload: {
      event: "test_telemetry",
      workspace: "Default Workspace",
      count: 1,
      status: "operational",
    },
  };

  const response = await fetch("http://localhost:5000/api/v1/telemetry/ingest", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${rawKey}`,
      "Content-Type": "application/json",
      "X-Organization-Name": "For Console's Team",
      "X-Workspace-Name": "Default Workspace",
    },
    body: JSON.stringify(testPayload),
  });

  const resJson = await response.json();
  console.log("HTTP Response Status:", response.status);
  console.log("Response JSON:", JSON.stringify(resJson, null, 2));

  // Verify updated workspace quota
  const updatedWs = await prisma.workspace.findUnique({
    where: { id: ws.id },
    select: { requestsThisMonth: true, monthlyRequestLimit: true },
  });
  console.log("\nVerified Updated Workspace Quota:", `${updatedWs?.requestsThisMonth} / ${updatedWs?.monthlyRequestLimit} events`);
}

run()
  .catch((e) => {
    console.error("Setup error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
