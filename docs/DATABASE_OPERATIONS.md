# PulseFlow SaaS - Database Operations & Migration Safety Guide

This document establishes safe database management, migration, backup, and recovery policies for production operations.

---

## 1. Database Architecture & Multi-Tenancy

- **Engine**: SQLite in local development/staging; PostgreSQL 16+ in production.
- **ORM & Schema**: Prisma ORM with connection pooling via PgBouncer / Neon connection pooler.
- **Tenant Isolation**: Strict logical multi-tenancy enforced through `organizationId` and `workspaceId` foreign keys and indexed query scopes.

---

## 2. Safe Migration Procedures

### Golden Rules
1. **Never use destructive commands in production**:
   - `prisma migrate reset` is strictly forbidden in production environments.
   - Always run pre-deployment backup before schema mutations.
2. **Backward-Compatible Schema Changes**:
   - Always apply schema changes in two phases (expand -> contract).
   - Never remove or rename columns in use by the active application version.
   - When introducing non-nullable columns, provide default values or add them as nullable first.

### Applying Migrations
```bash
# 1. Take safety snapshot before applying schema changes
npm run backup

# 2. Check pending changes
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# 3. Apply safe migration
npx prisma migrate deploy
# Or for direct schema synchronization:
npx prisma db push --accept-data-loss=false
```

---

## 3. Automated Backups & Verification

PulseFlow includes automated backup tooling:

### Creating Backups
```bash
# Run automated backup with SHA-256 integrity verification
npm run backup
```
- Creates timestamped snapshots in `/backups/pulseflow_backup_<timestamp>.db`.
- Writes cryptographic SHA-256 checksums to `<filename>.meta.json`.
- Automatically retains the 14 most recent backups and purges older archives.

### Restoring Backups
```bash
# Restore most recent verified backup:
npm run restore

# Restore specific historical snapshot:
node scripts/restore-db.mjs backups/pulseflow_backup_2026-10-24T21-13-59-752Z.db
```
- Restores the selected backup file.
- Automatically creates a pre-restore safety snapshot before overriding the active database.
- Verifies SHA-256 checksums before applying.

---

## 4. PostgreSQL Production Backup & Restore Runbook

When using hosted PostgreSQL (e.g. Neon, AWS RDS, Supabase):

### Daily Scheduled Backup (pg_dump)
```bash
# Full database logical backup
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="backups/pg_dump_$(date +%Y%m%d_%H%M%S).dump"
```

### Emergency Restore (pg_restore)
```bash
# Restore from custom format dump
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  backups/pg_dump_20261024_210000.dump
```
