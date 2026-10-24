import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = "test-jwt-secret-key-32-chars-long!";

function signToken(payload, expiresIn = "1h") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

test("Auth: Password hashing with bcrypt produces verifiable hash", async () => {
  const password = "SuperSecretPassword123!";
  const hash = await bcrypt.hash(password, 10);

  assert.notEqual(hash, password);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare("WrongPassword!", hash), false);
});

test("Auth: JWT signing and verification with valid secret succeeds", () => {
  const payload = { userId: "user_abc123", email: "test@domain.com", systemRole: "USER" };
  const token = signToken(payload);

  const decoded = verifyToken(token);
  assert.ok(decoded);
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.systemRole, payload.systemRole);
});

test("Auth: JWT rejects tampered or expired token", () => {
  const payload = { userId: "user_abc123", email: "test@domain.com", systemRole: "USER" };
  const token = signToken(payload, "0s"); // Expired immediately

  const decoded = verifyToken(token);
  assert.equal(decoded, null);

  const tamperedToken = signToken(payload) + "tampered";
  assert.equal(verifyToken(tamperedToken), null);
});
