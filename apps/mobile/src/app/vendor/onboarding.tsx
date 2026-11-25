import Feather from '@expo/vector-icons/Feather';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  PLANS,
  PRODUCER_CATEGORY,
  shekelsToAgorot,
  TRIAL_DAYS,
  vendorOnboardingSchema,
  type PlanKey,
  type RegionSlug,
  type VendorOwnerDTO,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { PressableScale } from '@/components/motion';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { AboutField, CategoryPicker, PriceFields, RegionPicker } from '@/components/VendorFields';
import { api, errorMessage } from '@/lib/api';
import { useSessionUser } from '@/lib/session';
import { useVendor } from '@/lib/vendor-context';
import { colors, fonts, hairline, radius, shadow, space } from '@/theme/tokens';

const STEPS = 4;

/** Four short steps (spec §3 spirit: short questions, finish the rest later). */
export default function VendorOnboarding() {
  const { vendor, loading, setVendor } = useVendor();
  const { user } = useSessionUser();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState(() => (user?.name ?? '').trim().split(/\s+/)[0] ?? '');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<string>();
  const [regions, setRegions] = useState<RegionSlug[]>([]);
  const [phone, setPhone] = useState('');
  const [price, setPrice] = useState({ from: '', to: '', hidden: false });
  const [about, setAbout] = useState('');
  const [plan, setPlan] = useState<PlanKey>('pro');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (loading) return <Loading />;
  if (vendor) return <Redirect href="/vendor" />;

  const canNext =
    step === 1
      ? firstName.trim().length >= 2 && businessName.trim().length >= 2 && Boolean(category)
      : step === 2
        ? regions.length > 0 && phone.trim().length >= 9
        : true;

  async function finish() {
    setError(undefined);
    const payload = {
      firstName,
      businessName,
      category,
      phone,
      regions,
      plan,
      about: about.trim() || undefined,
      priceFrom: price.hidden ? undefined : (shekelsToAgorot(price.from) ?? undefined),
      priceTo: price.hidden ? undefined : (shekelsToAgorot(price.to) ?? undefined),
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
          <Text variant="h1">נעים להכיר</Text>
          <TextField label="שם פרטי" value={firstName} onChangeText={setFirstName} autoComplete="given-name" maxLength={40} />
          <TextField label="שם העסק" value={businessName} onChangeText={setBusinessName} maxLength={100} />
          <View style={{ gap: space.sm }}>
            <Text variant="caption" color={colors.inkSoft}>
              תחום
            </Text>
            <CategoryPicker value={category} onChange={setCategory} />
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
              אזורי שירות (אפשר לבחור כמה, או את כל הארץ)
            </Text>
            <RegionPicker value={regions} onChange={setRegions} />
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
          <PriceFields from={price.from} to={price.to} hidden={price.hidden} onChange={setPrice} />
          <AboutField value={about} onChange={setAbout} facts={{ businessName, category, regions }} />
        </>
      )}

      {step === 4 && (
        <>
          <Text variant="h1">בחרו מסלול</Text>
          <View style={styles.trial}>
            <Feather name="gift" size={18} color={colors.accent} />
            <Text variant="bodySmall" style={{ flex: 1 }}>
              {`החודש הראשון עלינו: ${TRIAL_DAYS} ימים חינם בכל מסלול. בלי התחייבות, אפשר להחליף מסלול בכל רגע.`}
            </Text>
          </View>
          <View style={{ gap: space.md }}>
            {PLANS.map((p) => {
              const on = plan === p.key;
              return (
                <PressableScale
                  key={p.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  scaleTo={0.98}
                  onPress={() => setPlan(p.key)}
                  style={[styles.plan, on && styles.planOn]}>
                  <View style={styles.planHead}>
                    <View style={{ flex: 1 }}>
                      <Text variant="h2">{p.name}</Text>
                      <Text variant="bodySmall" color={colors.inkSoft}>
                        {p.tagline}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.planPrice}>{p.priceMonthly ? `₪${p.priceMonthly}` : 'חינם'}</Text>
                      {p.priceMonthly ? (
                        <Text variant="caption" color={colors.inkMuted}>
                          לחודש, אחרי החודש החינמי
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {p.features.map((f) => (
                    <View key={f} style={styles.feature}>
                      <Feather name="check" size={14} color={on ? colors.accent : colors.gold} />
                      <Text variant="bodySmall" style={{ flex: 1 }}>
                        {f}
                      </Text>
                    </View>
                  ))}
                </PressableScale>
              );
            })}
          </View>
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
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line },
  progressOn: { backgroundColor: colors.accent },
  trial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  plan: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent', ...shadow.sm },
  planOn: { borderColor: colors.accent, ...shadow.md },
  planHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.xs },
  planPrice: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { flexDirection: 'row', gap: space.md, marginTop: space.lg, borderTopWidth: hairline, borderTopColor: colors.line, paddingTop: space.lg },
});
