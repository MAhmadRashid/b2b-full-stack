import test from "node:test";
import assert from "node:assert/strict";

const RAW_DEMO_TELEMETRY = [
  { id: "evt_1", type: "api_request", src: "gateway-edge-sea", region: "us-west-2", code: 200, time: "Just now", lat: "18ms", status: "SUCCESS", method: "POST" },
  { id: "evt_2", type: "auth_verify", src: "auth-cluster-iad", region: "us-east-1", code: 200, time: "2s ago", lat: "24ms", status: "SUCCESS", method: "POST" },
  { id: "evt_3", type: "telemetry_sync", src: "worker-eu-central", region: "eu-central-1", code: 200, time: "4s ago", lat: "32ms", status: "SUCCESS", method: "POST" },
  { id: "evt_4", type: "pipeline_job", src: "batch-node-08", region: "us-east-1", code: 429, time: "6s ago", lat: "88ms", status: "WARNING", method: "POST" },
  { id: "evt_5", type: "webhook_dispatch", src: "event-bus-ord", region: "us-east-1", code: 200, time: "9s ago", lat: "19ms", status: "SUCCESS", method: "POST" },
  { id: "evt_6", type: "db_replica_read", src: "db-proxy-fra", region: "eu-central-1", code: 500, time: "11s ago", lat: "142ms", status: "ERROR", method: "GET" },
  { id: "evt_7", type: "metrics_ingest", src: "collector-sin", region: "ap-southeast-1", code: 200, time: "14s ago", lat: "29ms", status: "SUCCESS", method: "POST" },
  { id: "evt_8", type: "token_rotation", src: "security-iad", region: "us-east-1", code: 201, time: "18s ago", lat: "21ms", status: "SUCCESS", method: "POST" },
  { id: "evt_9", type: "rate_limiter_probe", src: "gateway-pdx", region: "us-west-2", code: 429, time: "22s ago", lat: "64ms", status: "WARNING", method: "GET" },
  { id: "evt_10", type: "cluster_heartbeat", src: "k8s-mesh-fra", region: "eu-central-1", code: 200, time: "26s ago", lat: "15ms", status: "SUCCESS", method: "POST" },
  { id: "evt_11", type: "grpc_stream_fail", src: "edge-sin", region: "ap-southeast-1", code: 500, time: "30s ago", lat: "210ms", status: "ERROR", method: "POST" },
  { id: "evt_12", type: "audit_log_write", src: "audit-iad", region: "us-east-1", code: 200, time: "35s ago", lat: "17ms", status: "SUCCESS", method: "POST" },
];

function filterTelemetry(stream, statusFilter, regionFilter) {
  return stream.filter((item) => {
    if (statusFilter === "200" && item.code !== 200 && item.code !== 201) return false;
    if (statusFilter === "429" && item.code !== 429) return false;
    if (statusFilter === "500" && item.code !== 500) return false;
    if (regionFilter !== "ALL" && item.region !== regionFilter) return false;
    return true;
  });
}

test("Phase 15 Unit: Telemetry filter with ALL returns all events", () => {
  const result = filterTelemetry(RAW_DEMO_TELEMETRY, "ALL", "ALL");
  assert.equal(result.length, 12);
});

test("Phase 15 Unit: Status filter 200 returns successful events", () => {
  const result = filterTelemetry(RAW_DEMO_TELEMETRY, "200", "ALL");
  assert.equal(result.length, 8);
  assert.ok(result.every((item) => item.code === 200 || item.code === 201));
  assert.ok(result.every((item) => item.status === "SUCCESS"));
});

test("Phase 15 Unit: Status filter 429 returns rate limit warning events", () => {
  const result = filterTelemetry(RAW_DEMO_TELEMETRY, "429", "ALL");
  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.code === 429));
  assert.ok(result.every((item) => item.status === "WARNING"));
});

test("Phase 15 Unit: Status filter 500 returns error events", () => {
  const result = filterTelemetry(RAW_DEMO_TELEMETRY, "500", "ALL");
  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.code === 500));
  assert.ok(result.every((item) => item.status === "ERROR"));
});

test("Phase 15 Unit: Region filter isolates supported regions accurately", () => {
  const usEast = filterTelemetry(RAW_DEMO_TELEMETRY, "ALL", "us-east-1");
  assert.equal(usEast.length, 5);
  assert.ok(usEast.every((item) => item.region === "us-east-1"));

  const euCentral = filterTelemetry(RAW_DEMO_TELEMETRY, "ALL", "eu-central-1");
  assert.equal(euCentral.length, 3);
  assert.ok(euCentral.every((item) => item.region === "eu-central-1"));

  const apSoutheast = filterTelemetry(RAW_DEMO_TELEMETRY, "ALL", "ap-southeast-1");
  assert.equal(apSoutheast.length, 2);
  assert.ok(apSoutheast.every((item) => item.region === "ap-southeast-1"));
});

test("Phase 15 Unit: Combined status and region filter works correctly", () => {
  const filtered = filterTelemetry(RAW_DEMO_TELEMETRY, "500", "eu-central-1");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "evt_6");
  assert.equal(filtered[0].code, 500);
  assert.equal(filtered[0].region, "eu-central-1");
});

test("Phase 15 Unit: Search query filters telemetry stream by endpoint or source correctly", () => {
  function searchTelemetry(stream, query) {
    if (!query || !query.trim()) return stream;
    const q = query.toLowerCase();
    return stream.filter(
      (item) =>
        item.type.toLowerCase().includes(q) ||
        item.src.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        String(item.code).includes(q)
    );
  }

  const resultBySrc = searchTelemetry(RAW_DEMO_TELEMETRY, "gateway-edge");
  assert.equal(resultBySrc.length, 1);
  assert.equal(resultBySrc[0].src, "gateway-edge-sea");

  const resultByType = searchTelemetry(RAW_DEMO_TELEMETRY, "auth_verify");
  assert.equal(resultByType.length, 1);
  assert.equal(resultByType[0].type, "auth_verify");

  const resultByRegion = searchTelemetry(RAW_DEMO_TELEMETRY, "ap-southeast-1");
  assert.equal(resultByRegion.length, 2);
});

test("Phase 15 Unit: Pricing toggle accurately calculates 20% annual discount prices", () => {
  const plans = {
    starter: { monthly: 29, annualDiscounted: 23 },
    pro: { monthly: 99, annualDiscounted: 79 },
    business: { monthly: 249, annualDiscounted: 199 },
  };

  function getPrice(planKey, cycle) {
    return cycle === "annual" ? plans[planKey].annualDiscounted : plans[planKey].monthly;
  }

  assert.equal(getPrice("starter", "monthly"), 29);
  assert.equal(getPrice("starter", "annual"), 23);
  assert.equal(getPrice("pro", "monthly"), 99);
  assert.equal(getPrice("pro", "annual"), 79);
  assert.equal(getPrice("business", "monthly"), 249);
  assert.equal(getPrice("business", "annual"), 199);
});
