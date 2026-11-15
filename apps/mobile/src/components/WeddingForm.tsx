/** Wedding details fields, shared by couple onboarding and the profile screen (spec §3). */
import { View } from 'react-native';

import { REGIONS, VENDOR_CATEGORIES, type RegionSlug } from '@soon/shared';

import { colors, space } from '@/theme/tokens';

import { DateField } from './DateField';
import { Text } from './Text';
import { TextField } from './TextField';
import { Chip, ChipGroup } from './ui';

export type WeddingFormState = {
  partner1Name: string;
  partner2Name: string;
  phone: string;
  weddingDate: string | null;
  region: RegionSlug | null;
  venueName: string;
  budget: string;
  closed: string[];
  needed: string[];
};

type Setter = (patch: Partial<WeddingFormState>) => void;

const toggle = (list: string[], slug: string) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);

export function NamesFields({ form, set, withPhone }: { form: WeddingFormState; set: Setter; withPhone?: boolean }) {
  return (
    <>
      <TextField label="שם בן/בת הזוג הראשון/ה" value={form.partner1Name} onChangeText={(v) => set({ partner1Name: v })} maxLength={80} />
      <TextField label="שם בן/בת הזוג השני/ה" value={form.partner2Name} onChangeText={(v) => set({ partner2Name: v })} maxLength={80} />
      {withPhone ? (
        <TextField label="טלפון" ltr value={form.phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" autoComplete="tel" />
      ) : null}
    </>
  );
}

export function WhenWhereFields({ form, set }: { form: WeddingFormState; set: Setter }) {
  return (
    <>
      <DateField label="תאריך החתונה" value={form.weddingDate} onChange={(d) => set({ weddingDate: d })} clearable placeholder="עוד לא נקבע" />
      <View style={{ gap: space.sm }}>
        <Text variant="caption" color={colors.inkSoft}>
          אזור
        </Text>
        <ChipGroup>
          {REGIONS.map((r) => (
            <Chip key={r.slug} label={r.he} selected={form.region === r.slug} onPress={() => set({ region: form.region === r.slug ? null : r.slug })} />
          ))}
        </ChipGroup>
      </View>
      <TextField label="מקום / אולם (אם כבר נסגר)" value={form.venueName} onChangeText={(v) => set({ venueName: v })} maxLength={120} />
    </>
  );
}

export function BudgetCategoryFields({ form, set }: { form: WeddingFormState; set: Setter }) {
  return (
    <>
      <TextField label="תקציב כולל משוער (₪)" ltr value={form.budget} onChangeText={(v) => set({ budget: v })} keyboardType="number-pad" />
      <View style={{ gap: space.sm }}>
        <Text variant="caption" color={colors.inkSoft}>
          מה כבר סגרתם?
        </Text>
        <ChipGroup>
          {VENDOR_CATEGORIES.map((c) => (
            <Chip
              key={c.slug}
              label={c.he}
              selected={form.closed.includes(c.slug)}
              onPress={() => set({ closed: toggle(form.closed, c.slug), needed: form.needed.filter((s) => s !== c.slug) })}
            />
          ))}
        </ChipGroup>
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="caption" color={colors.inkSoft}>
          מה עוד מחפשים?
        </Text>
        <ChipGroup>
          {VENDOR_CATEGORIES.filter((c) => !form.closed.includes(c.slug)).map((c) => (
            <Chip key={c.slug} label={c.he} selected={form.needed.includes(c.slug)} onPress={() => set({ needed: toggle(form.needed, c.slug) })} />
          ))}
        </ChipGroup>
      </View>
    </>
  );
}
