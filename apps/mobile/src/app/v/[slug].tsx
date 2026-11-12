import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import type { VendorPublicDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VendorPage } from '@/components/VendorPage';
import { IconButton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { colors, space } from '@/theme/tokens';

/** Public vendor page: /v/<slug>. With ?preview=1 it's the vendor's own preview (spec §9). */
export default function VendorPublic() {
  const { slug, preview } = useLocalSearchParams<{ slug: string; preview?: string }>();
  const [vendor, setVendor] = useState<VendorPublicDTO | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');

  const fetchVendor = useCallback(() => api<VendorPublicDTO>(`/api/vendors/${encodeURIComponent(slug)}`), [slug]);
  const failState = (err: unknown) => (err instanceof ApiError && err.status === 404 ? 'missing' : 'error');

  /** Manual retry. */
  const load = useCallback(async () => {
    setState('loading');
    try {
      setVendor(await fetchVendor());
      setState('ok');
    } catch (err) {
      setState(failState(err));
    }
  }, [fetchVendor]);

  useEffect(() => {
    let alive = true;
    fetchVendor()
      .then((v) => alive && (setVendor(v), setState('ok')))
      .catch((err) => alive && setState(failState(err)));
    return () => {
      alive = false;
    };
  }, [fetchVendor]);

  if (state === 'loading') return <Loading />;
  if (state !== 'ok' || !vendor) {
    return (
      <Screen back backTo="/" title={state === 'missing' ? 'העמוד לא נמצא' : 'לא הצלחנו לטעון'}>
        <Text color={colors.inkSoft}>
          {state === 'missing' ? 'ייתכן שהעסק עדיין לא פורסם.' : 'בדקו את החיבור ונסו שוב.'}
        </Text>
        {state === 'error' ? <Button label="נסו שוב" onPress={load} /> : null}
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ padding: 0, gap: 0 }}>
      {preview ? (
        <View style={{ backgroundColor: colors.ink, padding: space.sm }}>
          <Text variant="caption" color={colors.inverse} align="center">
            תצוגה מקדימה — כך זוגות יראו את העמוד שלכם
          </Text>
        </View>
      ) : null}
      <View>
        <VendorPage vendor={vendor} />
        <View style={{ position: 'absolute', top: space.md, start: space.md }}>
          <IconButton
            icon="chevron-right"
            label="חזרה"
            size={20}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
      </View>
    </Screen>
  );
}
