import { AppTabs, type TabDef } from '@/components/TabBar';

/**
 * Vendor navigation (spec §2): Dashboard · Calendar · Clients · Messages · Business.
 * Loading / onboarding redirects are handled once in ../_layout.tsx (VendorGate).
 */
const TABS: TabDef[] = [
  { name: 'index', title: 'דשבורד', icon: 'home' },
  { name: 'calendar', title: 'יומן', icon: 'calendar' },
  { name: 'leads', title: 'לקוחות', icon: 'users' },
  { name: 'messages', title: 'הודעות', icon: 'message-circle' },
  { name: 'business', title: 'העסק', icon: 'briefcase' },
];

export default function VendorTabs() {
  return <AppTabs tabs={TABS} />;
}
