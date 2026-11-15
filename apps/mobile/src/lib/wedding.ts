import type { WeddingDTO } from '@soon/shared';

import { keys, useApiQuery } from './query';

/** The signed-in couple's wedding (null before onboarding). */
export function useWedding() {
  return useApiQuery<{ wedding: WeddingDTO | null }>(keys.wedding, '/api/weddings/me');
}

/** For screens rendered behind the onboarding gate (couple/_layout.tsx guarantees it). */
export function useOwnWedding(): WeddingDTO {
  const { data } = useWedding();
  if (!data?.wedding) throw new Error('No wedding loaded');
  return data.wedding;
}
