import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import type { VendorOwnerDTO } from '@soon/shared';

import { api } from './api';

type Ctx = {
  vendor: VendorOwnerDTO | null;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
  setVendor: (v: VendorOwnerDTO) => void;
  /** Calls a vendor endpoint that returns the full storefront, and stores the result. */
  mutate: (path: string, init: { method: string; json?: unknown }) => Promise<VendorOwnerDTO>;
};

const VendorContext = createContext<Ctx | null>(null);

export function VendorProvider({ children }: { children: ReactNode }) {
  const [vendor, setVendor] = useState<VendorOwnerDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchVendor = () => api<{ vendor: VendorOwnerDTO | null }>('/api/vendors/me');

  const reload = useCallback(async () => {
    try {
      setVendor((await fetchVendor()).vendor);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetchVendor()
      .then((res) => alive && (setVendor(res.vendor), setError(false)))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const mutate = useCallback(async (path: string, init: { method: string; json?: unknown }) => {
    const next = await api<VendorOwnerDTO>(path, init);
    setVendor(next);
    return next;
  }, []);

  return (
    <VendorContext.Provider value={{ vendor, loading, error, reload, setVendor, mutate }}>
      {children}
    </VendorContext.Provider>
  );
}

export function useVendor() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error('useVendor must be used inside <VendorProvider>');
  return ctx;
}

/** For screens that only render after onboarding (the tabs layout guarantees it). */
export function useOwnVendor() {
  const ctx = useVendor();
  if (!ctx.vendor) throw new Error('No vendor loaded');
  return { ...ctx, vendor: ctx.vendor };
}
