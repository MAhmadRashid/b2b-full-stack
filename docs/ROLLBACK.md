# PulseFlow SaaS - Production Rollback & Incident Recovery Guide

This runbook defines the emergency procedures for rolling back failed releases or recovering from critical production incidents.

---

## 1. Rollback Decision Criteria

Trigger an immediate rollback when:
- Error rates on `/api/v1/ingest` or `/api/auth/login` exceed 1% over a 5-minute window.
- Database connection pool exhaustion causes HTTP 503/504 spikes.
- Data corruption, unintended data leakage, or authorization bypass is discovered.
- Critical smoke tests fail immediately following a deployment.

---

## 2. Application Rollback Procedures

### Vercel (Instant Rollback - Recommended)
1. Navigate to the **Vercel Dashboard -> Deployments**.
2. Locate the previous healthy deployment (marked with a green checkmark).
3. Click the three dots menu `...` -> **Instant Rollback**.
4. Confirm promotion of the previous deployment to production.
5. Vercel re-routes global edge traffic within seconds without rebuilding.

### Railway / Render
1. Navigate to your service dashboard -> **Deployments**.
2. Select the last successful commit/build.
3. Click **Rollback to this deployment**.

### Docker / Self-Hosted VPS
1. Pull or checkout the previous release tag:
   ```bash
   git checkout tags/v1.0.0-stable
   ```
2. Rebuild and restart the container:
   ```bash
   docker compose up -d --build
   ```
3. Run smoke test verification:
   ```bash
   npm run smoke
   ```

---

## 3. Database Recovery Procedures

If the incident involves schema corruption or failed migrations:

### Step 1: Put Application in Maintenance Mode (Optional)
If database state is actively corrupting, scale the app container to 0 or route traffic to a static maintenance page in Cloudflare/Vercel.

### Step 2: Restore Verified Database Snapshot
```bash
# Execute restore utility with checksum verification
npm run restore
```

### Step 3: Run Smoke Tests & Re-enable Traffic
```bash
npm run smoke
```
Verify `/api/health` reports status `HEALTHY` and verify tenant data integrity.

---

## 4. Post-Incident Review (PIR)
Within 24 hours of any production rollback:
1. Document the incident timeline, root cause, and impact window.
2. Add automated regression tests covering the defect.
3. Review staging verification steps to prevent identical recurrence.
