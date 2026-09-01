import { apiClient } from './client';

/** Substance list and validation bounds, straight from the backend. */
export const fetchConfigSchema = async () => {
  const response = await apiClient.get('/api/facility-config-schema');
  return response.data;
};

/**
 * Full hazard / geometry / safe-approach response for one scenario.
 * `config` carries the facility fields; centre coordinates are passed
 * alongside because the backend needs them to place the polygons.
 */
export const fetchComputeZone = async (config, { signal } = {}) => {
  const response = await apiClient.post('/api/compute-zone', config, { signal });
  return response.data;
};
