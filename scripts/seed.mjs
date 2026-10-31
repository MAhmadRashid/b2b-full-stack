import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing data in reverse order of relationships
  await prisma.notification.deleteMany({});
  await prisma.usageRecord.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.metricEvent.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.organizationMembership.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Create Superadmin User
  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@pulseflow.io",
      name: "Alex Sterling (Admin)",
      passwordHash,
      systemRole: "SUPERADMIN",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    },
  });

  // 2. Create Demo Business User
  const demoUser = await prisma.user.create({
    data: {
      email: "demo@acmecorp.com",
      name: "Elena Rostova",
      passwordHash,
      systemRole: "USER",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80",
    },
  });

  // 3. Create Additional Team Members
  const engineerUser = await prisma.user.create({
    data: {
      email: "dev@acmecorp.com",
      name: "Marcus Vance",
      passwordHash,
      systemRole: "USER",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    },
  });

  const viewerUser = await prisma.user.create({
    data: {
      email: "auditor@acmecorp.com",
      name: "Sarah Chen",
      passwordHash,
      systemRole: "USER",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80",
    },
  });

  // 4. Create Organizations
  const acmeOrg = await prisma.organization.create({
    data: {
      name: "Acme Corporation",
      slug: "acme-corp",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop",
      ownerId: demoUser.id,
    },
  });

  const starlightOrg = await prisma.organization.create({
    data: {
      name: "Starlight Telemetry AI",
      slug: "starlight-ai",
      logoUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=100&h=100&fit=crop",
      ownerId: superAdmin.id,
    },
  });

  // 5. Create Organization Memberships
  await prisma.organizationMembership.createMany({
    data: [
      { userId: demoUser.id, organizationId: acmeOrg.id, role: "OWNER" },
      { userId: engineerUser.id, organizationId: acmeOrg.id, role: "ADMIN" },
      { userId: viewerUser.id, organizationId: acmeOrg.id, role: "VIEWER" },
      { userId: superAdmin.id, organizationId: acmeOrg.id, role: "MEMBER" },

      { userId: superAdmin.id, organizationId: starlightOrg.id, role: "OWNER" },
      { userId: demoUser.id, organizationId: starlightOrg.id, role: "ADMIN" },
    ],
  });

  // 6. Create Workspaces linked to Organizations with Creators
  const acmeWorkspace = await prisma.workspace.create({
    data: {
      name: "Acme Corp Cloud",
      slug: "acme-corp",
      plan: "PRO",
      billingCycle: "MONTHLY",
      subscriptionStatus: "ACTIVE",
      monthlyRequestLimit: 250000,
      requestsThisMonth: 168420,
      organizationId: acmeOrg.id,
      creatorId: demoUser.id,
    },
  });

  const acmeStagingWorkspace = await prisma.workspace.create({
    data: {
      name: "Acme Staging Cluster",
      slug: "acme-staging",
      plan: "STARTER",
      billingCycle: "MONTHLY",
      subscriptionStatus: "ACTIVE",
      monthlyRequestLimit: 50000,
      requestsThisMonth: 12400,
      organizationId: acmeOrg.id,
      creatorId: engineerUser.id,
    },
  });

  const starlightWorkspace = await prisma.workspace.create({
    data: {
      name: "Starlight Telemetry AI",
      slug: "starlight-ai",
      plan: "ENTERPRISE",
      billingCycle: "ANNUAL",
      subscriptionStatus: "ACTIVE",
      monthlyRequestLimit: 1000000,
      requestsThisMonth: 489310,
      organizationId: starlightOrg.id,
      creatorId: superAdmin.id,
    },
  });

  // 7. Create Memberships with RBAC roles
  await prisma.membership.createMany({
    data: [
      { userId: demoUser.id, workspaceId: acmeWorkspace.id, role: "OWNER" },
      { userId: engineerUser.id, workspaceId: acmeWorkspace.id, role: "ADMIN" },
      { userId: viewerUser.id, workspaceId: acmeWorkspace.id, role: "VIEWER" },
      { userId: superAdmin.id, workspaceId: acmeWorkspace.id, role: "MEMBER" },

      { userId: demoUser.id, workspaceId: acmeStagingWorkspace.id, role: "OWNER" },
      { userId: engineerUser.id, workspaceId: acmeStagingWorkspace.id, role: "ADMIN" },

      { userId: demoUser.id, workspaceId: starlightWorkspace.id, role: "ADMIN" },
      { userId: superAdmin.id, workspaceId: starlightWorkspace.id, role: "OWNER" },
    ],
  });

  // 8. Seed Sample Pending Invitations
  await prisma.invitation.createMany({
    data: [
      {
        workspaceId: acmeWorkspace.id,
        organizationId: acmeOrg.id,
        email: "contractor@acmecorp.com",
        role: "MEMBER",
        token: "inv_demo_contractor_token_123",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        inviterEmail: demoUser.email,
        status: "PENDING",
      },
    ],
  });

  // 6. Create API Keys
  const key1SecretHash = await bcrypt.hash("pfl_live_9941a82f33c0e", 10);
  const key2SecretHash = await bcrypt.hash("pfl_test_5419b78e22c9a", 10);
  const key3SecretHash = await bcrypt.hash("pfl_live_4490c33d88e1b", 10);

  await prisma.apiKey.createMany({
    data: [
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        name: "Production Cluster US-East",
        keyPrefix: "pfl_live_9941...",
        hashedKey: key1SecretHash,
        scopes: "metrics:read,events:write,telemetry:stream",
        lastUsedAt: new Date(Date.now() - 1000 * 60 * 12),
        revoked: false,
      },
      {
        workspaceId: acmeWorkspace.id,
        userId: engineerUser.id,
        name: "Staging Ingestion Gateway",
        keyPrefix: "pfl_test_5419...",
        hashedKey: key2SecretHash,
        scopes: "metrics:read,events:write",
        lastUsedAt: new Date(Date.now() - 1000 * 60 * 140),
        revoked: false,
      },
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        name: "Deprecated Lambda Hook",
        keyPrefix: "pfl_live_4490...",
        hashedKey: key3SecretHash,
        scopes: "metrics:read",
        lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
        revoked: true,
      },
    ],
  });

  // 7. Seed Realistic Metric Events
  const sources = ["us-east-1-api", "eu-central-ingress", "cron-worker-01", "edge-router-sea"];
  const eventTypes = ["api_request", "telemetry_sync", "auth_verify", "webhook_dispatch", "batch_export"];
  const statuses = [
    { status: "SUCCESS", code: 200, weight: 85 },
    { status: "SUCCESS", code: 201, weight: 8 },
    { status: "WARNING", code: 429, weight: 4 },
    { status: "ERROR", code: 500, weight: 3 },
  ];

  const metricEventsData = [];
  const now = Date.now();

  for (let i = 0; i < 150; i++) {
    const randomOffsetMs = Math.floor(Math.random() * 86400000 * 7); // over last 7 days
    const timestamp = new Date(now - randomOffsetMs);
    const source = sources[Math.floor(Math.random() * sources.length)];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    // Weighted status
    const rand = Math.random() * 100;
    let selectedStatus = statuses[0];
    let cumulative = 0;
    for (const s of statuses) {
      cumulative += s.weight;
      if (rand <= cumulative) {
        selectedStatus = s;
        break;
      }
    }

    const latencyMs = selectedStatus.code === 500 
      ? Math.floor(Math.random() * 800) + 400 
      : Math.floor(Math.random() * 60) + 18;

    metricEventsData.push({
      workspaceId: acmeWorkspace.id,
      eventType,
      source,
      status: selectedStatus.status,
      statusCode: selectedStatus.code,
      latencyMs,
      payload: JSON.stringify({
        endpoint: `/v1/${eventType}`,
        ip: `198.51.100.${Math.floor(Math.random() * 254) + 1}`,
        region: source.startsWith("eu") ? "eu-central-1" : "us-east-1",
      }),
      timestamp,
    });
  }

  await prisma.metricEvent.createMany({
    data: metricEventsData,
  });

  // 8. Invoices
  await prisma.invoice.createMany({
    data: [
      {
        workspaceId: acmeWorkspace.id,
        invoiceNumber: "INV-2026-0091",
        amountCents: 9900,
        currency: "USD",
        status: "PAID",
        periodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        periodEnd: new Date(Date.now()),
        pdfUrl: "/invoices/INV-2026-0091.pdf",
      },
      {
        workspaceId: acmeWorkspace.id,
        invoiceNumber: "INV-2026-0082",
        amountCents: 9900,
        currency: "USD",
        status: "PAID",
        periodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
        periodEnd: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        pdfUrl: "/invoices/INV-2026-0082.pdf",
      },
      {
        workspaceId: acmeWorkspace.id,
        invoiceNumber: "INV-2026-0075",
        amountCents: 4900,
        currency: "USD",
        status: "PAID",
        periodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
        periodEnd: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
        pdfUrl: "/invoices/INV-2026-0075.pdf",
      },
    ],
  });

  // 9. Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        userEmail: demoUser.email,
        action: "WORKSPACE_PLAN_UPGRADED",
        details: "Workspace plan upgraded from STARTER ($0/mo) to PRO ($99/mo)",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18),
      },
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        userEmail: demoUser.email,
        action: "API_KEY_CREATED",
        details: "Created production API key 'Production Cluster US-East'",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      },
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        userEmail: demoUser.email,
        action: "TEAM_MEMBER_INVITED",
        details: "Invited dev@acmecorp.com as workspace ADMIN",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8),
      },
      {
        workspaceId: acmeWorkspace.id,
        userId: engineerUser.id,
        userEmail: engineerUser.email,
        action: "KEY_ROTATION_REQUESTED",
        details: "Revoked legacy API key 'Deprecated Lambda Hook'",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        userEmail: demoUser.email,
        action: "USER_AUTHENTICATION",
        details: "Successful login via session cookie from IP 192.168.1.1",
      },
    ],
  });

  // 8. Seed Subscriptions
  await prisma.subscription.create({
    data: {
      workspaceId: acmeWorkspace.id,
      tier: "PRO",
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      currentPeriodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18),
      cancelAtPeriodEnd: false,
      stripeCustomerId: "cus_demo_acme123",
      stripeSubscriptionId: "sub_demo_acme456",
    },
  });

  await prisma.subscription.create({
    data: {
      workspaceId: starlightWorkspace.id,
      tier: "ENTERPRISE",
      billingCycle: "ANNUAL",
      status: "ACTIVE",
      currentPeriodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 305),
      cancelAtPeriodEnd: false,
      stripeCustomerId: "cus_demo_starlight123",
      stripeSubscriptionId: "sub_demo_starlight456",
    },
  });

  // 9. Seed Notifications
  await prisma.notification.createMany({
    data: [
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        title: "Monthly Ingestion Quota at 67%",
        message: "Acme Corp Cloud has ingested 168,420 of 250,000 telemetry events this cycle.",
        type: "WARNING",
        read: false,
        link: "/dashboard/billing",
      },
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        title: "New Team Member Onboarded",
        message: "Marcus Vance accepted the invitation to join as workspace ADMIN.",
        type: "SUCCESS",
        read: true,
        link: "/dashboard/team",
      },
      {
        workspaceId: acmeWorkspace.id,
        userId: demoUser.id,
        title: "Invoice Paid Successfully",
        message: "Invoice INV-2026-8491 for $99.00 USD has been settled.",
        type: "BILLING",
        read: true,
        link: "/dashboard/billing",
      },
    ],
  });

  // 10. Seed Usage Records (Last 7 Days)
  const currentDate = new Date();
  const usageData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(currentDate);
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);

    const baseEvents = 20000 + Math.floor(Math.random() * 8000);
    const errors = Math.floor(baseEvents * 0.015);
    const latency = 28 + Math.floor(Math.random() * 14);

    usageData.push({
      workspaceId: acmeWorkspace.id,
      date: d,
      totalEvents: baseEvents,
      errorsCount: errors,
      avgLatency: latency,
    });
  }
  await prisma.usageRecord.createMany({ data: usageData });

  console.log("Database seeded successfully!");
  console.log("Test Accounts created:");
  console.log("1. Superadmin: admin@pulseflow.io / Password123!");
  console.log("2. Demo User:   demo@acmecorp.com / Password123!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
