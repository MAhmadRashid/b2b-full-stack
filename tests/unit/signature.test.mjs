import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

function generateWebhookSignature(payload, secretKey) {
  const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
  return crypto.createHmac("sha256", secretKey).update(payloadStr).digest("hex");
}

function verifyWebhookSignature(payload, signature, secretKey) {
  const expected = generateWebhookSignature(payload, secretKey);
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

test("Signature: Webhook signature matches between sender and receiver", () => {
  const secretKey = "whsec_" + crypto.randomBytes(24).toString("hex");
  const payload = {
    event: "test.ping",
    timestamp: "2026-10-24T12:00:00.000Z",
    metrics: { errorRate: "0.02%", p99LatencyMs: 38 },
  };

  const signature = generateWebhookSignature(payload, secretKey);
  assert.equal(typeof signature, "string");
  assert.equal(signature.length, 64); // SHA-256 produces 64-char hex string

  const isValid = verifyWebhookSignature(payload, signature, secretKey);
  assert.equal(isValid, true);
});

test("Signature: Tampered payload or wrong secret fails verification", () => {
  const secretKey = "whsec_valid_secret";
  const wrongSecret = "whsec_wrong_secret";
  const payload = { event: "error_spike", thresholdBreached: true };

  const signature = generateWebhookSignature(payload, secretKey);

  assert.equal(
    verifyWebhookSignature(payload, signature, wrongSecret),
    false
  );

  const tamperedPayload = { event: "error_spike", thresholdBreached: false };
  assert.equal(
    verifyWebhookSignature(tamperedPayload, signature, secretKey),
    false
  );
});
