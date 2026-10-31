#!/usr/bin/env node
/**
 * Production Database Restore & Rollback Utility
 * Restores a specified or most recent verified database backup.
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

async function runRestore() {
  console.log("==========================================");
  console.log(" PulseFlow Database Restore / Rollback Utility");
  console.log("==========================================");

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`[ERROR] Backup directory not found at ${BACKUP_DIR}. No backups available.`);
    process.exit(1);
  }

  const requestedFile = process.argv[2];
  let targetBackupFile = "";

  if (requestedFile) {
    targetBackupFile = path.isAbsolute(requestedFile) ? requestedFile : path.join(BACKUP_DIR, requestedFile);
  } else {
    // Pick the most recent backup
    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("pulseflow_backup_") && f.endsWith(".db"))
      .sort()
      .reverse();

    if (backups.length === 0) {
      console.error("[ERROR] No backups found in backups directory.");
      process.exit(1);
    }
    targetBackupFile = path.join(BACKUP_DIR, backups[0]);
  }

  if (!fs.existsSync(targetBackupFile)) {
    console.error(`[ERROR] Target backup file not found: ${targetBackupFile}`);
    process.exit(1);
  }

  console.log(`Selected Backup: ${targetBackupFile}`);

  // Verify checksum if meta file exists
  const metaFilePath = `${targetBackupFile}.meta.json`;
  if (fs.existsSync(metaFilePath)) {
    const meta = JSON.parse(fs.readFileSync(metaFilePath, "utf8"));
    const currentBuf = fs.readFileSync(targetBackupFile);
    const currentHash = crypto.createHash("sha256").update(currentBuf).digest("hex");

    if (currentHash !== meta.sha256) {
      console.error(`[CRITICAL] Backup checksum mismatch! Expected ${meta.sha256}, got ${currentHash}. Restore aborted.`);
      process.exit(1);
    }
    console.log(`Checksum verified: ${currentHash}`);
  }

  // Pre-restore snapshot: backup current active DB before replacing it
  if (fs.existsSync(DB_PATH)) {
    const preRestoreSnapshot = path.join(BACKUP_DIR, `pre_restore_snapshot_${Date.now()}.db`);
    fs.copyFileSync(DB_PATH, preRestoreSnapshot);
    console.log(`Created pre-restore safety snapshot: ${preRestoreSnapshot}`);
  }

  // Perform restoration
  fs.copyFileSync(targetBackupFile, DB_PATH);
  console.log(`Restored database to: ${DB_PATH}`);
  console.log("==========================================");
  console.log(" Database restoration completed successfully!");
  console.log("==========================================");
}

runRestore().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
