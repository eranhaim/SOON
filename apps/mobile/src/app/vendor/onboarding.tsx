import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  PRODUCER_CATEGORY,
  REGIONS,
  shekelsToAgorot,
  VENDOR_CATEGORIES,
  vendorOnboardingSchema,
  type RegionSlug,
  type VendorOwnerDTO,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useVendor } from '@/lib/vendor-context';
import { colors, hairline, space } from '@/theme/tokens';

const STEPS = 3;

/** Three short steps (spec §3 spirit: short questions, finish the rest later). */
export default function VendorOnboarding() {
  const { vendor, loading, setVendor } = useVendor();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<string>();
  const [regions, setRegions] = useState<RegionSlug[]>([]);
  const [phone, setPhone] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (loading) return <Loading />;
  if (vendor) return <Redirect href="/vendor" />;

  const canNext =
    step === 1 ? businessName.trim().length >= 2 && Boolean(category) : step === 2 ? regions.length > 0 && phone.trim().length >= 9 : true;

  async function finish() {
    setError(undefined);
    const payload = {
      businessName,
      category,
      phone,
      regions,
      about: about.trim() || undefined,
      priceFrom: shekelsToAgorot(priceFrom) ?? undefined,
      priceTo: shekelsToAgorot(priceTo) ?? undefined,
    };
    const parsed = vendorOnboardingSchema.safeParse(payload);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'בדקו את הפרטים');
    setBusy(true);
    try {
      const created = await api<VendorOwnerDTO>('/api/vendors', { method: 'POST', json: parsed.data });
      setVendor(created);
      router.replace('/vendor');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen maxWidth={560}>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Text variant="caption" color={colors.inkMuted} style={{ letterSpacing: 3 }}>
          {`שלב ${step} מתוך ${STEPS}`}
        </Text>
        <View style={styles.progress}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.progressSeg, i < step && styles.progressOn]} />
          ))}
        </View>
      </View>

      {step === 1 && (
        <>
          <Text variant="h1">ספרו לנו על העסק</Text>
          <TextField label="שם העסק" value={businessName} onChangeText={setBusinessName} autoFocus maxLength={100} />
          <View style={{ gap: space.sm }}>
            <Text variant="caption" color={colors.inkSoft}>
              תחום
            </Text>
            <ChipGroup>
              {VENDOR_CATEGORIES.map((c) => (
                <Chip key={c.slug} label={c.he} selected={category === c.slug} onPress={() => setCategory(c.slug)} />
              ))}
            </ChipGroup>
            {category === PRODUCER_CATEGORY ? (
              <Text variant="caption" color={colors.inkSoft}>
                מפיקות מקבלות בהמשך גם את כלי ניהול ההפקות.
              </Text>
            ) : null}
          </View>
        </>
      )}

      {step === 2 && (
        <>
          <Text variant="h1">איפה אתם עובדים?</Text>
          <View style={{ gap: space.sm }}>
            <Text variant="caption" color={colors.inkSoft}>
              אזורי שירות (אפשר לבחור כמה)
            </Text>
            <ChipGroup>
              {REGIONS.map((r) => (
                <Chip
                  key={r.slug}
                  label={r.he}
                  selected={regions.includes(r.slug)}
                  onPress={() =>
                    setRegions((cur) => (cur.includes(r.slug) ? cur.filter((x) => x !== r.slug) : [...cur, r.slug]))
                  }
                />
              ))}
            </ChipGroup>
          </View>
          <TextField label="טלפון העסק" ltr value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        </>
      )}

      {step === 3 && (
        <>
          <Text variant="h1">מחירים ומילה עליכם</Text>
          <Text variant="bodySmall" color={colors.inkSoft}>
            אפשר לדלג ולהשלים אחר כך.
          </Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label="מחיר החל מ־ (₪)" ltr value={priceFrom} onChangeText={setPriceFrom} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="עד (₪)" ltr value={priceTo} onChangeText={setPriceTo} keyboardType="number-pad" />
            </View>
          </View>
          <TextField label="אודות" value={about} onChangeText={setAbout} multiline numberOfLines={5} style={{ minHeight: 120 }} maxLength={2000} />
        </>
      )}

      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <View style={styles.footer}>
        {step > 1 ? <Button variant="ghost" label="הקודם" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        {step < STEPS ? (
          <Button label="המשך" disabled={!canNext} onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
        ) : (
          <Button label="יצירת הפרופיל" loading={busy} onPress={finish} style={{ flex: 2 }} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: space.xs },
  progressSeg: { flex: 1, height: 2, backgroundColor: colors.line },
  progressOn: { backgroundColor: colors.ink },
  row: { flexDirection: 'row', gap: space.md },
  footer: { flexDirection: 'row', gap: space.md, marginTop: space.lg, borderTopWidth: hairline, borderTopColor: colors.line, paddingTop: space.lg },
});
