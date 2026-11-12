import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  agorotToShekelsInput,
  MIN_ABOUT_CHARS,
  REGIONS,
  shekelsToAgorot,
  VENDOR_CATEGORIES,
  vendorProfileUpdateSchema,
  type RegionSlug,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup, SectionTitle } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, space } from '@/theme/tokens';

/** Edit storefront details (spec §9: My Profile / Edit Storefront). */
export default function VendorProfile() {
  const { vendor, mutate } = useOwnVendor();
  const [form, setForm] = useState({
    businessName: vendor.businessName,
    category: vendor.categorySlug,
    phone: vendor.phone ?? '',
    email: vendor.email ?? '',
    websiteUrl: vendor.websiteUrl ?? '',
    instagramUrl: vendor.instagramUrl ?? '',
    priceFrom: agorotToShekelsInput(vendor.priceFromAgorot),
    priceTo: agorotToShekelsInput(vendor.priceToAgorot),
    about: vendor.about ?? '',
    cancellationPolicy: vendor.cancellationPolicy ?? '',
  });
  const [regions, setRegions] = useState<RegionSlug[]>(vendor.regions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string }>();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setError(undefined);
    const payload = {
      businessName: form.businessName,
      category: form.category,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      websiteUrl: form.websiteUrl.trim(),
      instagramUrl: form.instagramUrl.trim(),
      priceFrom: shekelsToAgorot(form.priceFrom),
      priceTo: shekelsToAgorot(form.priceTo),
      about: form.about.trim() || null,
      cancellationPolicy: form.cancellationPolicy.trim() || null,
      regions,
    };
    const parsed = vendorProfileUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return setError({ message: hebrewIssue(issue?.path.join('.') ?? '', issue?.message), field: issue?.path.join('.') });
    }
    setBusy(true);
    try {
      await mutate('/api/vendors/me', { method: 'PATCH', json: payload });
      router.back();
    } catch (err) {
      setError({ message: errorMessage(err), field: err instanceof ApiError ? err.data.field : undefined });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (f: string) => (error?.field === f ? error.message : undefined);
  const aboutLen = form.about.trim().length;

  return (
    <Screen title="פרטי העסק" back backTo="/vendor/business">
      <TextField label="שם העסק" value={form.businessName} onChangeText={set('businessName')} error={fieldError('businessName')} />

      <View style={{ gap: space.sm }}>
        <SectionTitle>תחום</SectionTitle>
        <ChipGroup>
          {VENDOR_CATEGORIES.map((c) => (
            <Chip key={c.slug} label={c.he} selected={form.category === c.slug} onPress={() => set('category')(c.slug)} />
          ))}
        </ChipGroup>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>אזורי שירות</SectionTitle>
        <ChipGroup>
          {REGIONS.map((r) => (
            <Chip
              key={r.slug}
              label={r.he}
              selected={regions.includes(r.slug)}
              onPress={() => setRegions((cur) => (cur.includes(r.slug) ? cur.filter((x) => x !== r.slug) : [...cur, r.slug]))}
            />
          ))}
        </ChipGroup>
        {fieldError('regions') ? (
          <Text variant="caption" color={colors.danger}>
            {fieldError('regions')}
          </Text>
        ) : null}
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TextField label="מחיר החל מ־ (₪)" ltr keyboardType="number-pad" value={form.priceFrom} onChangeText={set('priceFrom')} error={fieldError('priceFrom')} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="עד (₪)" ltr keyboardType="number-pad" value={form.priceTo} onChangeText={set('priceTo')} error={fieldError('priceTo')} />
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <TextField
          label="אודות"
          value={form.about}
          onChangeText={set('about')}
          multiline
          style={{ minHeight: 140, textAlignVertical: 'top' }}
          maxLength={4000}
          error={fieldError('about')}
        />
        <Text variant="caption" color={aboutLen >= MIN_ABOUT_CHARS ? colors.inkMuted : colors.inkSoft}>
          {aboutLen >= MIN_ABOUT_CHARS ? `${aboutLen} תווים` : `${aboutLen}/${MIN_ABOUT_CHARS} תווים לפחות לשליחה לאישור`}
        </Text>
      </View>

      <SectionTitle>יצירת קשר וקישורים</SectionTitle>
      <TextField label="טלפון" ltr keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} error={fieldError('phone')} />
      <TextField label="אימייל" ltr keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={set('email')} error={fieldError('email')} />
      <TextField label="Instagram (קישור)" ltr autoCapitalize="none" placeholder="https://instagram.com/..." value={form.instagramUrl} onChangeText={set('instagramUrl')} error={fieldError('instagramUrl')} />
      <TextField label="אתר" ltr autoCapitalize="none" placeholder="https://..." value={form.websiteUrl} onChangeText={set('websiteUrl')} error={fieldError('websiteUrl')} />

      <TextField
        label="מדיניות ביטול"
        value={form.cancellationPolicy}
        onChangeText={set('cancellationPolicy')}
        multiline
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />

      {error && !error.field ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error.message}
        </Text>
      ) : null}
      <Button label="שמירה" loading={busy} onPress={save} />
    </Screen>
  );
}

function hebrewIssue(field: string, message?: string) {
  if (message && /[֐-׿]/.test(message)) return message;
  const labels: Record<string, string> = {
    businessName: 'שם העסק קצר מדי',
    phone: 'מספר הטלפון לא תקין',
    email: 'כתובת האימייל לא תקינה',
    websiteUrl: 'הקישור לאתר צריך להתחיל ב־https://',
    instagramUrl: 'הקישור ל־Instagram צריך להתחיל ב־https://',
    regions: 'בחרו לפחות אזור אחד',
  };
  return labels[field] ?? 'בדקו את הפרטים';
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
});
