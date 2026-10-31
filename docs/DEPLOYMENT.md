# PulseFlow SaaS - Production Deployment Guide

This guide details the procedures for deploying PulseFlow Enterprise Telemetry to production environments.

---

## 1. Hosting Architecture Options

### Option A: Serverless Cloud (Vercel + Neon / Supabase PostgreSQL) - **Recommended**
- **Frontend & API Routes**: Vercel Edge & Serverless Functions (Next.js App Router native).
- **Database**: Serverless PostgreSQL with connection pooling via Neon or Supabase.
- **TLS/HTTPS**: Automatic managed SSL certificates via Let's Encrypt with Cloudflare DNS proxy.
- **Storage & Assets**: Next.js optimized assets via Vercel Global Edge Network.

### Option B: Containerized Cloud (Railway / Render / AWS ECS)
- **Container**: Multi-stage Linux container using the root [`Dockerfile`](../Dockerfile).
- **Database**: Managed PostgreSQL instance (AWS RDS, Railway Postgres, or Render Postgres).
- **Environment**: Containerized runtime with persistent connection limits.

### Option C: Self-Hosted VPS / On-Premise (Docker Compose + Reverse Proxy)
- **Runtime**: [`docker-compose.yml`](../docker-compose.yml) running the Next.js app and PostgreSQL container.
- **Reverse Proxy**: Caddy or Nginx with automated Let's Encrypt SSL certificates.

---

## 2. Pre-Deployment Readiness Checklist

Before triggering a production deployment, ensure:
- [x] Full automated test suite passes: `npm test` (153+ tests passing, zero failures).
- [x] TypeScript compiler strict check passes: `npx tsc --noEmit` (0 errors).
- [x] Production build passes: `npm run build` (all 38 routes statically/dynamically generated).
- [x] Smoke test passes against live server: `npm run smoke` (10/10 checks passing).
- [x] Database backup created: `npm run backup`.
- [x] Required production secrets provisioned in hosting provider's secure secret store.

---

## 3. Step-by-Step Deployment Instructions

### Method 1: Deploying to Vercel (Recommended)

1. **Import Git Repository**:
   - Navigate to [vercel.com/new](https://vercel.com/new).
   - Select the `pulse-saas-platform` repository.
   - Framework Preset: **Next.js**.
   - Build Command: `npm run build`.
   - Output Directory: `.next`.

2. **Configure Environment Variables in Vercel Settings**:
   Under **Project Settings -> Environment Variables**, configure:
   ```env
   NODE_ENV=production
   NEXT_PUBLIC_APP_NAME="PulseFlow Telemetry"
   NEXT_PUBLIC_APP_URL="https://app.pulseflow.io"
   DATABASE_URL="postgresql://user:pass@pooler.neon.tech/pulseflow?sslmode=require&pgbouncer=true"
   DIRECT_URL="postgresql://user:pass@direct.neon.tech/pulseflow?sslmode=require"
   JWT_SECRET="<generate 64-char hex via openssl rand -hex 64>"
   STRIPE_SECRET_KEY="sk_live_..."
   STRIPE_PUBLISHABLE_KEY="pk_live_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   RESEND_API_KEY="re_..."
   ```

3. **Deploy & Apply Migrations**:
   - In your CI/CD or deployment build command, add: `npx prisma db push --accept-data-loss=false && next build`.
   - Click **Deploy**.

4. **Custom Domain & HTTPS**:
   - Go to **Project Settings -> Domains**.
   - Add `app.pulseflow.io`.
   - Configure DNS CNAME: `cname.vercel-dns.com`.
   - Vercel automatically generates and provisions managed Let's Encrypt TLS certificates.

---

### Method 2: Deploying via Docker Compose

1. **Clone repository onto VPS**:
   ```bash
   git clone <repo-url> /opt/pulseflow
   cd /opt/pulseflow
   ```

2. **Create production `.env` file**:
   ```bash
   cp .env.example .env
   # Edit .env with your production database credentials, secrets, and domain
   nano .env
   ```

3. **Build and start containers**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify container health**:
   ```bash
   docker compose ps
   curl -I http://localhost:3000/api/health
   ```

5. **Run live smoke test**:
   ```bash
   npm run smoke
   ```

---

## 4. Post-Deployment Verification

Immediately after release, run:
1. `npm run smoke` targeting your live domain:
   ```bash
   TARGET_URL=https://app.pulseflow.io npm run smoke
   ```
2. Verify `/api/health` reports status `HEALTHY` and database `CONNECTED`.
3. Test signup with a verification email flow.
4. Verify Stripe webhook endpoint handles test transactions correctly in the Stripe Dashboard.
