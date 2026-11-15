import { AppTabs, type TabDef } from '@/components/TabBar';

/** Couple navigation (spec §2): Home · Search · Saved · Planning · Profile. */
const TABS: TabDef[] = [
  { name: 'index', title: 'בית', icon: 'home' },
  { name: 'explore', title: 'חיפוש', icon: 'search' },
  { name: 'saved', title: 'שמורים', icon: 'heart' },
  { name: 'planning', title: 'תכנון', icon: 'grid' },
  { name: 'profile', title: 'פרופיל', icon: 'user' },
];

export default function CoupleTabs() {
  return <AppTabs tabs={TABS} />;
}
