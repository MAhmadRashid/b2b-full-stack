/**
 * Structured Production Application Logger for PulseFlow
 * Features RFC-compliant JSON log structures, latency measurement,
 * context tagging, and zero-trust PII/credential scrubbing.
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  durationMs?: number;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const SENSITIVE_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "confirmpassword",
  "secret",
  "rawkey",
  "apikey",
  "hashedkey",
  "token",
  "authorization",
  "pulseflow_session",
  "cookie",
  "set-cookie",
  "cvc",
  "cvv",
  "cardnumber",
  "card_number",
  "privatekey",
  "client_secret",
]);

/**
 * Deeply scrubs sensitive keys from metadata objects.
 */
export function scrubSensitiveData(obj: any, depth = 0, seen = new WeakSet()): any {
  if (depth > 6) return "[MAX_DEPTH]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (seen.has(obj)) return "[CIRCULAR]";
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubSensitiveData(item, depth + 1, seen));
  }

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, "");
    const isSensitive =
      SENSITIVE_KEYS.has(lowerKey) ||
      ["password", "secret", "token", "apikey", "auth", "cookie", "cvv", "card"].some((term) =>
        lowerKey.includes(term)
      );

    if (isSensitive) {
      clean[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      clean[k] = scrubSensitiveData(v, depth + 1, seen);
    } else {
      clean[k] = v;
    }
  }

  return clean;
}

// In-memory ring buffer for recent error logs (bounded to last 50 entries)
const RECENT_ERROR_LOGS: LogEntry[] = [];
const MAX_RECENT_ERRORS = 50;

class StructuredLogger {
  private formatLog(level: LogLevel, message: string, data?: Record<string, any>, error?: Error, durationMs?: number, context?: string): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(typeof durationMs === "number" && { durationMs }),
      ...(data && { data: scrubSensitiveData(data) }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
        },
      }),
    };

    if (level === "ERROR") {
      RECENT_ERROR_LOGS.unshift(entry);
      if (RECENT_ERROR_LOGS.length > MAX_RECENT_ERRORS) {
        RECENT_ERROR_LOGS.pop();
      }
    }

    return entry;
  }

  private write(entry: LogEntry) {
    const jsonString = JSON.stringify(entry);
    if (entry.level === "ERROR") {
      console.error(jsonString);
    } else if (entry.level === "WARN") {
      console.warn(jsonString);
    } else {
      console.log(jsonString);
    }
  }

  info(message: string, meta?: { context?: string; durationMs?: number; data?: Record<string, any> }) {
    const entry = this.formatLog("INFO", message, meta?.data, undefined, meta?.durationMs, meta?.context);
    this.write(entry);
    return entry;
  }

  warn(message: string, meta?: { context?: string; durationMs?: number; data?: Record<string, any> }) {
    const entry = this.formatLog("WARN", message, meta?.data, undefined, meta?.durationMs, meta?.context);
    this.write(entry);
    return entry;
  }

  error(message: string, error?: Error | unknown, meta?: { context?: string; durationMs?: number; data?: Record<string, any> }) {
    const errObj = error instanceof Error ? error : (error ? new Error(String(error)) : undefined);
    const entry = this.formatLog("ERROR", message, meta?.data, errObj, meta?.durationMs, meta?.context);
    this.write(entry);
    return entry;
  }

  debug(message: string, meta?: { context?: string; durationMs?: number; data?: Record<string, any> }) {
    if (process.env.NODE_ENV === "production" && process.env.LOG_LEVEL !== "debug") return;
    const entry = this.formatLog("DEBUG", message, meta?.data, undefined, meta?.durationMs, meta?.context);
    this.write(entry);
    return entry;
  }

  getRecentErrors(): LogEntry[] {
    return [...RECENT_ERROR_LOGS];
  }
}

export const logger = new StructuredLogger();
