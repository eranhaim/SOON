import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { formatHebrewDate, type InvitationTemplateDTO } from '@soon/shared';

import { formatDayDots } from '@/lib/dates';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

import { Text } from './Text';

export type InvitationContent = {
  opening: string;
  body: string;
  closing: string;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string | null;
  venueName?: string | null;
  receptionTime?: string | null;
  chuppahTime?: string | null;
};

const weekday = (iso: string) => new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/** The designed invitation. With a template: its background, paper, text and accent colors and font. */
export function InvitationArt({ c, template, italic }: { c: InvitationContent; template?: InvitationTemplateDTO | null; italic?: boolean }) {
  const paper = template?.paperColor ?? colors.surface;
  const ink = template?.textColor ?? colors.ink;
  const accent = template?.accentColor ?? colors.goldLight;
  const display = template?.font === 'sans' ? fonts.bodyMedium : fonts.display;
  return (
    <View style={[styles.card, { backgroundColor: paper }]}>
      {template?.backgroundUrl ? <Image source={template.backgroundUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
      <View style={[styles.inner, { borderColor: accent }, template?.backgroundUrl ? { backgroundColor: `${paper}D9` } : null]}>
        <Text align="center" style={[styles.opening, { color: ink }, italic && { fontStyle: 'italic' }]}>
          {c.opening}
        </Text>
        <Text align="center" style={[styles.names, { color: ink, fontFamily: display }]}>
          {c.partner1Name}
          {'\n'}&{'\n'}
          {c.partner2Name}
        </Text>
        <View style={[styles.rule, { backgroundColor: accent }]} />
        <Text align="center" style={[styles.body, { color: ink }, italic && { fontStyle: 'italic' }]}>
          {c.body}
        </Text>
        {c.weddingDate ? (
          <View style={{ alignItems: 'center', gap: 2, marginTop: space.md }}>
            <Text align="center" style={[styles.weekday, { color: accent }]}>
              {weekday(c.weddingDate)}
            </Text>
            <Text align="center" style={[styles.date, { color: ink, fontFamily: display }]}>
              {formatDayDots(c.weddingDate)}
            </Text>
            <Text align="center" style={[styles.hebrew, { color: ink }]}>
              {formatHebrewDate(c.weddingDate)}
            </Text>
          </View>
        ) : null}
        {c.venueName ? (
          <Text align="center" style={[styles.venue, { color: ink }]}>
            {c.venueName}
          </Text>
        ) : null}
        {c.receptionTime || c.chuppahTime ? (
          <Text align="center" style={[styles.times, { color: ink }]}>
            {[c.receptionTime && `קבלת פנים ${c.receptionTime}`, c.chuppahTime && `חופה וקידושין ${c.chuppahTime}`].filter(Boolean).join('   ·   ')}
          </Text>
        ) : null}
        <View style={[styles.rule, { backgroundColor: accent }]} />
        <Text align="center" style={[styles.closing, { color: ink, fontFamily: display }]}>
          {c.closing}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', padding: 10, ...shadow.md },
  inner: { borderRadius: radius.md, borderWidth: 1, paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.sm, alignItems: 'center' },
  opening: { fontFamily: fonts.body, fontSize: 13, letterSpacing: 1.5, opacity: 0.85 },
  names: { fontSize: 36, lineHeight: 44, marginVertical: space.sm },
  rule: { width: 40, height: 1, marginVertical: space.sm },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, opacity: 0.9 },
  weekday: { fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 2 },
  date: { fontSize: 24, lineHeight: 30, letterSpacing: 2 },
  hebrew: { fontFamily: fonts.body, fontSize: 13, opacity: 0.8 },
  venue: { fontFamily: fonts.bodyMedium, fontSize: 15, marginTop: space.sm },
  times: { fontFamily: fonts.body, fontSize: 13, opacity: 0.85 },
  closing: { fontSize: 18, lineHeight: 26 },
});
