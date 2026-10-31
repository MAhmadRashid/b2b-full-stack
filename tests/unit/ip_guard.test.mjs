// tests/unit/ip_guard.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { isIpInCidrV4, extractClientIp, validateIpRestriction } from "../../src/lib/ip-guard.ts";

test("IP Guard: isIpInCidrV4 correctly matches single IPs", () => {
  assert.equal(isIpInCidrV4("192.168.1.50", "192.168.1.50"), true);
  assert.equal(isIpInCidrV4("192.168.1.51", "192.168.1.50"), false);
});

test("IP Guard: isIpInCidrV4 correctly matches /24 subnet blocks", () => {
  const cidr = "192.168.1.0/24";
  assert.equal(isIpInCidrV4("192.168.1.1", cidr), true);
  assert.equal(isIpInCidrV4("192.168.1.254", cidr), true);
  assert.equal(isIpInCidrV4("192.168.2.1", cidr), false);
  assert.equal(isIpInCidrV4("10.0.0.1", cidr), false);
});

test("IP Guard: isIpInCidrV4 correctly matches /16 and /8 subnet blocks", () => {
  assert.equal(isIpInCidrV4("10.50.23.4", "10.0.0.0/8"), true);
  assert.equal(isIpInCidrV4("11.0.0.1", "10.0.0.0/8"), false);
  assert.equal(isIpInCidrV4("172.16.4.99", "172.16.0.0/16"), true);
  assert.equal(isIpInCidrV4("172.17.4.99", "172.16.0.0/16"), false);
});

test("IP Guard: extractClientIp extracts prioritized client IP from headers", () => {
  // CF-Connecting-IP takes highest priority
  assert.equal(
    extractClientIp("192.168.1.1", "10.0.0.1", "203.0.113.195"),
    "203.0.113.195"
  );

  // X-Real-IP takes secondary priority
  assert.equal(
    extractClientIp("192.168.1.1", "10.0.0.5", null),
    "10.0.0.5"
  );

  // X-Forwarded-For extracts leftmost client IP
  assert.equal(
    extractClientIp("198.51.100.42, 10.0.0.1", null, null),
    "198.51.100.42"
  );

  // IPv4-mapped IPv6 cleanup
  assert.equal(
    extractClientIp("::ffff:192.168.1.100", null, null),
    "192.168.1.100"
  );
});

test("IP Guard: validateIpRestriction allows all when no restrictions configured", () => {
  assert.equal(validateIpRestriction("203.0.113.1", null).allowed, true);
  assert.equal(validateIpRestriction("203.0.113.1", "").allowed, true);
  assert.equal(validateIpRestriction("203.0.113.1", "   ").allowed, true);
});

test("IP Guard: validateIpRestriction blocks unauthorized IPs and allows authorized CIDRs", () => {
  const allowedRules = "10.0.0.0/24, 192.168.1.50, 203.0.113.0/28";

  // Authorized
  assert.equal(validateIpRestriction("10.0.0.15", allowedRules).allowed, true);
  assert.equal(validateIpRestriction("192.168.1.50", allowedRules).allowed, true);
  assert.equal(validateIpRestriction("203.0.113.10", allowedRules).allowed, true);

  // Unauthorized
  const blocked = validateIpRestriction("198.51.100.1", allowedRules);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reason?.includes("198.51.100.1"));
});
