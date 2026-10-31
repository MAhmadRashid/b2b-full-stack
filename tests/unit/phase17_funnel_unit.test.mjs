import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.ts";

test("Phase 17 Funnel Unit - 1. Lead Capture Model and Input Validations", async (t) => {
  const testEmail = `lead_test_${Date.now()}@acmetech.io`;

  // Create lead submission
  const lead = await prisma.leadSubmission.create({
    data: {
      name: "Engineering Director",
      workEmail: testEmail,
      company: "Acme Tech Systems",
      teamSize: "51-200",
      message: "Looking for high-volume edge telemetry ingestion with 30-day retention and private VPC.",
      consent: true,
      status: "NEW",
      source: "WEBSITE_CONTACT_SALES",
      ipAddress: "127.0.0.1",
    },
  });

  assert.ok(lead.id, "Lead submission should receive generated ID");
  assert.equal(lead.workEmail, testEmail);
  assert.equal(lead.company, "Acme Tech Systems");
  assert.equal(lead.status, "NEW");
  assert.equal(lead.consent, true);

  // Query and verify retrieval
  const retrieved = await prisma.leadSubmission.findUnique({
    where: { id: lead.id },
  });
  assert.ok(retrieved, "Lead must be retrievable from database");
  assert.equal(retrieved?.teamSize, "51-200");

  // Clean up
  await prisma.leadSubmission.delete({ where: { id: lead.id } });
});

test("Phase 17 Funnel Unit - 2. Demo Booking Request Model and Lifecycle", async (t) => {
  const testEmail = `demo_test_${Date.now()}@fintechscale.com`;

  // Create demo booking request
  const demoReq = await prisma.demoBookingRequest.create({
    data: {
      name: "Lead Architect",
      workEmail: testEmail,
      company: "Fintech Scale Inc",
      teamSize: "201-1000",
      preferredTime: "Tomorrow Morning (09:00 - 12:00)",
      timezone: "America/New_York",
      focusArea: "LATENCY",
      notes: "Need guidance on sub-20ms edge ingestion and multi-region routing.",
      status: "PENDING_REVIEW",
      ipAddress: "127.0.0.1",
    },
  });

  assert.ok(demoReq.id, "Demo request should receive generated ID");
  assert.equal(demoReq.workEmail, testEmail);
  assert.equal(demoReq.status, "PENDING_REVIEW");
  assert.equal(demoReq.focusArea, "LATENCY");

  // Transition to SCHEDULED
  const updated = await prisma.demoBookingRequest.update({
    where: { id: demoReq.id },
    data: { status: "SCHEDULED" },
  });
  assert.equal(updated.status, "SCHEDULED");

  // Clean up
  await prisma.demoBookingRequest.delete({ where: { id: demoReq.id } });
});

test("Phase 17 Funnel Unit - 3. Anti-Spam Disposable Domain Detection", async (t) => {
  const BLOCKED_DOMAINS = ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com", "throwawaymail.com"];
  
  const isBlocked = (email) => {
    const domain = email.toLowerCase().trim().split("@")[1];
    return BLOCKED_DOMAINS.includes(domain);
  };

  assert.equal(isBlocked("spammer@mailinator.com"), true);
  assert.equal(isBlocked("test@tempmail.com"), true);
  assert.equal(isBlocked("engineer@stripe.com"), false);
  assert.equal(isBlocked("lead@acme.org"), false);
});

test("Phase 17 Funnel Unit - 4. Dynamic Latency Percentiles & Summary Calculation", async (t) => {
  const sampleEvents = [
    { code: 200, region: "us-east-1", lat: 18 },
    { code: 200, region: "us-west-2", lat: 24 },
    { code: 429, region: "us-east-1", lat: 88 },
    { code: 500, region: "eu-central-1", lat: 142 },
    { code: 200, region: "ap-southeast-1", lat: 28 },
  ];

  // Helper calculating metrics like LandingPage
  const calculateMetrics = (events) => {
    const count = events.length;
    if (count === 0) return { count: 0, p50: 0, p95: 0, errorRate: 0 };
    const latencies = events.map((e) => e.lat).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(count * 0.5)];
    const p95 = latencies[Math.floor(count * 0.95)] || latencies[count - 1];
    const errors = events.filter((e) => e.code >= 400).length;
    const errorRate = Math.round((errors / count) * 100);
    return { count, p50, p95, errorRate };
  };

  const allMetrics = calculateMetrics(sampleEvents);
  assert.equal(allMetrics.count, 5);
  assert.equal(allMetrics.p50, 28);
  assert.equal(allMetrics.errorRate, 40); // 2 out of 5 are 429 or 500

  // Filter only 200 OK
  const okEvents = sampleEvents.filter((e) => e.code === 200);
  const okMetrics = calculateMetrics(okEvents);
  assert.equal(okMetrics.count, 3);
  assert.equal(okMetrics.p50, 24);
  assert.equal(okMetrics.errorRate, 0);
});

test("Phase 17 Funnel Unit - 5. Pricing Entitlements Alignment", async (t) => {
  const { SUBSCRIPTION_PLANS } = await import("../../src/lib/billing-plans.ts");

  // Verify Pro Plan exists and has honest limits
  const pro = SUBSCRIPTION_PLANS.PRO;
  assert.ok(pro, "PRO plan must exist");
  assert.equal(pro.limits.monthlyRequests, 250000);
  assert.equal(pro.limits.maxWorkspaces, 10);
  assert.equal(pro.limits.maxTeamMembers, 15);
  assert.equal(pro.limits.telemetryRetentionDays, 30);

  // Verify Starter Plan limits
  const starter = SUBSCRIPTION_PLANS.STARTER;
  assert.ok(starter, "STARTER plan must exist");
  assert.equal(starter.limits.monthlyRequests, 50000);
  assert.equal(starter.limits.maxWorkspaces, 3);
  assert.equal(starter.limits.maxTeamMembers, 5);

  // Verify Business Plan limits
  const business = SUBSCRIPTION_PLANS.BUSINESS;
  assert.ok(business, "BUSINESS plan must exist");
  assert.equal(business.limits.monthlyRequests, 1000000);
  assert.equal(business.limits.maxWorkspaces, 25);
  assert.equal(business.limits.maxTeamMembers, 50);
});
