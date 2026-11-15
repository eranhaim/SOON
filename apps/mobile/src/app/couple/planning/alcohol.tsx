import { useState } from 'react';
import { View } from 'react-native';

import { ALCOHOL_DRINKS, ALCOHOL_EVENT_PROFILES, estimateAlcohol, type AlcoholDrink, type AlcoholEventProfile, type GuestListDTO } from '@soon/shared';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, Chip, ChipGroup, Divider } from '@/components/ui';
import { keys, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme/tokens';

/** Alcohol calculator (spec §7.3). Shown as an estimate, not a commitment. */
export default function Alcohol() {
  const guestsQ = useApiQuery<GuestListDTO>(keys.guests, '/api/planning/guests');
  const fromList = guestsQ.data ? guestsQ.data.people.confirmed + guestsQ.data.people.waiting + guestsQ.data.people.invited : 0;
  const [guests, setGuests] = useState<string>('');
  const [pct, setPct] = useState('70');
  const [profile, setProfile] = useState<AlcoholEventProfile>('classic');
  const [drinks, setDrinks] = useState<AlcoholDrink[]>(['wine', 'beer', 'vodka', 'whisky']);

  const guestCount = Number(guests || fromList || 0);
  const est = estimateAlcohol({ guests: guestCount, drinkingPct: Number(pct) || 0, profile, drinks });

  return (
    <Screen title="מחשבון אלכוהול" back backTo="/couple/planning">
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="מספר אורחים"
            ltr
            keyboardType="number-pad"
            value={guests}
            placeholder={fromList ? String(fromList) : '300'}
            onChangeText={setGuests}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="אחוז שותים" ltr keyboardType="number-pad" value={pct} onChangeText={setPct} />
        </View>
      </View>
      {fromList && !guests ? (
        <Text variant="caption" color={colors.inkMuted}>{`לפי רשימת המוזמנים: ${fromList} אנשים (ללא מי שלא מגיע)`}</Text>
      ) : null}
      <View style={{ gap: space.sm }}>
        <Text variant="caption" color={colors.inkSoft}>סוג האירוע</Text>
        <ChipGroup>
          {ALCOHOL_EVENT_PROFILES.map((p) => (
            <Chip key={p.key} label={p.label} selected={profile === p.key} onPress={() => setProfile(p.key)} />
          ))}
        </ChipGroup>
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="caption" color={colors.inkSoft}>משקאות</Text>
        <ChipGroup>
          {ALCOHOL_DRINKS.map((d) => (
            <Chip
              key={d.key}
              label={d.label}
              selected={drinks.includes(d.key)}
              onPress={() => setDrinks((cur) => (cur.includes(d.key) ? cur.filter((x) => x !== d.key) : [...cur, d.key]))}
            />
          ))}
        </ChipGroup>
      </View>

      <Card>
        <Text variant="label" color={colors.inkSoft}>{`${est.drinkers} שותים · כ־${est.totalServings} מנות`}</Text>
        {est.lines.map((l, i) => (
          <View key={l.key} style={{ gap: space.sm }}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <Text variant="body" style={{ flex: 1 }}>
                {l.label}
              </Text>
              <Text variant="h2">{String(l.units)}</Text>
              <Text variant="caption" color={colors.inkSoft}>{l.unit}</Text>
            </View>
          </View>
        ))}
        {!est.lines.length ? <Text color={colors.inkSoft}>בחרו לפחות משקה אחד.</Text> : null}
      </Card>
      <Text variant="caption" color={colors.inkMuted}>
        זו הערכה בלבד, כולל מרווח ביטחון של 10%. כדאי לאמת את הכמויות מול ספק הבר.
      </Text>
    </Screen>
  );
}
