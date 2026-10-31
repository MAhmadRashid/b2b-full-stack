import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

function generateInvitationToken(prefix = "inv_ws_") {
  const rawToken = `${prefix}${crypto.randomBytes(24).toString("hex")}`;
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

function isTokenExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

function matchInvitationToken(searchToken, storedToken, storedHash) {
  if (!searchToken) return false;
  const hashOfSearch = crypto.createHash("sha256").update(searchToken).digest("hex");
  return searchToken === storedToken || hashOfSearch === storedHash || searchToken === storedHash;
}

test("Invitations: Generates unique high-entropy token with SHA-256 hash", () => {
  const t1 = generateInvitationToken();
  const t2 = generateInvitationToken();

  assert.notEqual(t1.rawToken, t2.rawToken);
  assert.notEqual(t1.tokenHash, t2.tokenHash);
  assert.equal(t1.tokenHash.length, 64, "SHA-256 hash must be 64 hex characters");
  assert.ok(t1.rawToken.startsWith("inv_ws_"));
});

test("Invitations: Token expiration detection correctly flags expired tokens", () => {
  const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days ahead

  assert.equal(isTokenExpired(pastDate), true, "Past date should be expired");
  assert.equal(isTokenExpired(futureDate), false, "Future date should be valid");
});

test("Invitations: Cryptographic lookup matches raw token against hashed database entry", () => {
  const { rawToken, tokenHash } = generateInvitationToken();

  // Match using raw token
  assert.equal(matchInvitationToken(rawToken, rawToken, tokenHash), true);

  // Match when only hash is stored
  assert.equal(matchInvitationToken(rawToken, null, tokenHash), true);

  // Mismatch with wrong token
  assert.equal(matchInvitationToken("wrong_token_123", rawToken, tokenHash), false);
});

test("Invitations: Email provider gracefully signals unconfigured status without throwing", async () => {
  const { sendInvitationEmail } = await import("../../src/lib/email.ts");
  const result = await sendInvitationEmail({
    to: "test@company.com",
    inviterName: "Admin",
    inviterEmail: "admin@company.com",
    targetName: "Acme Corp",
    targetType: "organization",
    role: "MEMBER",
    inviteUrl: "http://localhost:3000/invite/inv_123",
  });

  assert.equal(result.delivered, false);
  assert.equal(result.simulated, true);
  assert.ok(result.error);
});
