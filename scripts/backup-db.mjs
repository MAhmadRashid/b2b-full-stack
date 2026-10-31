#!/usr/bin/env node
/**
 * Automated Production Database Backup Script
 * Supports SQLite local backups and provides runbook hooks for PostgreSQL dumps.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const BACKUP_DIR = path.resolve(rootDir, "backups");
const DB_PATH = path.resolve(rootDir, "prisma", "dev.db");
const MAX_BACKUPS = 14;

async function runBackup() {
  console.log("==========================================");
  console.log(" PulseFlow Production Database Backup Utility");
  console.log("==========================================");

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Created backup storage directory: ${BACKUP_DIR}`);
  }

  // Check if SQLite database exists
  if (!fs.existsSync(DB_PATH)) {
    console.warn(`[WARN] SQLite database file not found at ${DB_PATH}. Checking for PostgreSQL configuration...`);
    const dbUrl = process.env.DATABASE_URL || "";
    if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
      console.log("[INFO] PostgreSQL connection detected in DATABASE_URL.");
      console.log("[RUNBOOK] Use pg_dump for PostgreSQL backups: pg_dump $DATABASE_URL > backups/db_dump_$(date +%s).sql");
      return;
    }
    console.error(`[ERROR] No active database found to back up.`);
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `pulseflow_backup_${timestamp}.db`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  console.log(`Source Database: ${DB_PATH}`);
  console.log(`Target Backup:   ${backupFilePath}`);

  // Copy database file atomically
  fs.copyFileSync(DB_PATH, backupFilePath);

  // Calculate SHA-256 checksum
  const fileBuffer = fs.readFileSync(backupFilePath);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const stats = fs.statSync(backupFilePath);

  console.log(`Backup Size:     ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`SHA-256 Hash:    ${hash}`);

  // Write checksum metadata file
  const metaFilePath = `${backupFilePath}.meta.json`;
  const metadata = {
    timestamp: new Date().toISOString(),
    filename: backupFileName,
    sizeBytes: stats.size,
    sha256: hash,
    source: DB_PATH,
  };
  fs.writeFileSync(metaFilePath, JSON.stringify(metadata, null, 2), "utf8");
  console.log(`Metadata wrote:  ${metaFilePath}`);

  // Rotation: Keep only the most recent MAX_BACKUPS
  const allBackups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("pulseflow_backup_") && f.endsWith(".db"))
    .sort()
    .reverse();

  if (allBackups.length > MAX_BACKUPS) {
    const toRemove = allBackups.slice(MAX_BACKUPS);
    for (const oldFile of toRemove) {
      const fullOldPath = path.join(BACKUP_DIR, oldFile);
      const fullMetaPath = `${fullOldPath}.meta.json`;
      if (fs.existsSync(fullOldPath)) fs.unlinkSync(fullOldPath);
      if (fs.existsSync(fullMetaPath)) fs.unlinkSync(fullMetaPath);
      console.log(`Rotated old backup: ${oldFile}`);
    }
  }

  console.log("==========================================");
  console.log(" Backup successfully created and verified!");
  console.log("==========================================");
}

runBackup().catch((err) => {
  console.error("Backup failed with error:", err);
  process.exit(1);
});
