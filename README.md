# PulseFlow — Enterprise Telemetry & SaaS Cloud Platform

A modern, secure, and production-ready B2B SaaS application built with **Next.js 15 (App Router)**, **TypeScript**, **SQLite with Prisma ORM**, and a **Vanilla CSS design system**.

---

## 🚀 Key Features

### 1. Multi-Tenant Architecture
- Isolated workspaces with slug-based routing and tenant boundary checks.
- Workspace switcher with instant context toggle and workspace creation modal.

### 2. Zero-Trust Authentication & RBAC
- Secure session management using HTTP-only JWT cookies (`jsonwebtoken`, `bcryptjs`).
- 4-Tier Role-Based Access Control:
  - **OWNER**: Full cluster authority, billing modifications, member administration, workspace deletion.
  - **ADMIN**: API key generation/revocation, member invitations, telemetry configuration.
  - **MEMBER**: Live dashboard inspection, active key viewing, API sandbox execution.
  - **VIEWER**: Read-only telemetry metrics and latency monitoring.
- Server-side RBAC validation on every single API endpoint.

### 3. High-Throughput Developer API Gateway
- Public authenticated endpoint: `POST /api/v1/ingest`.
- Cryptographic API keys hashed with bcrypt and masked with prefix identifiers (`pfl_live_...` / `pfl_test_...`).
- Secret keys revealed **strictly once** upon generation.
- Real-time monthly quota enforcement with `429 Rate Limit Exceeded` protection.
- Built-in **Interactive API Sandbox** in the dashboard to test live ingestion directly in the browser.

### 4. Real-Time Observability & Analytics
- Live telemetry stream feed with latency indicators and HTTP status badges (200, 201, 400, 429, 500).
- Visual throughput and error distribution graphs.
- Latency percentiles calculation ($p_{50}$, $p_{95}$, $p_{99}$).
- Interactive JSON payload inspector modal.

### 5. Subscription & Quota Management
- Automated usage tracking against plan request limits.
- Tier comparison: **Developer Starter** ($0), **Growth Pro** ($99/mo), and **Scale Enterprise** ($399/mo).
- Prorated tier upgrade/downgrade workflow with instant database synchronization.
- Itemized billing and invoice receipt download history.

### 6. Security Audit Trail & Health Telemetry
- Immutable audit logs capturing every administrative operation with user attribution and IP address.
- Live `/api/health` endpoint monitoring database latency, uptime, and cluster status.
- Dedicated Superadmin Ops panel for fleet-wide multi-tenant management.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router with Server & Client Components) |
| **Language** | TypeScript (Strict mode enabled, 0 lint/compile errors) |
| **Styling** | Vanilla CSS Design System with Cyber-Obsidian aesthetic & Glassmorphism |
| **Database** | SQLite via Prisma ORM 6 |
| **Authentication** | JWT (`jsonwebtoken`) with `HttpOnly`, `SameSite=Lax` cookies |
| **Security** | `bcryptjs` password & API key hashing, zero-trust RBAC |
| **Icons** | Lucide React |

---

## 📋 Seed & Demo Accounts

The database comes pre-seeded with realistic data, multiple workspaces, members, API keys, and metrics.

| Role | Email | Password | Assigned Workspace |
|---|---|---|---|
| **Workspace Owner** | `demo@acmecorp.com` | `Password123!` | Acme Corp Cloud (PRO) |
| **Superadmin** | `admin@pulseflow.io` | `Password123!` | Global Fleet Access |
| **Workspace Admin** | `dev@acmecorp.com` | `Password123!` | Acme Corp Cloud |
| **Workspace Viewer** | `auditor@acmecorp.com` | `Password123!` | Acme Corp Cloud |

> **Tip:** You can also use the **One-Click Demo Profiles** on the login page to sign in instantly without typing!

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- Node.js 18+ or 20+
- npm 9+

