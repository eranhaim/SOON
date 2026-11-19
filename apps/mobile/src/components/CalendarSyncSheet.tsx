import { Linking, StyleSheet, View } from 'react-native';

import type { VendorAccountDTO } from '@soon/shared';

import { confirm, notify } from '@/lib/confirm';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme/tokens';

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
  const url = q.data?.calendarFeedUrl ?? '';
  const webcal = url.replace(/^https?:\/\//, 'webcal://');

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="יומן" title="סנכרון ליומן שלכם">
      <Text variant="bodySmall" color={colors.inkSoft}>
        האירועים, הפגישות והימים החסומים מ־SOON יופיעו ביומן שבטלפון ויתעדכנו לבד. כל אירוע מופיע פעם אחת ומתעדכן במקום — בלי כפילויות.
      </Text>
      <Button label="הוספה ל־Google Calendar" icon="calendar" disabled={!url} onPress={() => Linking.openURL(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`)} />
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
        הכתובת פרטית. Google מרענן יומנים מנויים כל כמה שעות; Apple כל שעה. סנכרון דו־כיווני (אירועים מ־Google אל SOON) יתווסף בהמשך.
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
  urlBox: { gap: 4, padding: space.md, backgroundColor: colors.offWhite },
  url: { writingDirection: 'ltr', textAlign: 'left', color: colors.ink },
});
