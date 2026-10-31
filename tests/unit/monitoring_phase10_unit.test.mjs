import test from "node:test";
import assert from "node:assert/strict";
import { logger, scrubSensitiveData } from "../../src/lib/logger.ts";
import {
  recordRequestLatency,
  calculatePercentiles,
  getSlowRequests,
  resetPerformanceMetrics,
} from "../../src/lib/performance-monitor.ts";

test("Phase 10 QA - 1. PII Scrubbing: Automatically redacts passwords, tokens, and secrets", () => {
  const dirtyPayload = {
    user: "john_doe",
    email: "john@example.com",
    password: "SuperSecretPassword123!",
    currentPassword: "OldPassword123!",
    apiKey: "pfl_live_1234567890abcdef",
    secret: "whsec_test_secret_key",
    authorization: "Bearer eyJhbGciOi...",
    cookie: "pulseflow_session=token123",
    nested: {
      card_number: "4111222233334444",
      cvv: "123",
      safeNote: "Customer requested upgrade",
    },
  };

  const clean = scrubSensitiveData(dirtyPayload);

  assert.equal(clean.user, "john_doe");
  assert.equal(clean.email, "john@example.com");
  assert.equal(clean.password, "[REDACTED]");
  assert.equal(clean.currentPassword, "[REDACTED]");
  assert.equal(clean.apiKey, "[REDACTED]");
  assert.equal(clean.secret, "[REDACTED]");
  assert.equal(clean.authorization, "[REDACTED]");
  assert.equal(clean.cookie, "[REDACTED]");
  assert.equal(clean.nested.card_number, "[REDACTED]");
  assert.equal(clean.nested.cvv, "[REDACTED]");
  assert.equal(clean.nested.safeNote, "Customer requested upgrade");
});

test("Phase 10 QA - 2. Circular References: Scrubbing handles circular objects without throwing", () => {
  const circularObj = { name: "Root Object" };
  circularObj.self = circularObj;

  const result = scrubSensitiveData(circularObj);
  assert.equal(result.name, "Root Object");
  assert.equal(result.self, "[CIRCULAR]");
});

test("Phase 10 QA - 3. Structured Logger: Formats log levels and records error buffer", () => {
  const infoEntry = logger.info("Telemetry ingest completed", {
    context: "INGEST",
    durationMs: 24,
    data: { eventType: "api_call", secretToken: "sensitive-token" },
  });

  assert.equal(infoEntry.level, "INFO");
  assert.equal(infoEntry.message, "Telemetry ingest completed");
  assert.equal(infoEntry.context, "INGEST");
  assert.equal(infoEntry.durationMs, 24);
  assert.equal(infoEntry.data.secretToken, "[REDACTED]");

  // Error log
  const errEntry = logger.error("Database query timed out", new Error("Connection timeout"), {
    context: "DATABASE",
  });
  assert.equal(errEntry.level, "ERROR");
  assert.equal(errEntry.error.message, "Connection timeout");

  const recentErrors = logger.getRecentErrors();
  assert.ok(recentErrors.length > 0);
  assert.equal(recentErrors[0].message, "Database query timed out");
});

test("Phase 10 QA - 4. Performance Latency: Calculates exact percentiles (P50, P90, P99)", () => {
  resetPerformanceMetrics();

  // Record 100 sample latencies: 1ms to 100ms
  for (let i = 1; i <= 100; i++) {
    recordRequestLatency({
      endpoint: "/api/v1/metrics",
      method: "GET",
      durationMs: i,
      statusCode: 200,
    });
  }

  const p = calculatePercentiles("/api/v1/metrics");
  assert.equal(p.count, 100);
  assert.equal(p.min, 1);
  assert.equal(p.max, 100);
  assert.equal(p.p50, 50);
  assert.equal(p.p90, 90);
  assert.equal(p.p99, 99);
});

test("Phase 10 QA - 5. Slow Request Detector: Flags requests exceeding SLA threshold (>500ms)", () => {
  resetPerformanceMetrics();

  // Fast requests
  recordRequestLatency({ endpoint: "/api/health", method: "GET", durationMs: 12, statusCode: 200 });
  recordRequestLatency({ endpoint: "/api/v1/ingest", method: "POST", durationMs: 45, statusCode: 200 });

  // Slow request
  recordRequestLatency({ endpoint: "/api/workspaces/1/export", method: "GET", durationMs: 750, statusCode: 200 });

  const slowAlerts = getSlowRequests();
  assert.equal(slowAlerts.length, 1);
  assert.equal(slowAlerts[0].endpoint, "/api/workspaces/1/export");
  assert.equal(slowAlerts[0].durationMs, 750);
  assert.equal(slowAlerts[0].thresholdMs, 500);
});
