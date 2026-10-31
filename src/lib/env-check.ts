/**
 * Production Environment Variables & Secrets Validation Utility
 * Validates configuration without leaking sensitive credentials to logs or responses.
 */

export interface EnvValidationResult {
  valid: boolean;
  environment: string;
  missingRequired: string[];
  warnings: string[];
  features: {
    database: { configured: boolean; type: "sqlite" | "postgres" | "mysql" | "unknown" };
    auth: { jwtSecretConfigured: boolean; jwtSecretSufficientLength: boolean };
    billing: { configured: boolean; mode: "live" | "sandbox" };
    email: { configured: boolean; provider: "resend" | "smtp" | "sendgrid" | "none" };
    appUrl: { configured: boolean; url: string; isHttps: boolean };
  };
}

export function validateEnvironment(): EnvValidationResult {
  const nodeEnv = process.env.NODE_ENV || "development";
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  // 1. Database
  const dbUrl = process.env.DATABASE_URL || "";
  let dbType: "sqlite" | "postgres" | "mysql" | "unknown" = "unknown";
  if (dbUrl.startsWith("file:") || dbUrl.includes(".db")) {
    dbType = "sqlite";
  } else if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
    dbType = "postgres";
  } else if (dbUrl.startsWith("mysql://")) {
    dbType = "mysql";
  }

  if (!dbUrl) {
    missingRequired.push("DATABASE_URL");
  } else if (nodeEnv === "production" && dbType === "sqlite") {
    warnings.push("Using SQLite file database in production. For distributed deployments, configure PostgreSQL.");
  }

  // 2. Authentication & JWT
  const jwtSecret = process.env.JWT_SECRET || "";
  const isDefaultSecret = jwtSecret === "pulseflow-default-secret-change-in-prod" || jwtSecret === "replace-with-a-secure-random-secret-key-in-production";

  if (!jwtSecret || isDefaultSecret) {
    if (nodeEnv === "production") {
      missingRequired.push("JWT_SECRET (must not use default placeholder)");
    } else {
      warnings.push("JWT_SECRET is using a development default secret.");
    }
  }

  const jwtLengthSufficient = jwtSecret.length >= 32;
  if (jwtSecret && !jwtLengthSufficient) {
    warnings.push("JWT_SECRET should be at least 32 characters long for cryptographically secure HMAC signing.");
  }

  // 3. Billing & Payments
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const isLiveStripe = stripeKey.startsWith("sk_live_");
  const isTestStripe = stripeKey.startsWith("sk_test_");
  const billingConfigured = isLiveStripe || isTestStripe;

  // 4. Email Delivery
  let emailProvider: "resend" | "smtp" | "sendgrid" | "none" = "none";
  if (process.env.RESEND_API_KEY) {
    emailProvider = "resend";
  } else if (process.env.SMTP_HOST) {
    emailProvider = "smtp";
  } else if (process.env.SENDGRID_API_KEY) {
    emailProvider = "sendgrid";
  }

  // 5. Application URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const isHttps = appUrl.startsWith("https://");

  if (nodeEnv === "production" && !isHttps) {
    warnings.push("NEXT_PUBLIC_APP_URL is not configured with HTTPS for production.");
  }

  return {
    valid: missingRequired.length === 0,
    environment: nodeEnv,
    missingRequired,
    warnings,
    features: {
      database: {
        configured: Boolean(dbUrl),
        type: dbType,
      },
      auth: {
        jwtSecretConfigured: Boolean(jwtSecret) && !isDefaultSecret,
        jwtSecretSufficientLength: jwtLengthSufficient,
      },
      billing: {
        configured: billingConfigured,
        mode: isLiveStripe ? "live" : "sandbox",
      },
      email: {
        configured: emailProvider !== "none",
        provider: emailProvider,
      },
      appUrl: {
        configured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
        url: appUrl,
        isHttps,
      },
    },
  };
}
