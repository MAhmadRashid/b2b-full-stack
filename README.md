# PulseFlow — Enterprise Telemetry & SaaS Cloud Platform

A modern, secure, and production-ready B2B SaaS platform built with **Next.js 15 (App Router)**, **TypeScript**, **SQLite with Prisma ORM**, and a **Cyber-Obsidian Vanilla CSS design system**.

---

## 🚀 Platform Capabilities

### 1. Multi-Tenant Architecture & Workspace Management
- Fully isolated workspaces with slug-based routing and tenant boundary checks.
- Workspace switcher with instant context toggle, tenant creation modal, and customizable display names.
- Complete deletion safeguards in the "Danger Zone" requiring slug confirmation.

### 2. Zero-Trust Authentication & 4-Tier RBAC
- Secure session management using HTTP-only JWT cookies (`jsonwebtoken`, `bcryptjs`).
- 4-Tier Role-Based Access Control enforced on all server routes:
  - **OWNER**: Full cluster authority, billing modifications, member administration, workspace deletion.
  - **ADMIN**: API key generation/revocation, member invitations, outbound webhook configuration.
  - **MEMBER**: Live dashboard inspection, active key viewing, API sandbox execution.
  - **VIEWER**: Read-only telemetry metrics and latency monitoring.
- Strict cross-tenant isolation preventing users from querying or mutating other workspaces' data.

### 3. Developer API Gateway & Safeguards
- High-throughput public gateway: `POST /api/v1/ingest`.
- Cryptographic API keys hashed with `bcryptjs` and masked with prefix identifiers (`pfl_live_...` / `pfl_test_...`).
- Secret keys revealed **strictly once** upon generation.
- **Key Expiration & Auto-Rotation Policies**: Support 30-day, 90-day, 1-year, or static tokens.
- **Expiration Enforcement**: Ingestion gateway rejects expired keys with `401 Expired`.
- **Expiring-Soon Warnings**: Amber warning badges displayed on keys expiring within 7 days.
- **Real-time Quota Protection**: Enforces monthly request limits with `429 Rate Limit Exceeded`.
- **Interactive Ingestion Sandbox**: Test live telemetry ingestion directly within the dashboard.

### 4. Outbound Webhook Delivery Engine
- Configurable external webhook destinations for PagerDuty, Slack, Datadog, or custom servers.
- Event subscription triggers: `error_spike`, `latency_breach`, `quota_warning`, `security_alert`.
- **Cryptographic Signing**: Every payload is signed with HMAC-SHA256 (`crypto.createHmac`) using a unique destination secret (`whsec_...`) and transmitted in the `X-PulseFlow-Signature` header.
- **Live Test Delivery Ping**: Built-in ping tool with real-time latency measurement, HTTP status capture, signature verification, and response preview.
- Secret reveal/hide toggle, one-click copy, and pause/active toggles.

### 5. Telemetry Observability & Raw Data Exporter
- Granular distribution charts, latency percentiles ($p_{50}$, $p_{95}$, $p_{99}$), and live request streams.
- **Raw Telemetry Exporter (CSV/JSON)**: One-click export supporting `format=csv` (with RFC-compliant escaping) and `format=json` with streaming download headers.
- Search filter by event type, source, and HTTP status code.

### 6. Team Onboarding & Invitation Acceptance Flow
- Issue invitations with cryptographic tokens (`inv_...`) and 7-day expiration validity.
- Public onboarding page at `/invite/[token]` with token verification, account password setup, and direct redirect into the workspace dashboard.
- Automatic cleanup of invitation tokens upon successful acceptance.
- Real-time pending invitations table with link copying and revocation controls.

### 7. Subscription Billing, Audit Logs & Fleet Governance
- Automated usage tracking against tiered request quotas.
- Plan comparison: **Developer Starter** ($0), **Growth Pro** ($99/mo), and **Scale Enterprise** ($399/mo).
- Prorated plan tier upgrade/downgrade workflow.
- **Immutable Security Audit Trail**: Cryptographically timestamped records of every administrative action, user email, and IP address.
- Live `/api/health` monitoring database latency, uptime, and cluster health.
- Dedicated Superadmin Control Panel for fleet-wide tenant metrics.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Server & Client Components, React 19) |
| **Language** | TypeScript (Strict mode enabled, 0 compile errors) |
| **Styling** | Vanilla CSS Design System with Cyber-Obsidian aesthetic & Glassmorphism |
| **Database** | SQLite via Prisma ORM 6 (Easily portable to PostgreSQL) |
| **Authentication** | JWT (`jsonwebtoken`) with `HttpOnly`, `SameSite=Lax` cookies |
| **Security** | `bcryptjs` password & API key hashing, HMAC-SHA256 signing, zero-trust RBAC |
| **Icons** | Lucide React |
| **Testing** | Node.js Test Runner (`node --test`) with `node:assert/strict` |

---

## 📋 Seed & Demo Accounts

The database comes pre-seeded with realistic data, multiple workspaces, members, API keys, and metrics.

| Role | Email | Password | Assigned Workspace |
|---|---|---|---|
| **Workspace Owner** | `demo@acmecorp.com` | `Password123!` | Acme Corp Cloud (PRO) |
| **Superadmin** | `admin@pulseflow.io` | `Password123!` | Global Fleet Access |
| **Workspace Admin** | `dev@acmecorp.com` | `Password123!` | Acme Corp Cloud |
| **Workspace Viewer** | `auditor@acmecorp.com` | `Password123!` | Acme Corp Cloud |

