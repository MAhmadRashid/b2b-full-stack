# PulseFlow — Enterprise Telemetry & Modern B2B SaaS Cloud Platform

A production-ready, enterprise-grade B2B SaaS platform built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Prisma ORM**, and a sleek **Cyber-Obsidian design system**.

---

## 🚀 Complete Platform Capabilities

### 1. Multi-Tenant Organizations & Team Workspaces
- **Dual-Tier Hierarchy**: Users belong to Organizations (e.g. Acme Corporation), which host multiple isolated Workspaces (e.g. Production Cluster, Staging).
- **Workspace Switcher**: Instant context toggle from the dashboard header with active tenant persistence.
- **Data Isolation**: Strict server-enforced tenant boundaries on every query. Unauthorized cross-tenant access returns `403 Forbidden`.

### 2. Zero-Trust Authentication, Security & RBAC
- **Session Security**: Cryptographically signed JWT tokens stored in `HttpOnly`, `SameSite=Lax` cookies.
- **Password & Account Safeguards**: `bcryptjs` salted password hashing, password reset with single-use high-entropy tokens, email verification, and profile management with current-password confirmation.
- **4-Tier RBAC**: `OWNER` > `ADMIN` > `MEMBER` > `VIEWER` enforced on all protected endpoints.
- **Privilege Escalation Protection**: Sole-owner demotion guards, admin-restricted role promotions, and anti-SSRF protections against loopback and cloud metadata endpoints (`169.254.169.254`).

### 3. Subscription Management & Stripe Billing
- **5 Configurable Tiers**: `FREE`, `STARTER`, `PRO`, `BUSINESS`, `ENTERPRISE` with configurable pricing, limits, and feature entitlements.
- **Annual Discount Engine**: 20% discount applied consistently to annual billing intervals.
- **Stripe Webhook Processing**: Verifies HMAC-SHA256 signatures with anti-replay timestamp verification.
- **Webhook Idempotency**: Duplicate payment events are acknowledged with `200 OK` and `{ idempotent: true }` without repeating database mutations.
- **Safe Sandbox Mode**: Operates in safe simulated mode during development, staging, and automated testing until live Stripe keys are explicitly provisioned.

### 4. API Keys, Developer Tools & API Gateway
- **Cryptographic Key Generation**: High-entropy keys prefixed with `pfl_live_` or `pfl_test_` for O(1) indexed prefix lookup.
- **Zero Raw Secrets Stored**: Raw secrets revealed strictly once upon creation; only salted bcrypt hashes are persisted.
- **Granular Scope Gating**: `events:write`, `metrics:read`, `workspaces:read`, `audit:read`, `webhooks:write`, and `admin:all`.
- **Token-Bucket Rate Limiting**: Enforces 120 req/min per key with RFC-compliant headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
- **Secret Rotation & Revocation**: Zero-downtime key rotation generates fresh secrets, invalidates previous secrets, and records audit trail.
- **Developer Dashboard**: 4-tab portal featuring Keys Management, Usage Analytics & Quotas, Interactive API Sandbox, and API Documentation (with cURL, JS Fetch, and Python snippets).

### 5. Automated Operations & Backup Infrastructure
- **Automated Database Backups**: `npm run backup` creates timestamped snapshots with SHA-256 checksums and automated rotation.
- **Verified Database Restores**: `npm run restore` with pre-restore safety snapshots and checksum integrity checks.
- **Live Smoke Testing**: `npm run smoke` validates health, security headers, auth gates, webhooks, and API gateways in under 5 seconds.
- **CI/CD Pipeline**: GitHub Actions workflow at `.github/workflows/ci.yml`.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Server Actions, API Routes, React 19) |
| **Language** | TypeScript (Strict mode enabled, 0 compile errors) |
| **Database** | SQLite (Dev/Test) / PostgreSQL (Production) via Prisma ORM 6 |
| **Authentication** | JWT (`jsonwebtoken`) with `HttpOnly` cookies, `bcryptjs` password hashing |
| **Security** | HSTS, CSP, X-Frame-Options, SSRF filters, CSV injection neutralization |
| **Styling** | Cyber-Obsidian Vanilla CSS with Glassmorphism and responsive design tokens |
| **CI/CD & DevOps** | GitHub Actions, Multi-stage Dockerfile, Docker Compose |
| **Testing** | Native Node.js Test Runner (`node --test`), 160+ automated tests |

---

## ⚡ Quick Start & Development

### 1. Installation
```bash
git clone <repo-url>
cd pulseflow
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

### 3. Database Migration & Seed
```bash
npm run prisma:push
npm run prisma:seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Demo Accounts:
- **Owner**: `demo@acmecorp.com` / `Password123!`
- **Superadmin**: `admin@pulseflow.io` / `Password123!`

---

## 🧪 Testing & Operations Commands

```bash
# Run entire test suite (Unit, Integration, and Security)
npm test

# Run TypeScript compiler check
npx tsc --noEmit

# Build production Next.js bundle
npm run build

# Start production server
npm start

# Run live deployment smoke tests
npm run smoke

# Create verified database backup
npm run backup

# Restore database from backup
npm run restore
```

---

## 📚 Production Documentation

- [Production Deployment Guide](docs/DEPLOYMENT.md) — Step-by-step guides for Vercel, Railway, Render, and Docker.
- [Database Operations & Migration Safety](docs/DATABASE_OPERATIONS.md) — Safe schema evolution, backups, and PgBouncer runbooks.
- [Rollback & Incident Recovery Guide](docs/ROLLBACK.md) — Emergency rollback procedures and disaster recovery runbooks.
