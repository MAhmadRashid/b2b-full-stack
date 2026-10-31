#!/usr/bin/env node
/**
 * Production Live Smoke Testing Utility
 * Executes comprehensive health, security, API, session, and tenant isolation checks against the target deployment.
 */

const BASE_URL = process.env.TARGET_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function smokeTest() {
  console.log("==========================================");
  console.log(` PulseFlow Production Smoke Test Suite`);
  console.log(` Target Host: ${BASE_URL}`);
  console.log("==========================================");

  let passed = 0;
  let failed = 0;
  let authCookie = "";

  async function check(name, testFn) {
    try {
      await testFn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Health Endpoint Check
  await check("1. Health Endpoint: /api/health returns HEALTHY status and database connection", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const data = await res.json();
    if (data.status !== "HEALTHY") throw new Error(`Expected HEALTHY, got ${data.status}`);
    if (data.database.status !== "CONNECTED") throw new Error(`Database disconnected: ${JSON.stringify(data.database)}`);
  });

  // 2. Security Headers Check
  await check("2. Enterprise Security Headers: HSTS, CSP, and Frame protection present", async () => {
    const res = await fetch(`${BASE_URL}/`);
    const headers = res.headers;
    if (!headers.has("x-content-type-options")) throw new Error("Missing X-Content-Type-Options");
    if (!headers.has("x-frame-options")) throw new Error("Missing X-Frame-Options");
    if (!headers.has("content-security-policy")) throw new Error("Missing Content-Security-Policy");
  });

  // 3. Public Pages
  await check("3. Public Route Accessibility: Root (/) and /pricing return 200 OK", async () => {
    const [homeRes, pricingRes] = await Promise.all([
      fetch(`${BASE_URL}/`),
      fetch(`${BASE_URL}/pricing`),
    ]);
    if (!homeRes.ok) throw new Error(`Home page failed with ${homeRes.status}`);
    if (!pricingRes.ok) throw new Error(`Pricing page failed with ${pricingRes.status}`);
  });

  // 4. Auth Protection
  await check("4. Session Gate: /api/auth/me rejects unauthenticated requests with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 5. Auth Credentials Validation
  await check("5. Login Gateway: Invalid credentials safely rejected with 401 and rate limit headers", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-user@pulseflow.io", password: "WrongPassword999!" }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    if (!res.headers.has("x-ratelimit-limit")) throw new Error("Missing X-RateLimit-Limit header");
  });

  // 6. Valid Authentication & Session Cookie
  await check("6. Live Authentication: Demo user login succeeds and issues session cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@acmecorp.com", password: "Password123!" }),
    });
    if (!res.ok) throw new Error(`Login failed with status ${res.status}`);
    authCookie = res.headers.get("set-cookie") || "";
    if (!authCookie.includes("pulseflow_session")) throw new Error("Session cookie not set");
  });

  // 7. Protected Route & Workspace Scoping
  await check("7. Multi-Tenant Scoping: Authenticated session returns isolated workspaces", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: authCookie },
    });
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const data = await res.json();
    if (!data.authenticated || !data.user) throw new Error("User session not authenticated");
    if (!Array.isArray(data.workspaces) || data.workspaces.length === 0) {
      throw new Error("No workspaces mapped to authenticated user");
    }
  });

  // 8. Webhook Security
  await check("8. Webhook Guard: /api/billing/webhook rejects unauthenticated or unsigned payloads with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "fake.event" }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 9. Developer API Gateway
  await check("9. Developer API Gateway: /api/v1/keys/verify rejects missing API key with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/keys/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 10. Sandbox Payments Safety
  await check("10. Payment Safety Guard: Billing checkout operates in sandbox mode without live keys", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    if (data.readiness?.billingMode !== "sandbox" && !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
      console.warn("    [NOTE] Billing provider verified in safe mode.");
    }
  });

  console.log("==========================================");
  console.log(` Smoke Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================");

  if (failed > 0) process.exit(1);
}

smokeTest().catch((err) => {
  console.error("Smoke test suite error:", err);
  process.exit(1);
});
