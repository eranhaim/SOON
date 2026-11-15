import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { router } from 'expo-router';

import type { CoupleHomeDTO, SavedVendorDTO, VendorCardDTO, VendorSearchResult } from '@soon/shared';

import { api } from './api';
import { notify } from './confirm';
import { keys, useApiQuery } from './query';
import { useSessionUser } from './session';

const flip = (cards: VendorCardDTO[], id: string, saved: boolean) =>
  cards.map((c) => (c.id === id ? { ...c, saved, saveCount: c.saveCount + (saved ? 1 : -1) } : c));

/**
 * Save / unsave a vendor for the couple's wedding (spec §6). Optimistic across every cached
 * list that shows the heart, then reconciled with the server.
 */
export function useToggleSave() {
  const qc = useQueryClient();
  const { role } = useSessionUser();

  const mutation = useMutation({
    mutationFn: ({ vendorId, saved }: { vendorId: string; saved: boolean }) =>
      api(`/api/saved/${vendorId}`, { method: saved ? 'PUT' : 'DELETE' }),
    onMutate: async ({ vendorId, saved }) => {
      await qc.cancelQueries({ queryKey: keys.searchAll });
      const snapshot: [QueryKey, unknown][] = [
        ...qc.getQueriesData({ queryKey: keys.searchAll }),
        ...qc.getQueriesData({ queryKey: keys.home }),
        ...qc.getQueriesData({ queryKey: keys.saved }),
      ];
      qc.setQueriesData<VendorSearchResult>({ queryKey: keys.searchAll }, (old) =>
        old ? { ...old, items: flip(old.items, vendorId, saved) } : old,
      );
      qc.setQueryData<CoupleHomeDTO>(keys.home, (old) =>
        old ? { ...old, recommended: flip(old.recommended, vendorId, saved), fresh: flip(old.fresh, vendorId, saved) } : old,
      );
      if (!saved) qc.setQueryData<SavedVendorDTO[]>(keys.saved, (old) => old?.filter((v) => v.id !== vendorId));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      notify('לא הצלחנו לשמור', 'נסו שוב בעוד רגע.');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.saved });
      void qc.invalidateQueries({ queryKey: keys.home });
    },
  });

  /** Non-couples get sent to sign in instead (the heart is visible on public pages too). */
  return (vendorId: string, saved: boolean) => {
    if (role !== 'couple') {
      router.push('/choose-role');
      return;
    }
    mutation.mutate({ vendorId, saved });
  };
}

/** Saved vendor ids, for pages that don't carry a `saved` flag (the vendor page). */
export function useSavedIds() {
  const { role } = useSessionUser();
  const q = useApiQuery<SavedVendorDTO[]>(keys.saved, role === 'couple' ? '/api/saved' : null);
  return new Set((q.data ?? []).map((v) => v.id));
}
