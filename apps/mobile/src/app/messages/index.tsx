import { router, type Href } from 'expo-router';

import { ConversationList } from '@/components/ConversationList';
import { CountBadge } from '@/components/CountBadge';
import { Screen } from '@/components/Screen';
import { Card, ListRow } from '@/components/ui';
import { keys, useApiQuery } from '@/lib/query';
import { useSessionUser } from '@/lib/session';
import { space } from '@/theme/tokens';

/** Inbox (opened from the home hero and the profile). Couples also reach their chats with other couples. */
export default function Messages() {
  const { role } = useSessionUser();
  const isCouple = role !== 'vendor';
  const unread = useApiQuery<{ messages: number; coupleChats?: number }>(keys.unread, '/api/unread', { refetchInterval: 20_000 });
  return (
    <Screen back backTo="/couple" title="הודעות" subtitle={isCouple ? 'שיחות עם ספקים ועם זוגות' : 'שיחות עם זוגות'}>
      {isCouple ? (
        <Card style={{ paddingVertical: space.xs, gap: 0 }}>
          <ListRow
            icon="users"
            label="שיחות עם זוגות"
            hint="קהילת הזוגות של SOON"
            trailing={<CountBadge count={unread.data?.coupleChats ?? 0} />}
            onPress={() => router.push('/couple/community' as Href)}
          />
        </Card>
      ) : null}
      <ConversationList side={isCouple ? 'couple' : 'vendor'} />
    </Screen>
  );
}
