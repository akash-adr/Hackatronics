import { apiClient } from './client';

/** Substance list and validation bounds, straight from the backend. */
export const fetchConfigSchema = async () => {
  const response = await apiClient.get('/api/facility-config-schema');
  return response.data;
};

// A request that never returns is worse than one that fails: the dashboard
// would sit on "STALE -- recomputing" forever. 3s is far above the ~20ms a
// local compute takes, so this only trips on a genuinely dead connection.
export const COMPUTE_TIMEOUT_MS = 3000;

/**
 * Full hazard / geometry / safe-approach response for one scenario.
 * `config` carries the facility fields; centre coordinates are passed
 * alongside because the backend needs them to place the polygons.
 *
 * Throws on timeout or any non-2xx status, so the caller's fallback path is
 * the single place failure is handled.
 */
export const fetchComputeZone = async (config, { signal } = {}) => {
  const response = await apiClient.post('/api/compute-zone', config, {
    signal,
    timeout: COMPUTE_TIMEOUT_MS,
  });
  return response.data;
};

/**
 * Multi-tank escalation check.
 *
 * Sends the primary facility's ALREADY-COMPUTED result rather than any
 * parameters, so the backend re-runs no physics -- it only tests containment
 * against polygons this client already holds.
 */
export const checkEscalation = async ({
  primaryResult,
  primaryLat,
  primaryLon,
  secondLat,
  secondLon,
}) => {
  const response = await apiClient.post('/api/check-escalation', {
    primary_result: primaryResult,
    primary_lat: primaryLat,
    primary_lon: primaryLon,
    second_lat: secondLat,
    second_lon: secondLon,
  });
  return response.data;
};

/**
 * Dual-facility compute. Same contract as fetchComputeZone: same timeout,
 * throws on timeout or any non-2xx so the caller owns the failure path.
 */
export const fetchComputeZoneDual = async (payload, { signal } = {}) => {
  const response = await apiClient.post('/api/compute-zone-dual', payload, {
    signal,
    timeout: COMPUTE_TIMEOUT_MS,
  });
  return response.data;
};


// The AI endpoint is a proxy to a metered external model, and measured latency
// is 6-13 s -- far beyond COMPUTE_TIMEOUT_MS. It gets its own, much longer
// budget so a normal-speed suggestion is never aborted as if it had failed.
const AI_SUGGESTION_TIMEOUT_MS = 35000;

/**
 * Ask the backend for a safety suggestion. The Gemini key lives server-side;
 * this only ever talks to our own origin.
 */
export const fetchAiSuggestion = async (payload, { signal } = {}) => {
  const response = await apiClient.post('/api/ai-suggestion', payload, {
    signal,
    timeout: AI_SUGGESTION_TIMEOUT_MS,
  });
  return response.data;
};
