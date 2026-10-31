#!/usr/bin/env node
/**
 * Automated Live Integration Test Runner for PulseFlow
 * 
 * 1. Checks if a server is already responding on PORT (default 5000).
 * 2. If not, spawns `next start -p 5000` (or builds if needed).
 * 3. Waits for /api/health to respond 200 HEALTHY with timeout.
 * 4. Runs node --test across all tests/integration/*.test.mjs.
 * 5. Safely terminates any spawned server process on exit/SIGINT/SIGTERM.
 */

import { spawn } from "node:child_process";
import http from "node:http";
import process from "node:process";

const PORT = process.env.PORT || "5000";
const BASE_URL = `http://localhost:${PORT}`;
const HEALTH_URL = `${BASE_URL}/api/health`;
const MAX_WAIT_MS = 45000;
const POLL_INTERVAL_MS = 1000;

let serverProcess = null;

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      if (res.statusCode === 200) {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve(data.status === "HEALTHY" || data.status === "healthy");
          } catch {
            resolve(true); // Got 200 response
          }
        });
      } else {
        resolve(false);
      }
    });

    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(timeoutMs = MAX_WAIT_MS) {
  const start = Date.now();
  process.stdout.write(`Waiting for server on ${BASE_URL} to become healthy...`);

  while (Date.now() - start < timeoutMs) {
    const ok = await checkHealth();
    if (ok) {
      console.log(` Ready! (${Date.now() - start}ms)`);
      return true;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.log(` Timed out after ${timeoutMs}ms.`);
  return false;
}

function cleanup() {
  if (serverProcess) {
    console.log("\n[Runner] Shutting down spawned Next.js server (PID: " + serverProcess.pid + ")...");
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch (e) {
      // Ignore cleanup error
    }
    serverProcess = null;
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });
process.on("SIGTERM", () => { cleanup(); process.exit(143); });

async function run() {
  console.log("=================================================");
  console.log(" PulseFlow Integration Test Suite Orchestrator");
  console.log(` Target: ${BASE_URL}`);
  console.log("=================================================");

  const alreadyUp = await checkHealth();

  if (alreadyUp) {
    console.log(`Existing server detected on ${BASE_URL}. Running integration tests directly.`);
  } else {
    console.log(`No active server on port ${PORT}. Spawning 'next start -p ${PORT}'...`);
    const isWin = process.platform === "win32";
    const nextBin = isWin ? "npx.cmd" : "npx";
    
    serverProcess = spawn(nextBin, ["next", "start", "-p", PORT], {
      env: { ...process.env, PORT },
      stdio: "pipe",
      shell: isWin,
    });

    serverProcess.stdout.on("data", (data) => {
      const msg = data.toString();
      if (process.env.DEBUG_TEST_SERVER) {
        process.stdout.write(`[Server] ${msg}`);
      }
    });

    serverProcess.stderr.on("data", (data) => {
      const msg = data.toString();
      if (process.env.DEBUG_TEST_SERVER || msg.toLowerCase().includes("error")) {
        process.stderr.write(`[Server Error] ${msg}`);
      }
    });

    serverProcess.on("exit", (code) => {
      if (code !== null && code !== 0 && code !== 1) {
        console.warn(`[Server] Process exited with code ${code}`);
      }
    });

    const isHealthy = await waitForServer(MAX_WAIT_MS);
    if (!isHealthy) {
      console.error("[Runner] Failed to start and verify server health. Aborting integration tests.");
      cleanup();
      process.exit(1);
    }
  }

  console.log("\n=================================================");
  console.log(" Executing 14 Integration Test Suites");
  console.log("=================================================\n");

  const testArgs = [
    "--test",
    "tests/integration/api.test.mjs",
    "tests/integration/api_keys_phase7_integration.test.mjs",
    "tests/integration/billing_phase6_integration.test.mjs",
    "tests/integration/monitoring_phase10_integration.test.mjs",
    "tests/integration/organizations_workspaces.test.mjs",
    "tests/integration/phase12_superadmin_integration.test.mjs",
    "tests/integration/phase13_notifications_integration.test.mjs",
    "tests/integration/phase14_onboarding_integration.test.mjs",
    "tests/integration/phase16_seo_integration.test.mjs",
    "tests/integration/phase17_api_keys_hardening.test.mjs",
    "tests/integration/phase2.test.mjs",
    "tests/integration/phase3.test.mjs",
    "tests/integration/phase8_e2e_qa.test.mjs",
    "tests/integration/security_phase5_integration.test.mjs",
  ];

  const testProcess = spawn(process.execPath, testArgs, {
    stdio: "inherit",
    env: { ...process.env, BASE_URL, TEST_BASE_URL: BASE_URL },
  });

  testProcess.on("exit", (code) => {
    cleanup();
    console.log(`\n=================================================`);
    console.log(` Integration Tests Finished with code: ${code}`);
    console.log(`=================================================`);
    process.exit(code || 0);
  });
}

run().catch((err) => {
  console.error("[Runner] Unhandled execution error:", err);
  cleanup();
  process.exit(1);
});
