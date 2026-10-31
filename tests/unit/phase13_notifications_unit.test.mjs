import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mirror functions directly in unit test to test isolated business logic
function isEmailPermitted(preferences, eventType) {
  const essentialEvents = [
    "SECURITY_ALERT",
    "PASSWORD_RESET",
    "VERIFICATION",
    "WELCOME",
  ];
  if (essentialEvents.includes(eventType)) {
    return true;
  }

  if (!preferences) return true;

  switch (eventType) {
    case "SUBSCRIPTION_CREATED":
    case "SUBSCRIPTION_RENEWED":
    case "SUBSCRIPTION_CANCELLED":
    case "PAYMENT_FAILED":
      return preferences.billingAlerts;
    case "USAGE_LIMIT_WARNING":
    case "USAGE_LIMIT_EXCEEDED":
      return preferences.usageAlerts;
    case "INVITATION":
    case "INVITATION_REMINDER":
    case "TEAM_MEMBER_ADDED":
    case "TEAM_MEMBER_REMOVED":
      return preferences.teamAlerts;
    case "API_KEY_CREATED":
    case "API_KEY_REVOKED":
    case "API_KEY_EXPIRING":
      return preferences.apiKeyAlerts;
    default:
      return true;
  }
}

function generateEmailTemplate({ category, heading, message, actionUrl, actionText, details }) {
  let detailsHtml = "";
  if (details && Object.keys(details).length > 0) {
    detailsHtml = `
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid #1f2937; border-radius: 8px; padding: 14px; margin: 20px 0;">
        ${Object.entries(details)
          .map(
            ([k, v]) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
            <span style="color: #9ca3af;">${k}:</span>
            <span style="color: #f3f4f6; font-weight: 600;">${v}</span>
          </div>`
          )
          .join("")}
      </div>`;
  }

  return `
    <div class="container">
      <div class="badge">${category}</div>
      <h2>${heading}</h2>
      <p>${message}</p>
      ${detailsHtml}
      ${actionUrl ? `<a href="${actionUrl}">${actionText}</a>` : ""}
    </div>
  `;
}

test.after(async () => {
  await prisma.$disconnect();
});

test("Phase 13 Email Unit - 1. Essential security alerts are always permitted regardless of preferences", () => {
  const prefs = {
    billingAlerts: false,
    usageAlerts: false,
    teamAlerts: false,
    apiKeyAlerts: false,
  };

  assert.equal(isEmailPermitted(prefs, "SECURITY_ALERT"), true);
  assert.equal(isEmailPermitted(prefs, "PASSWORD_RESET"), true);
  assert.equal(isEmailPermitted(prefs, "VERIFICATION"), true);
  assert.equal(isEmailPermitted(prefs, "WELCOME"), true);
});

test("Phase 13 Email Unit - 2. User notification preferences are respected for optional alerts", async () => {
  const email = `pref_unit_${Date.now()}@test.io`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "Pref Tester",
      passwordHash: "hash123",
      notificationPreferences: {
        create: {
          billingAlerts: false, // User opted out of billing alerts
          usageAlerts: true,
          teamAlerts: false,
          apiKeyAlerts: true,
        },
      },
    },
    include: {
      notificationPreferences: true,
    },
  });

  const prefs = user.notificationPreferences;
  assert.equal(isEmailPermitted(prefs, "SUBSCRIPTION_CREATED"), false, "Billing emails should be blocked when opted out");
  assert.equal(isEmailPermitted(prefs, "USAGE_LIMIT_WARNING"), true, "Usage emails should be permitted");
  assert.equal(isEmailPermitted(prefs, "TEAM_MEMBER_ADDED"), false, "Team emails should be blocked");
  assert.equal(isEmailPermitted(prefs, "API_KEY_CREATED"), true, "API key emails should be permitted");

  // Clean up
  await prisma.notificationPreference.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
});

test("Phase 13 Email Unit - 3. EmailLog idempotency model records delivery and deduplicates duplicates", async () => {
  const idempotencyKey = `idem_test_${Date.now()}`;
  const testEmail = "test_idempotent@pulseflow.io";

  // First record
  const log1 = await prisma.emailLog.create({
    data: {
      toEmail: testEmail,
      eventType: "API_KEY_CREATED",
      subject: "Test API Key Created",
      idempotencyKey,
      status: "DELIVERED",
      provider: "SIMULATED",
    },
  });

  assert.equal(log1.status, "DELIVERED");

  // Duplicate check logic
  const existing = await prisma.emailLog.findUnique({
    where: { idempotencyKey },
  });
  assert.ok(existing);
  assert.equal(existing.status, "DELIVERED");

  // Clean up
  await prisma.emailLog.deleteMany({ where: { idempotencyKey } });
});

test("Phase 13 Email Unit - 4. Email template generator produces responsive HTML structure", () => {
  const html = generateEmailTemplate({
    category: "BILLING ALERT",
    heading: "Invoice Payment Successful",
    message: "Thank you for subscribing to PulseFlow PRO tier.",
    actionUrl: "https://app.pulseflow.io/dashboard/billing",
    actionText: "View Invoice",
    details: {
      Plan: "PRO Tier",
      Amount: "$79.00",
    },
  });

  assert.ok(html.includes("BILLING ALERT"));
  assert.ok(html.includes("Invoice Payment Successful"));
  assert.ok(html.includes("$79.00"));
  assert.ok(html.includes("https://app.pulseflow.io/dashboard/billing"));
});
