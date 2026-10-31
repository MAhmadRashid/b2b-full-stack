// src/lib/ip-guard.ts
import net from "net";

/**
 * Checks whether an IPv4 address falls within a given CIDR block (e.g., 192.168.1.0/24).
 */
export function isIpInCidrV4(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return ip.trim() === cidr.trim();
  }

  const [range, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = ipV4ToNumber(ip);
  const rangeNum = ipV4ToNumber(range);
  if (ipNum === null || rangeNum === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Converts an IPv4 dotted decimal string to a 32-bit unsigned number.
 */
function ipV4ToNumber(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;

  let num = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(parts[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) + octet;
  }
  return num >>> 0;
}

/**
 * Normalizes an incoming client IP from request headers or socket.
 * Handles IPv4-mapped IPv6 (::ffff:192.168.1.1), comma-separated x-forwarded-for, and localhost.
 */
export function extractClientIp(
  forwardedForHeader?: string | null,
  realIpHeader?: string | null,
  cfConnectingIp?: string | null,
  remoteAddress?: string | null
): string {
  // 1. Cloudflare header
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cleanIp(cfConnectingIp.split(",")[0].trim());
  }

  // 2. X-Real-IP
  if (realIpHeader && realIpHeader.trim()) {
    return cleanIp(realIpHeader.split(",")[0].trim());
  }

  // 3. X-Forwarded-For (leftmost is original client)
  if (forwardedForHeader && forwardedForHeader.trim()) {
    const list = forwardedForHeader.split(",");
    if (list.length > 0 && list[0].trim()) {
      return cleanIp(list[0].trim());
    }
  }

  // 4. Remote socket address fallback
  if (remoteAddress && remoteAddress.trim()) {
    return cleanIp(remoteAddress.trim());
  }

  return "127.0.0.1";
}

function cleanIp(raw: string): string {
  let ip = raw.trim();
  // Strip IPv4-mapped IPv6 prefix
  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }
  // Strip port if present in IPv4 (e.g., "192.168.1.1:443")
  if (ip.includes(":") && !ip.includes("::") && ip.split(":").length === 2) {
    ip = ip.split(":")[0];
  }
  return ip;
}

/**
 * Validates an incoming client IP against a comma/newline-separated list of allowed IPs or CIDR ranges.
 * If restrictions string is empty or undefined, access is open to all IPs (returns true).
 */
export function validateIpRestriction(
  clientIp: string,
  ipRestrictions?: string | null
): { allowed: boolean; reason?: string } {
  if (!ipRestrictions || !ipRestrictions.trim()) {
    return { allowed: true };
  }

  const normalizedClientIp = cleanIp(clientIp);
  const rules = ipRestrictions
    .split(/[\n,]+/)
    .map((r) => r.trim())
    .filter(Boolean);

  if (rules.length === 0) {
    return { allowed: true };
  }

  // Always allow loopback for local tests and development if client IP is localhost
  const isClientLocalhost =
    normalizedClientIp === "127.0.0.1" ||
    normalizedClientIp === "::1" ||
    normalizedClientIp === "localhost";

  for (const rule of rules) {
    // Exact match (including localhost aliases)
    if (rule === normalizedClientIp) {
      return { allowed: true };
    }

    if (
      isClientLocalhost &&
      (rule === "127.0.0.1" || rule === "::1" || rule === "localhost")
    ) {
      return { allowed: true };
    }

    // IPv4 CIDR matching
    if (rule.includes("/") && net.isIPv4(normalizedClientIp)) {
      if (isIpInCidrV4(normalizedClientIp, rule)) {
        return { allowed: true };
      }
    }
  }

  return {
    allowed: false,
    reason: `Client IP ${normalizedClientIp} is not authorized for this API key. Allowed CIDRs/IPs: ${rules.join(", ")}`,
  };
}
