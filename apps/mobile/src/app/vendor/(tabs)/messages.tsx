import { Screen } from '@/components/Screen';
import { ComingSoon } from '@/components/ui';

export default function VendorMessages() {
  return (
    <Screen title="הודעות">
      <ComingSoon icon="message-circle" title="הודעות מזוגות" body="צ׳אט עם זוגות, עם פרטי האירוע לצד השיחה." />
    </Screen>
  );
}
