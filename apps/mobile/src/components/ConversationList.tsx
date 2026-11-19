import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LEAD_STATUS_LABELS, type ConversationListItem } from '@soon/shared';

import { formatDateTime } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

import { PressableScale, Reveal } from './motion';
import { Text } from './Text';
import { EmptyState } from './ui';

/** Inbox for either side: couples see vendors, vendors see couples. Polls for new messages. */
export function ConversationList({ side }: { side: 'couple' | 'vendor' }) {
  const q = useApiQuery<ConversationListItem[]>(keys.conversations, '/api/conversations', { refetchInterval: 8000 });

  if (q.isPending) return <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />;
  const items = q.data ?? [];
  if (!items.length) {
    return (
      <EmptyState
        icon="message-circle"
        title="אין עדיין שיחות"
        body={side === 'couple' ? 'פנו לספק מעמוד העסק שלו, והשיחה תופיע כאן.' : 'כשזוג יפנה אליכם, השיחה תופיע כאן.'}
      />
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {items.map((c, i) => {
        const title = side === 'couple' ? c.vendor.businessName : c.couple.names;
        const sub = side === 'couple' ? c.vendor.categoryLabel : c.leadStatus ? LEAD_STATUS_LABELS[c.leadStatus] : 'פנייה';
        return (
          <Reveal key={c.id} index={i}>
            <PressableScale
              scaleTo={0.98}
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: c.id } })}
              style={styles.row}>
              <View style={styles.avatar}>
                {side === 'couple' && c.vendor.logoUrl ? (
                  <Image source={c.vendor.logoUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Text color={colors.accent} style={styles.initial}>
                    {title.trim().charAt(0)}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.topLine}>
                  <Text variant="h3" numberOfLines={1} style={{ flex: 1 }}>
                    {title}
                  </Text>
                  {c.lastMessage ? (
                    <Text variant="caption" color={colors.inkMuted}>
                      {formatDateTime(c.lastMessage.at)}
                    </Text>
                  ) : null}
                </View>
                <Text variant="eyebrow" color={colors.gold} style={{ letterSpacing: 1 }}>
                  {sub}
                </Text>
                <View style={styles.topLine}>
                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    color={c.unread ? colors.ink : colors.inkSoft}
                    style={[{ flex: 1 }, c.unread ? { fontFamily: fonts.bodyMedium } : null]}>
                    {c.lastMessage ? `${c.lastMessage.mine ? 'אתם: ' : ''}${c.lastMessage.body ?? 'קובץ מצורף'}` : 'שיחה חדשה'}
                  </Text>
                  {c.unread ? (
                    <View style={styles.badge}>
                      <Text variant="caption" color={colors.inverse} style={{ fontFamily: fonts.bodyBold, fontSize: 11 }}>
                        {c.unread}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </PressableScale>
          </Reveal>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontFamily: fonts.display, fontSize: 22 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 0,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
