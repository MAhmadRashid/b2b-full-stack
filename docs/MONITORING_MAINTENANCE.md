# PulseFlow SaaS - Production Monitoring, Backups & Maintenance Runbook

This document defines the Site Reliability Engineering (SRE), monitoring, backup schedules, recovery objectives, and maintenance policies for PulseFlow.

---

## 1. Monitoring & Observability Architecture

### Live Health & Diagnostics Endpoints
1. **Public/Platform Health**: `GET /api/health`
   - Verifies database connectivity, round-trip query latency, and overall cluster health.
   - Used by uptime monitors (UptimeRobot, BetterUptime, Datadog Synthetic Monitoring).
2. **SRE Administrative Telemetry**: `GET /api/admin/monitoring`
   - Restricted to `SUPERADMIN` accounts (`admin@pulseflow.io`).
   - Reports Node.js memory allocations (RSS, heapUsed, heapTotal, external).
   - Reports live database latency and entity inventory counts (Users, Orgs, Workspaces, Keys, Logs).
   - Computes statistical percentiles ($P_{50}$, $P_{90}$, $P_{99}$) across recent traffic.
   - Surfaces recent slow requests exceeding the 500ms SLA threshold.

---

## 2. SLA & Alerting Thresholds

Configure your alerting provider (PagerDuty, Slack Webhooks, or AWS CloudWatch) to trigger on the following conditions:

| Metric | Warning Threshold | Critical Incident Threshold | Recommended Automated Action |
| :--- | :--- | :--- | :--- |
| **API Error Rate (5xx)** | `> 0.5%` over 5 min | `> 1.0%` over 5 min | Alert on-call SRE; auto-inspect error buffer |
| **Database Latency** | `> 30 ms` | `> 50 ms` | Check connection pool limits and unindexed queries |
| **P99 API Latency** | `> 800 ms` | `> 1500 ms` | Inspect slow requests via `/api/admin/monitoring` |
| **Node.js Heap Memory** | `> 400 MB` | `> 750 MB` | Potential memory leak; recycle worker container |
| **Backup Job Failure** | Any failed job | 2 consecutive failures | Escalate immediately; run manual backup |

---

## 3. Disaster Recovery & Objectives (RTO / RPO)

PulseFlow establishes the following disaster recovery service level objectives:

- **Recovery Time Objective (RTO)**: **< 15 minutes**
  - *Actual Drill Benchmark*: **4 ms** (measured during non-destructive restore drill).
- **Recovery Point Objective (RPO)**: **< 1 hour** (maximum permissible data loss window).
  - *Snapshot Frequency*: Daily automated snapshots with transaction logging.

### Automated Non-Destructive Restore Rehearsals
```bash
# Execute isolated non-destructive restore rehearsal:
npm run drill
```
- Rehearses snapshot extraction into an isolated temporary database.
- Validates SHA-256 integrity, table counts, foreign keys, and relations.
- Tears down drill artifacts without touching production data or taking services offline.

---

## 4. Maintenance Automation & Scheduled Tasks

PulseFlow provides automated housekeeping routines:

```bash
# Execute automated maintenance sweep:
npm run maintenance
```
- **Expired Password Reset Tokens**: Purged automatically upon expiration.
- **Expired Email Verification Tokens**: Purged automatically upon expiration.
- **Stale Invitations**: Unaccepted invitations older than 14 days are cleaned up.
- **Audit History**: Logged in `AuditLog` under `SYSTEM_MAINTENANCE_COMPLETED`.

### Recommended Cron / Worker Schedule
In Linux / Kubernetes cron environments:
```cron
# Run daily database backup at 02:00 UTC
0 2 * * * cd /opt/pulseflow && npm run backup >> /var/log/pulseflow/backup.log 2>&1

# Run daily housekeeping & token cleanup at 03:00 UTC
0 3 * * * cd /opt/pulseflow && npm run maintenance >> /var/log/pulseflow/maintenance.log 2>&1

# Run weekly non-destructive restore drill every Sunday at 04:00 UTC
0 4 * * 0 cd /opt/pulseflow && npm run drill >> /var/log/pulseflow/drill.log 2>&1
```

---

## 5. Security Maintenance & Secret Rotation

1. **JWT Secret Rotation**:
   - Generate a new 64-char secret: `openssl rand -hex 64`.
   - Update `JWT_SECRET` in hosting provider environment settings.
   - Existing sessions will expire gracefully, requiring users to log in again.
2. **API Key Rotation**:
   - Workspace admins rotate keys zero-downtime via `/dashboard/api-keys` or `POST /api/workspaces/:id/keys/:keyId/rotate`.
   - The old secret is immediately revoked; the new secret is issued once.
3. **Stripe Webhook Secret Rotation**:
   - Add new signing secret in Stripe Dashboard -> Webhooks.
   - Update `STRIPE_WEBHOOK_SECRET` in environment settings without service interruption.