### 2. Installation
```bash
# Clone the repository and navigate into the workspace
git clone <repo-url>
cd pulseflow

# Install project dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-ultra-secure-random-jwt-secret"
NEXT_PUBLIC_APP_NAME="PulseFlow"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Database Setup & Seeding
```bash
# Generate Prisma Client
npx prisma generate

# Push schema to SQLite database
npx prisma db push

# Seed the database with sample workspaces, members, API keys, and metrics
npm run prisma:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Production Build
```bash
npm run build
npm start
```

---

## 📡 API Reference

### Public Telemetry Ingestion
- **`POST /api/v1/ingest`**
  - **Headers**: `Authorization: Bearer <pfl_live_...>` or `x-api-key: <pfl_live_...>`
  - **Body**:
    ```json
    {
      "eventType": "api_request",
      "source": "backend-auth-cluster",
      "payload": {
        "userId": "usr_9918",
        "action": "token_refresh"
      }
    }
    ```
  - **Response (201 Created)**:
    ```json
    {
      "success": true,
      "eventId": "cmvl0kjnv0001u0y0s2wtnum2",
      "workspaceId": "cmvkztu6o0004u01w7sokju3s",
      "eventType": "api_request",
      "recordedAt": "2026-10-23T13:36:50.823Z",
      "latencyMs": 24,
      "usage": {
        "requestsThisMonth": 168421,
        "monthlyLimit": 250000,
        "remaining": 81579
      }
    }
    ```

### Authentication
- `POST /api/auth/register` — Create new user, provision default workspace, set session cookie.
- `POST /api/auth/login` — Validate credentials, sign JWT, set HTTP-only cookie.
- `POST /api/auth/logout` — Terminate session and invalidate cookie.
- `GET /api/auth/me` — Retrieve active session profile, roles, and workspaces.

### Workspaces & Teams
- `GET /api/workspaces` — List all workspaces user is a member of.
- `POST /api/workspaces` — Create new workspace with owner role.
- `GET /api/workspaces/:id` — Get workspace metadata and stats.
- `PATCH /api/workspaces/:id` — Update workspace settings (Admin/Owner only).
- `DELETE /api/workspaces/:id` — Permanently delete workspace (Owner only).
- `GET /api/workspaces/:id/members` — List members with RBAC roles.
- `POST /api/workspaces/:id/members` — Invite new teammate with assigned role.
- `PATCH /api/workspaces/:id/members/:memberId` — Update member role.
- `DELETE /api/workspaces/:id/members/:memberId` — Remove member.

### API Keys
- `GET /api/workspaces/:id/keys` — List workspace API keys with masked prefixes.
- `POST /api/workspaces/:id/keys` — Generate cryptographically hashed key and reveal secret once.
- `DELETE /api/workspaces/:id/keys?keyId=...` — Revoke active key.

### Metrics & Analytics
- `GET /api/workspaces/:id/metrics?range=24h|7d|30d` — Aggregated time-series, latency percentiles, error distribution, and live stream.

### Billing & Audits
- `GET /api/workspaces/:id/billing` — Current plan, limits, and invoice history.
- `POST /api/workspaces/:id/billing` — Change subscription plan.
- `GET /api/workspaces/:id/audit-logs` — Query paginated workspace audit history.

### System & Health
- `GET /api/health` — Database connectivity, latency, and uptime health check.
- `GET /api/admin/overview` — Superadmin cross-tenant telemetry.

---

## 🔒 Security Best Practices Implemented
1. **Server-Side Enforcement**: Permissions, rate limits, and ownership checks are always evaluated on the server, never trusted from client payloads.
2. **Password & Token Security**: Passwords and secret API keys are hashed with `bcryptjs` using adaptive salting.
3. **Session Hardening**: Sessions use strict `HttpOnly` cookies to protect against Cross-Site Scripting (XSS).
4. **Audit Immutability**: All security-critical events (logins, key generation, role elevations, deletions) are logged with IP addresses.
