import { ConversationList } from '@/components/ConversationList';
import { Screen } from '@/components/Screen';

export default function VendorMessages() {
  return (
    <Screen eyebrow="תיבת הודעות" title="הודעות" subtitle="שיחות עם זוגות שפנו אליכם">
      <ConversationList side="vendor" />
    </Screen>
  );
}
