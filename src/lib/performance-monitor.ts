/**
 * Performance Monitoring & SLA Latency Interceptor
 * Computes statistical percentiles (P50, P90, P99), tracks slow queries,
 * and maintains ring buffers for live observability.
 */

export interface LatencySample {
  endpoint: string;
  method: string;
  durationMs: number;
  statusCode: number;
  timestamp: number;
}

export interface LatencyPercentiles {
  p50: number;
  p90: number;
  p99: number;
  min: number;
  max: number;
  count: number;
}

export interface SlowRequestAlert {
  endpoint: string;
  method: string;
  durationMs: number;
  thresholdMs: number;
  statusCode: number;
  timestamp: string;
}

const MAX_SAMPLES = 500;
const SLOW_REQUEST_THRESHOLD_MS = 500;
const SAMPLES: LatencySample[] = [];
const SLOW_REQUESTS: SlowRequestAlert[] = [];
const MAX_SLOW_LOGS = 50;

/**
 * Records a completed HTTP request's latency.
 */
export function recordRequestLatency(sample: {
  endpoint: string;
  method: string;
  durationMs: number;
  statusCode: number;
}): void {
  const entry: LatencySample = {
    ...sample,
    timestamp: Date.now(),
  };

  SAMPLES.push(entry);
  if (SAMPLES.length > MAX_SAMPLES) {
    SAMPLES.shift();
  }

  // Check SLA threshold
  if (sample.durationMs > SLOW_REQUEST_THRESHOLD_MS) {
    const slowAlert: SlowRequestAlert = {
      endpoint: sample.endpoint,
      method: sample.method,
      durationMs: sample.durationMs,
      thresholdMs: SLOW_REQUEST_THRESHOLD_MS,
      statusCode: sample.statusCode,
      timestamp: new Date().toISOString(),
    };

    SLOW_REQUESTS.unshift(slowAlert);
    if (SLOW_REQUESTS.length > MAX_SLOW_LOGS) {
      SLOW_REQUESTS.pop();
    }
  }
}

/**
 * Computes statistical percentiles across recent latency samples.
 */
export function calculatePercentiles(endpointFilter?: string): LatencyPercentiles {
  let list = SAMPLES;
  if (endpointFilter) {
    list = SAMPLES.filter((s) => s.endpoint === endpointFilter);
  }

  if (list.length === 0) {
    return { p50: 0, p90: 0, p99: 0, min: 0, max: 0, count: 0 };
  }

  const sorted = list.map((s) => s.durationMs).sort((a, b) => a - b);
  const count = sorted.length;

  const getPercentile = (p: number) => {
    const idx = Math.min(Math.floor((p / 100) * (count - 1)), count - 1);
    return sorted[idx];
  };

  return {
    p50: getPercentile(50),
    p90: getPercentile(90),
    p99: getPercentile(99),
    min: sorted[0],
    max: sorted[count - 1],
    count,
  };
}

/**
 * Returns recent slow request alerts exceeding SLA threshold.
 */
export function getSlowRequests(): SlowRequestAlert[] {
  return [...SLOW_REQUESTS];
}

/**
 * Clears recorded samples (used during testing).
 */
export function resetPerformanceMetrics(): void {
  SAMPLES.length = 0;
  SLOW_REQUESTS.length = 0;
}
