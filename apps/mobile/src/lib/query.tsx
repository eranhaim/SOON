/**
 * Server state via TanStack Query. Screens read with useApiQuery and write with
 * useApiMutation, which invalidates the affected keys so every screen stays in sync
 * (e.g. saving a vendor updates search results, the saved tab and the home feed).
 */
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { api, ApiError } from './api';

/** One client for the app (exported so sign-out / demo tools can clear the cache). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx won't fix itself on retry.
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** GET `path`, cached under `key`. Pass `path: null` to wait (dependent queries). */
export function useApiQuery<T>(
  key: QueryKey,
  path: string | null,
  options: Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'> = {},
) {
  return useQuery<T, Error, T, QueryKey>({
    queryKey: key,
    queryFn: () => api<T>(path!),
    enabled: path != null && (options.enabled ?? true),
    ...options,
  });
}

type MutationInput = { path: string; method?: string; json?: unknown };

/**
 * A write that invalidates `invalidate` keys on success. If the response is the new value
 * for one key (the API usually returns the updated collection), pass `setData` to apply it
 * immediately instead of refetching.
 */
export function useApiMutation<T = unknown>(opts: { invalidate?: QueryKey[]; setData?: QueryKey } = {}) {
  const qc = useQueryClient();
  return useMutation<T, Error, MutationInput>({
    mutationFn: ({ path, method = 'POST', json }) => api<T>(path, { method, json }),
    onSuccess: async (data) => {
      if (opts.setData) qc.setQueryData(opts.setData, data);
      await Promise.all(
        (opts.invalidate ?? []).map((key) => qc.invalidateQueries({ queryKey: key })),
      );
    },
  });
}

/** Query keys, in one place so invalidation can't drift from the readers. */
export const keys = {
  wedding: ['wedding'] as const,
  home: ['couple-home'] as const,
  search: (params: Record<string, unknown>) => ['search', params] as const,
  searchAll: ['search'] as const,
  saved: ['saved'] as const,
  vendorPage: (slug: string) => ['vendor-page', slug] as const,
  tasks: ['planning', 'tasks'] as const,
  budget: ['planning', 'budget'] as const,
  guests: ['planning', 'guests'] as const,
  events: ['planning', 'events'] as const,
  myVendors: ['planning', 'my-vendors'] as const,
  planning: ['planning'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversations', id] as const,
  leads: ['leads'] as const,
  lead: (id: string) => ['leads', id] as const,
  calendar: ['calendar'] as const,
  dashboard: ['vendor-dashboard'] as const,
  reviews: (slug: string) => ['reviews', slug] as const,
  unread: ['unread'] as const,
  boards: ['boards'] as const,
  board: (id: string) => ['boards', id] as const,
};
