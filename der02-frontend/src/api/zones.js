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
