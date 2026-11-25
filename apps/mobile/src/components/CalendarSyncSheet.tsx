import { Linking, Platform, StyleSheet, View } from 'react-native';

import type { VendorAccountDTO } from '@soon/shared';

import { api, errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';

/**
 * Subscribe Google Calendar / Apple Calendar to the vendor's private feed. One-way
 * (SOON → calendar), refreshed by the calendar app; stable event IDs prevent duplicates.
 */
export function CalendarSyncSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const q = useApiQuery<VendorAccountDTO>(keys.account, '/api/vendors/me/account', { enabled: visible });
  const rotate = useApiMutation<VendorAccountDTO>({ setData: keys.account });
  const google = useApiQuery<{ available: boolean; connected: boolean; email: string | null; lastError: string | null }>(
    ['google-calendar'],
    visible ? '/api/vendors/me/google-calendar' : null,
  );
  const url = q.data?.calendarFeedUrl ?? '';
  const webcal = url.replace(/^https?:\/\//, 'webcal://');

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="יומן" title="סנכרון ליומן שלכם">
      <Text variant="bodySmall" color={colors.inkSoft}>
        האירועים, הפגישות והימים החסומים מ־SOON יופיעו ביומן שבטלפון ויתעדכנו לבד. כל אירוע מופיע פעם אחת ומתעדכן במקום — בלי כפילויות.
      </Text>
      {google.data?.available ? (
        <View style={styles.google}>
          <Text variant="label">{google.data.connected ? 'מחובר ליומן Google' : 'יומן Google נפרד (מומלץ)'}</Text>
          <Text variant="caption" color={colors.inkSoft}>
            {google.data.connected
              ? `יומן "SOON" ב־${google.data.email ?? 'חשבון Google שלכם'} מתעדכן מיד בכל שינוי.`
              : 'יוצר יומן "SOON" משלכם תחת "היומנים שלי" ב־Google, ומעדכן אותו מיד בכל שינוי.'}
          </Text>
          {google.data.lastError ? (
            <Text variant="caption" color={colors.danger}>
              {`הסנכרון האחרון נכשל: ${google.data.lastError}`}
            </Text>
          ) : null}
          {google.data.connected ? (
            <Button
              size="sm"
              variant="ghost"
              label="ניתוק"
              onPress={async () => {
                if (await confirm('ניתוק מ־Google', 'היומן יישאר ב־Google אבל יפסיק להתעדכן.', 'ניתוק')) {
                  await api('/api/vendors/me/google-calendar', { method: 'DELETE' });
                  await google.refetch();
                }
              }}
            />
          ) : (
            <Button
              label="חיבור ליומן Google"
              icon="calendar"
              onPress={async () => {
                try {
                  const { url: auth } = await api<{ url: string }>('/api/vendors/me/google-calendar/connect', { method: 'POST' });
                  if (Platform.OS === 'web') window.location.href = auth;
                  else await Linking.openURL(auth);
                } catch (err) {
                  notify('החיבור נכשל', errorMessage(err));
                }
              }}
            />
          )}
        </View>
      ) : null}
      <Button
        label={google.data?.available ? 'מנוי ב־Google Calendar (תחת "יומנים אחרים")' : 'הוספה ל־Google Calendar'}
        icon="calendar"
        variant={google.data?.available ? 'outline' : 'primary'}
        disabled={!url}
        onPress={() => Linking.openURL(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`)}
      />
      <Button label="הוספה ליומן של iPhone / Apple" icon="smartphone" variant="outline" disabled={!url} onPress={() => Linking.openURL(webcal)} />
      <View style={styles.urlBox}>
        <Text variant="caption" color={colors.inkMuted}>
          כתובת היומן (ליומנים אחרים, כמו Outlook)
        </Text>
        <Text variant="caption" selectable style={styles.url}>
          {url || '…'}
        </Text>
      </View>
      <Text variant="caption" color={colors.inkMuted}>
        הכתובת פרטית. Google מרענן יומנים מנויים כל כמה שעות; Apple כל שעה.
      </Text>
      <Button
        label="יצירת כתובת חדשה"
        variant="ghost"
        size="sm"
        loading={rotate.isPending}
        onPress={async () => {
          if (await confirm('כתובת חדשה', 'הכתובת הקודמת תפסיק לעבוד, וצריך יהיה להוסיף את היומן מחדש.', 'יצירה')) {
            rotate.mutate({ path: '/api/vendors/me/calendar-token', method: 'POST' }, { onSuccess: () => notify('נוצרה כתובת חדשה') });
          }
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  google: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  urlBox: { borderRadius: radius.md, gap: 4, padding: space.md, backgroundColor: colors.offWhite },
  url: { writingDirection: 'ltr', textAlign: 'left', color: colors.ink },
});
