import { router } from 'expo-router';
import { View } from 'react-native';

import { formatAgorot, type CoupleHomeDTO } from '@soon/shared';

import { Screen } from '@/components/Screen';
import { ListRow, SectionTitle } from '@/components/ui';
import { keys, useApiQuery } from '@/lib/query';

/** Planning hub (spec §2: Checklist, Budget, Guests, Calendar, Alcohol, Vendors, Payments). */
export default function Planning() {
  const home = useApiQuery<CoupleHomeDTO>(keys.home, '/api/couple/home').data;
  const t = home?.tasks;
  const b = home?.budget;

  return (
    <Screen title="תכנון החתונה">
      <View>
        <SectionTitle>הכנות</SectionTitle>
        <ListRow
          icon="check-square"
          label="משימות"
          hint={t ? `${t.done} בוצעו · ${t.open} פתוחות${t.overdue ? ` · ${t.overdue} באיחור` : ''}` : undefined}
          onPress={() => router.push('/couple/planning/checklist')}
        />
        <ListRow icon="calendar" label="יומן החתונה" hint="פגישות, טעימות, מדידות ותשלומים" onPress={() => router.push('/couple/planning/calendar')} />
        <ListRow
          icon="users"
          label="הספקים שלנו"
          hint={home ? `${home.vendors.booked} סגורים · ${home.vendors.needed} עוד חסרים` : undefined}
          onPress={() => router.push('/couple/planning/vendors')}
        />
      </View>
      <View>
        <SectionTitle>כסף</SectionTitle>
        <ListRow
          icon="pie-chart"
          label="תקציב"
          hint={b?.totalAgorot ? `${formatAgorot(b.committedAgorot)} מתוך ${formatAgorot(b.totalAgorot)}` : 'הגדירו תקציב וחלוקה'}
          onPress={() => router.push('/couple/planning/budget')}
        />
        <ListRow icon="credit-card" label="תשלומים" hint={b ? `שולם ${formatAgorot(b.paidAgorot)}` : undefined} onPress={() => router.push({ pathname: '/couple/planning/budget', params: { tab: 'payments' } })} />
      </View>
      <View>
        <SectionTitle>אורחים</SectionTitle>
        <ListRow icon="user-check" label="רשימת מוזמנים" hint="אישורי הגעה, צדדים ושולחנות" onPress={() => router.push('/couple/planning/guests')} />
        <ListRow icon="droplet" label="מחשבון אלכוהול" hint="הערכת כמויות לפי מספר האורחים" onPress={() => router.push('/couple/planning/alcohol')} />
      </View>
    </Screen>
  );
}
