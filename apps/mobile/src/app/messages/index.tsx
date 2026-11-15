import { ConversationList } from '@/components/ConversationList';
import { Screen } from '@/components/Screen';
import { useSessionUser } from '@/lib/session';

/** Couple inbox (opened from the home hero and the profile). */
export default function Messages() {
  const { role } = useSessionUser();
  return (
    <Screen back backTo="/couple" title="הודעות" subtitle="שיחות עם ספקים">
      <ConversationList side={role === 'vendor' ? 'vendor' : 'couple'} />
    </Screen>
  );
}
