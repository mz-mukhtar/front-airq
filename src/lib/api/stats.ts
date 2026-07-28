import { apiRequest } from './client';
import { dedupeAsync } from './dedupe';
import { PublicStats } from './types';

export type { PublicStats };

/** Public landing-page aggregate counts (no auth) — GET /public/stats. */
export async function getPublicStats(): Promise<PublicStats> {
  return dedupeAsync('public-stats', () =>
    apiRequest<PublicStats>('/public/stats', { requireAuth: false })
  );
}
