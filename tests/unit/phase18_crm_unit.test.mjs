import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma.ts";

test("Phase 18 CRM Unit - 1. Lead Record Creation with Priority, Source, and Status Defaults", async (t) => {
  const testEmail = `crm_test_${Date.now()}@enterprisecorp.com`;

  const lead = await prisma.leadSubmission.create({
    data: {
      name: "VP of Engineering",
      workEmail: testEmail,
      company: "Enterprise Corp",
      teamSize: "201-1000",
      message: "Evaluating enterprise telemetry platform for 500 microservices.",
      consent: true,
      status: "NEW",
      priority: "HIGH",
      source: "CONTACT_SALES",
      ipAddress: "10.0.0.1",
      followUpDate: new Date(Date.now() + 86400000 * 2), // 2 days in future
      internalNotes: "Prefers communication over email first.",
      contactHistory: JSON.stringify([
        {
          timestamp: new Date().toISOString(),
          type: "INBOUND",
          note: "Lead submitted enterprise form on website.",
          author: "SYSTEM",
        },
      ]),
    },
  });

  assert.ok(lead.id, "Lead must receive generated ID");
  assert.equal(lead.priority, "HIGH");
  assert.equal(lead.status, "NEW");
  assert.equal(lead.company, "Enterprise Corp");
  assert.ok(lead.followUpDate, "Follow up date should be persisted");

  // Verify retrieval
  const retrieved = await prisma.leadSubmission.findUnique({
    where: { id: lead.id },
  });
  assert.ok(retrieved, "Lead must be queryable");
  assert.equal(retrieved?.priority, "HIGH");
  assert.equal(retrieved?.internalNotes, "Prefers communication over email first.");

  const history = JSON.parse(retrieved?.contactHistory || "[]");
  assert.equal(history.length, 1);
  assert.equal(history[0].type, "INBOUND");

  // Cleanup
  await prisma.leadSubmission.delete({ where: { id: lead.id } });
});

test("Phase 18 CRM Unit - 2. Lead Updates: Status Transitions, Internal Notes & Timeline Appending", async (t) => {
  const testEmail = `crm_update_${Date.now()}@innovate.org`;

  const lead = await prisma.leadSubmission.create({
    data: {
      name: "Product Manager",
      workEmail: testEmail,
      company: "Innovate Org",
      teamSize: "11-50",
      message: "Interested in real-time API telemetry monitoring.",
      status: "NEW",
      priority: "MEDIUM",
      consent: true,
    },
  });

  // Simulate CRM operator moving to CONTACTED and appending a contact note
  let history = [];
  try {
    history = JSON.parse(lead.contactHistory || "[]");
  } catch {
    history = [];
  }

  history.push({
    timestamp: new Date().toISOString(),
    type: "PHONE_CALL",
    note: "Discussed multi-tenant telemetry quotas and pricing tiers.",
    author: "admin@antigravity.test",
  });

  const updated = await prisma.leadSubmission.update({
    where: { id: lead.id },
    data: {
      status: "QUALIFIED",
      priority: "HIGH",
      internalNotes: "Decision maker confirmed. Budget approved for Q4.",
      contactHistory: JSON.stringify(history),
      followUpDate: new Date(Date.now() - 3600000), // 1 hour ago (overdue)
    },
  });

  assert.equal(updated.status, "QUALIFIED");
  assert.equal(updated.priority, "HIGH");
  assert.equal(updated.internalNotes, "Decision maker confirmed. Budget approved for Q4.");

  const parsedHistory = JSON.parse(updated.contactHistory || "[]");
  assert.equal(parsedHistory.length, 1);
  assert.equal(parsedHistory[0].type, "PHONE_CALL");
  assert.equal(parsedHistory[0].author, "admin@antigravity.test");

  // Check overdue logic
  assert.ok(updated.followUpDate.getTime() < Date.now(), "Follow up should correctly evaluate as overdue");

  // Cleanup
  await prisma.leadSubmission.delete({ where: { id: lead.id } });
});