---

## ⚡ Quick Start & Setup

### 1. Prerequisites
- Node.js 18+ or 20+
- npm 9+

### 2. Installation
```bash
git clone <repo-url>
cd pulseflow
npm install
```

### 3. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```
Ensure `.env` contains:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-ultra-secure-random-jwt-secret-min-32-chars"
NEXT_PUBLIC_APP_NAME="PulseFlow"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### 4. Database Setup & Seeding
```bash
# Push schema to SQLite
npm run prisma:push

# Seed demo accounts, metrics, keys, and invoices
npm run prisma:seed
```

### 5. Running the Application
```bash
# Development Server
npm run dev

# Production Build & Start
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing Suite

The repository includes a comprehensive automated test suite covering unit logic, security boundaries, and full API integration flows:

```bash
# Run all unit and integration tests
npm test
```

### Test Coverage Highlights:
- **Unit Tests**:
  - `tests/unit/rbac.test.mjs`: Tests role hierarchy (`hasMinimumRole`), invalid role rejection.
  - `tests/unit/auth.test.mjs`: Tests password hashing, JWT signing, token expiry, and tampering detection.
  - `tests/unit/signature.test.mjs`: Tests webhook HMAC-SHA256 signature generation and timing-safe verification.
- **Integration Tests** (`tests/integration/api.test.mjs`):
  - System health check `/api/health`.
  - Registration input validation and credential checking.
  - Authentication and HTTP-Only session lifecycle.
  - API key generation with 30-day expiration policy.
  - Telemetry ingestion gateway with valid, invalid, and expired keys.
  - Telemetry export in CSV and JSON streaming formats.
  - Outbound webhook creation, HMAC signature test ping, active toggle, and deletion.
  - Team invitation token generation, validation, and `/invite/[token]` onboarding acceptance.
  - Superadmin access control isolation (`/api/admin/overview`).

---

## 📡 API Reference Summary

### Telemetry Ingestion
- `POST /api/v1/ingest` — Ingest metric events (`Authorization: Bearer pfl_...` or `x-api-key`). Rejects expired keys with 401.

### Authentication & Profiles
- `POST /api/auth/register` — Create account and default workspace.
- `POST /api/auth/login` — Sign in and issue `pulseflow_session` cookie.
- `POST /api/auth/logout` — Invalidate session cookie.
- `GET /api/auth/me` — Return session user and active workspaces.

### Workspaces & Governance
- `GET /api/workspaces` — List workspaces.
- `POST /api/workspaces` — Create new workspace.
- `PATCH /api/workspaces/:id` — Update workspace display name.
- `DELETE /api/workspaces/:id` — Delete workspace.
- `GET /api/workspaces/:id/members` — List members and pending invitations.
- `POST /api/workspaces/:id/members` — Create invitation token link.
- `DELETE /api/workspaces/:id/members?invitationId=...` — Revoke pending invitation.
- `GET /api/invitations/:token` — Verify invitation token.
- `POST /api/invitations/:token` — Accept invitation and activate membership.

### Keys & Outbound Webhooks
- `GET /api/workspaces/:id/keys` — List API keys with expiration and status.
- `POST /api/workspaces/:id/keys` — Generate key with optional expiration (`30d`, `90d`, `1y`).
- `DELETE /api/workspaces/:id/keys?keyId=...` — Revoke key.
- `GET /api/workspaces/:id/webhooks` — List outbound webhook destinations.
- `POST /api/workspaces/:id/webhooks` — Create webhook destination.
- `POST /api/workspaces/:id/webhooks/test` — Trigger test delivery with HMAC-SHA256 signature.
- `PATCH /api/workspaces/:id/webhooks` — Toggle active status.
- `DELETE /api/workspaces/:id/webhooks?webhookId=...` — Delete webhook destination.

### Metrics & Export
- `GET /api/workspaces/:id/metrics?range=24h|7d|30d` — Query analytics overview and recent stream.
- `GET /api/workspaces/:id/metrics/export?format=csv|json` — Download raw event telemetry.

---

## 🚀 Production Deployment Guide

### Option 1: Vercel / Cloudflare
1. Connect Git repository to Vercel.
2. In Project Settings > Environment Variables, configure:
   - `DATABASE_URL`: Hosted PostgreSQL connection string (e.g. Supabase, Neon, AWS RDS).
   - `JWT_SECRET`: Random 64+ char hex string.
   - `NEXT_PUBLIC_APP_URL`: Production domain (e.g. `https://pulseflow.io`).
3. Set Build Command: `npx prisma generate && next build`.

### Option 2: Docker Container / Self-Hosted Node.js
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "start"]
```

---

## ⚠️ Known Limitations & Troubleshooting

1. **Windows PowerShell Execution Policy**:
   - If running `npx` commands on Windows encounters `npx.ps1 cannot be loaded because running scripts is disabled`, prefix commands with `cmd /c npx ...` or run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.
2. **SQLite File Locking in Local Multi-Process**:
   - SQLite `dev.db` locks the database file if another process has an exclusive write lock. In high-concurrency production deployments, switch `provider = "postgresql"` in `prisma/schema.prisma` with a connection pooler like PgBouncer.
3. **Database Migration to PostgreSQL**:
   - To migrate to PostgreSQL for multi-region clustering: change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma` and run `npx prisma migrate dev --name init_postgres`.
