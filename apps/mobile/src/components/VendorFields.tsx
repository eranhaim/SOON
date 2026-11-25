/**
 * Form parts shared by vendor sign-up and the storefront editor:
 * service regions (with "all of Israel"), price (or "no price"), About text with "help me write",
 * and the category picker with search.
 */
import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { REGIONS, VENDOR_CATEGORIES, type RegionSlug } from '@soon/shared';

import { api, errorMessage } from '@/lib/api';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { PressableScale } from './motion';
import { Text } from './Text';
import { TextField } from './TextField';
import { Chip, ChipGroup } from './ui';

const ALL_REGIONS = REGIONS.map((r) => r.slug);

/** Region chips with "כל הארץ" first (selects every region). */
export function RegionPicker({ value, onChange }: { value: RegionSlug[]; onChange: (v: RegionSlug[]) => void }) {
  const all = ALL_REGIONS.every((r) => value.includes(r));
  return (
    <ChipGroup>
      <Chip label="כל הארץ" selected={all} onPress={() => onChange(all ? [] : [...ALL_REGIONS])} />
      {REGIONS.map((r) => (
        <Chip
          key={r.slug}
          label={r.he}
          selected={!all && value.includes(r.slug)}
          onPress={() => {
            if (all) return onChange([r.slug]);
            onChange(value.includes(r.slug) ? value.filter((x) => x !== r.slug) : [...value, r.slug]);
          }}
        />
      ))}
    </ChipGroup>
  );
}

/** Category chips with a search box (there are many categories). */
export function CategoryPicker({ value, onChange }: { value: string | undefined; onChange: (slug: string) => void }) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const list = term ? VENDOR_CATEGORIES.filter((c) => c.he.includes(term) || c.slug.includes(term.toLowerCase())) : VENDOR_CATEGORIES;
  return (
    <View style={{ gap: space.sm }}>
      <TextField label="חיפוש תחום" value={q} onChangeText={setQ} placeholder="למשל: צילום, DJ, פרחים" />
      <ChipGroup>
        {list.map((c) => (
          <Chip key={c.slug} label={c.he} selected={value === c.slug} onPress={() => onChange(c.slug)} />
        ))}
      </ChipGroup>
      {list.length === 0 ? (
        <Text variant="caption" color={colors.inkMuted}>
          לא מצאנו תחום כזה. נסו מילה אחרת.
        </Text>
      ) : null}
    </View>
  );
}

/** From / to price, or "don't show a price" (couples then see "price on request"). */
export function PriceFields({
  from,
  to,
  hidden,
  onChange,
  errorFrom,
  errorTo,
}: {
  from: string;
  to: string;
  hidden: boolean;
  onChange: (v: { from: string; to: string; hidden: boolean }) => void;
  errorFrom?: string;
  errorTo?: string;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Chip
        label="לא לציין מחיר (יוצג ״מחיר לפי פנייה״)"
        selected={hidden}
        onPress={() => onChange({ from: '', to: '', hidden: !hidden })}
      />
      {!hidden ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField
              label="מחיר החל מ־ (₪)"
              ltr
              keyboardType="number-pad"
              value={from}
              onChangeText={(v) => onChange({ from: v, to, hidden })}
              error={errorFrom}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="עד (₪)" ltr keyboardType="number-pad" value={to} onChangeText={(v) => onChange({ from, to: v, hidden })} error={errorTo} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** About text with "עזרה בכתיבה": a few words become one full paragraph. */
export function AboutField({
  value,
  onChange,
  facts,
  error,
  footer,
}: {
  value: string;
  onChange: (v: string) => void;
  facts: { businessName: string; category: string | undefined; regions: RegionSlug[] };
  error?: string;
  footer?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [helpError, setHelpError] = useState<string>();
  const canHelp = facts.businessName.trim().length >= 2 && Boolean(facts.category);

  async function help() {
    if (!facts.category) return;
    setHelpError(undefined);
    setBusy(true);
    try {
      const r = await api<{ text: string }>('/api/vendors/about-draft', {
        method: 'POST',
        json: { businessName: facts.businessName, category: facts.category, regions: facts.regions, notes: value },
      });
      onChange(r.text);
    } catch (err) {
      setHelpError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <TextField
        label="אודות העסק"
        value={value}
        onChangeText={onChange}
        multiline
        placeholder="כתבו כמה מילים: מה מיוחד בכם, הסגנון, מה הזוגות מקבלים…"
        style={{ minHeight: 140, textAlignVertical: 'top' }}
        maxLength={4000}
        error={error}
      />
      <PressableScale
        accessibilityRole="button"
        disabled={!canHelp || busy}
        onPress={help}
        style={[styles.help, (!canHelp || busy) && { opacity: 0.5 }]}>
        <Feather name="feather" size={15} color={colors.accent} />
        <Text variant="label" color={colors.accent} style={{ fontFamily: fonts.bodyMedium }}>
          {busy ? 'כותבים…' : value.trim() ? 'השלמה לפסקה מלאה' : 'עזרה בכתיבה'}
        </Text>
      </PressableScale>
      <Text variant="caption" color={colors.inkMuted}>
        כתבו כמה מילים ולחצו – נכתוב מהן פסקה מלאה, ואתם יכולים לערוך אותה.
      </Text>
      {helpError ? (
        <Text variant="caption" color={colors.danger}>
          {helpError}
        </Text>
      ) : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  help: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
});
