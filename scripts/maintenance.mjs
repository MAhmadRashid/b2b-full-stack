#!/usr/bin/env node
/**
 * Automated Production Maintenance & Housekeeping Script
 * Prunes expired authentication tokens, sweeps stale invitations,
 * checks database connectivity, and logs maintenance results.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runMaintenance() {
  const startTime = Date.now();
  console.log("==========================================================");
  console.log(" PulseFlow Production Maintenance & Housekeeping Utility");
  console.log("==========================================================");

  const now = new Date();
  console.log(`Execution Timestamp: ${now.toISOString()}`);

  try {
    // 1. Clean up expired password reset tokens
    const deletedResetTokens = await prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
    console.log(`  ✓ Pruned expired password reset tokens: ${deletedResetTokens.count}`);

    // 2. Clean up expired email verification tokens
    const deletedVerifyTokens = await prisma.verificationToken.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
    console.log(`  ✓ Pruned expired email verification tokens: ${deletedVerifyTokens.count}`);

    // 3. Clean up expired pending invitations older than 14 days
    const staleInvitationThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const deletedInvitations = await prisma.invitation.deleteMany({
      where: {
        expiresAt: { lt: staleInvitationThreshold },
      },
    });
    console.log(`  ✓ Pruned stale pending invitations: ${deletedInvitations.count}`);

    // 4. Record Maintenance Audit Entry
    await prisma.auditLog.create({
      data: {
        action: "SYSTEM_MAINTENANCE_COMPLETED",
        details: `Automated maintenance pruned ${deletedResetTokens.count} reset tokens, ${deletedVerifyTokens.count} verification tokens, and ${deletedInvitations.count} stale invitations.`,
        userEmail: "system@pulseflow.internal",
      },
    });
    console.log(`  ✓ Recorded maintenance audit log entry.`);

    const durationMs = Date.now() - startTime;
    console.log("==========================================================");
    console.log(` Maintenance Routine Completed Successfully in ${durationMs}ms`);
    console.log("==========================================================");
  } catch (error) {
    console.error("[CRITICAL] Maintenance routine failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMaintenance();