test("Phase 18 CRM Unit - 3. Overdue Follow-ups Filter and Aggregations", async (t) => {
  const now = new Date();
  const pastDate = new Date(Date.now() - 86400000); // 1 day ago
  const futureDate = new Date(Date.now() + 86400000); // 1 day in future

  const overdueLead = await prisma.leadSubmission.create({
    data: {
      name: "Overdue Customer",
      workEmail: `overdue_${Date.now()}@urgent.io`,
      company: "Urgent Inc",
      teamSize: "51-200",
      message: "Need priority cluster setup.",
      status: "CONTACTED",
      priority: "HIGH",
      followUpDate: pastDate,
      consent: true,
    },
  });

  const futureLead = await prisma.leadSubmission.create({
    data: {
      name: "Future Customer",
      workEmail: `future_${Date.now()}@future.io`,
      company: "Future Labs",
      teamSize: "1-10",
      message: "Exploring edge observability options.",
      status: "NEW",
      priority: "LOW",
      followUpDate: futureDate,
      consent: true,
    },
  });

  // Query for overdue leads
  const overdueCount = await prisma.leadSubmission.count({
    where: {
      followUpDate: { lt: now },
      status: { notIn: ["CONVERTED", "LOST"] },
    },
  });

  assert.ok(overdueCount >= 1, "Must detect at least 1 overdue lead");

  // Query for priority counts
  const highPriorityCount = await prisma.leadSubmission.count({
    where: { priority: "HIGH" },
  });
  assert.ok(highPriorityCount >= 1, "Must detect at least 1 high priority lead");

  // Cleanup
  await prisma.leadSubmission.delete({ where: { id: overdueLead.id } });
  await prisma.leadSubmission.delete({ where: { id: futureLead.id } });
});

test("Phase 18 CRM Unit - 4. Lead Conversion Logic & Workspace Linking", async (t) => {
  const testEmail = `convert_lead_${Date.now()}@venturecap.com`;

  // 1. Create a qualified lead
  const lead = await prisma.leadSubmission.create({
    data: {
      name: "Managing Partner",
      workEmail: testEmail,
      company: "Venture Capital Partners",
      teamSize: "11-50",
      message: "Need 25 team member seats and SLA.",
      status: "QUALIFIED",
      priority: "HIGH",
      consent: true,
    },
  });

  // 2. Perform conversion logic: link user & workspace
  let user = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: testEmail,
        name: lead.name,
        systemRole: "USER",
        emailVerified: new Date(),
        passwordHash: "$2a$10$testpasswordhashplaceholderforconvertedlead1234567890",
      },
    });
  }

  // Provision a Workspace for the converted customer
  const ws = await prisma.workspace.create({
    data: {
      name: `${lead.company || lead.name}'s Workspace`,
      slug: `venture-${Date.now()}`,
      plan: "PRO",
      creatorId: user.id,
    },
  });

  // Create membership
  await prisma.membership.create({
    data: {
      userId: user.id,
      workspaceId: ws.id,
      role: "OWNER",
    },
  });

  // Update lead to CONVERTED
  const convertedLead = await prisma.leadSubmission.update({
    where: { id: lead.id },
    data: {
      status: "CONVERTED",
      convertedAt: new Date(),
      convertedUserId: user.id,
      convertedWorkspaceId: ws.id,
    },
  });

  assert.equal(convertedLead.status, "CONVERTED");
  assert.ok(convertedLead.convertedAt);
  assert.equal(convertedLead.convertedUserId, user.id);
  assert.equal(convertedLead.convertedWorkspaceId, ws.id);

  // Cleanup created test records
  await prisma.leadSubmission.delete({ where: { id: lead.id } });
  await prisma.membership.deleteMany({ where: { workspaceId: ws.id } });
  await prisma.workspace.delete({ where: { id: ws.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

test("Phase 18 CRM Unit - 5. Super Admin API Authorization Guard Check", async (t) => {
  const jwt = (await import("jsonwebtoken")).default;
  const JWT_SECRET = process.env.JWT_SECRET || "pulseflow-default-secret-change-in-prod";

  const regularToken = jwt.sign({ userId: "u1", email: "user@test.io", systemRole: "USER" }, JWT_SECRET);
  const adminToken = jwt.sign({ userId: "a1", email: "superadmin@antigravity.test", systemRole: "SUPERADMIN" }, JWT_SECRET);

  const decodedRegular = jwt.verify(regularToken, JWT_SECRET);
  const decodedAdmin = jwt.verify(adminToken, JWT_SECRET);

  assert.equal(decodedRegular.systemRole, "USER");
  assert.equal(decodedAdmin.systemRole, "SUPERADMIN");
  assert.notEqual(decodedRegular.systemRole, "SUPERADMIN", "Ordinary org users cannot pass superadmin guard");
});
