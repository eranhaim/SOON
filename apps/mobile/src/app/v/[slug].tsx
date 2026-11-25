import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import type { VendorPublicDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { InquirySheet, MatchCallSheet, ReviewSheet, type InquiryKind } from '@/components/VendorContact';
import { VendorPage } from '@/components/VendorPage';
import { IconButton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { shareVendorLink } from '@/lib/links';
import { useSavedIds, useToggleSave } from '@/lib/saved';
import { useSessionUser } from '@/lib/session';
import { useWedding } from '@/lib/wedding';
import { atEnd, atStart, colors, space } from '@/theme/tokens';

/**
 * Public vendor page: /v/<slug>. Anyone can open it (a link from Instagram, WhatsApp…).
 * Couples act on it (save, message, availability, quote, match call, review); visitors are sent
 * to sign up as a couple and come back here. With ?preview=1 it is the vendor's own preview (spec §9).
 */
export default function VendorPublic() {
  const { slug, preview } = useLocalSearchParams<{ slug: string; preview?: string }>();
  const [vendor, setVendor] = useState<VendorPublicDTO | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const { role, isPending: sessionPending } = useSessionUser();
  const wedding = useWedding();
  const savedIds = useSavedIds();
  const toggleSave = useToggleSave();
  const [inquiry, setInquiry] = useState<InquiryKind | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

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

  const isCouple = role === 'couple';
  /** Visitors sign up as a couple, then return to this page. */
  const joinFirst = () =>
    router.push({ pathname: '/sign-in', params: { role: 'couple', mode: 'signup', next: `/v/${vendor.slug}` } } as unknown as Href);

  function couple(fn: () => void) {
    return () => {
      if (sessionPending) return;
      if (isCouple) return fn();
      if (!role) return joinFirst();
      notify('לזוגות בלבד', 'פנייה לספקים זמינה מחשבון של זוג.');
    };
  }

  const onAction = preview
    ? undefined
    : (action: 'save' | InquiryKind) =>
        couple(() => {
          if (action === 'save') toggleSave(vendor.id, !savedIds.has(vendor.id));
          else setInquiry(action);
        })();

  return (
    <Screen contentStyle={{ padding: 0, gap: 0 }}>
      {preview ? (
        <View style={{ backgroundColor: colors.accent, padding: space.sm }}>
          <Text variant="caption" color={colors.inverse} align="center">
            תצוגה מקדימה — כך זוגות יראו את העמוד שלכם
          </Text>
        </View>
      ) : null}
      <View>
        <VendorPage
          vendor={vendor}
          saved={savedIds.has(vendor.id)}
          onAction={onAction}
          onMatchCall={preview ? undefined : couple(() => setCallOpen(true))}
          onWriteReview={preview ? undefined : couple(() => setReviewOpen(true))}
          footer={
            !role && !sessionPending && !preview ? (
              <View style={{ gap: space.sm, paddingVertical: space.lg }}>
                <Text variant="h3" align="center">
                  מתחתנים? הצטרפו ל־SOON
                </Text>
                <Text variant="bodySmall" color={colors.inkSoft} align="center">
                  שלחו הודעה, בדקו זמינות וקבעו שיחת התאמה עם כל הספקים במקום אחד.
                </Text>
                <Button label="הרשמה חינם" onPress={joinFirst} />
              </View>
            ) : null
          }
        />
        <View style={{ position: 'absolute', top: space.md, ...atStart(space.md) }}>
          <IconButton
            icon="chevron-right"
            label="חזרה"
            size={20}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
        <View style={{ position: 'absolute', top: space.md, ...atEnd(space.md) }}>
          <IconButton icon="share-2" label="שיתוף העמוד" size={18} onPress={() => void shareVendorLink(vendor)} />
        </View>
      </View>

      <InquirySheet vendor={vendor} kind={inquiry} weddingDate={wedding.data?.wedding?.weddingDate ?? null} onClose={() => setInquiry(null)} />
      <MatchCallSheet vendor={vendor} visible={callOpen} onClose={() => setCallOpen(false)} />
      <ReviewSheet vendor={vendor} visible={reviewOpen} onClose={() => setReviewOpen(false)} />
    </Screen>
  );
}
