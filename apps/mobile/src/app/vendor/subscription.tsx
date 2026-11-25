import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { PLANS, type VendorAccountDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { confirm, notify } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

/** App subscription: current plan, what each plan includes, and changing plan. */
export default function Subscription() {
  const q = useApiQuery<VendorAccountDTO>(keys.account, '/api/vendors/me/account');
  const m = useApiMutation<VendorAccountDTO>({ setData: keys.account });
  if (q.isPending) return <Loading />;
  const acc = q.data!;
  const current = PLANS.find((p) => p.key === acc.plan)!;
  const rank = (k: string) => PLANS.findIndex((p) => p.key === k);

  async function change(key: (typeof PLANS)[number]['key']) {
    const target = PLANS.find((p) => p.key === key)!;
    const up = rank(key) > rank(acc.plan);
    if (!(await confirm(up ? 'שדרוג מסלול' : 'שינוי מסלול', `לעבור למסלול ${target.name}${target.priceMonthly ? ` (₪${target.priceMonthly} לחודש)` : ''}?`, 'אישור'))) return;
    m.mutate({ path: '/api/vendors/me/plan', method: 'PUT', json: { plan: key } }, { onSuccess: () => notify('המסלול עודכן', `המסלול שלכם עכשיו ${target.name}.`) });
  }

  return (
    <Screen back backTo="/vendor/business" title="מנוי האפליקציה">
      <View style={styles.current}>
        <Text variant="eyebrow" color="rgba(255,255,255,0.6)">
          המסלול שלכם
        </Text>
        <Text style={styles.currentName}>{current.name}</Text>
        <Text variant="bodySmall" color="rgba(255,255,255,0.8)">
          {current.priceMonthly ? `₪${current.priceMonthly} לחודש` : 'ללא עלות'}
          {acc.planSince ? ` · מאז ${formatDate(acc.planSince)}` : ''}
        </Text>
      </View>

      {PLANS.map((p) => {
        const on = p.key === acc.plan;
        return (
          <View key={p.key} style={[styles.plan, on && styles.planOn]}>
            <View style={styles.planHead}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text variant="bodySmall" color={colors.inkSoft}>
                  {p.tagline}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.price}>{p.priceMonthly ? `₪${p.priceMonthly}` : 'חינם'}</Text>
                {p.priceMonthly ? (
                  <Text variant="caption" color={colors.inkMuted}>
                    לחודש
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {p.features.map((f) => (
                <View key={f} style={styles.feature}>
                  <Feather name="check" size={14} color={colors.ink} />
                  <Text variant="bodySmall" style={{ flex: 1 }}>
                    {f}
                  </Text>
                </View>
              ))}
            </View>
            {on ? (
              <Text variant="label" align="center" style={{ paddingVertical: 10 }}>
                המסלול הנוכחי
              </Text>
            ) : (
              <Button
                label={rank(p.key) > rank(acc.plan) ? `שדרוג ל־${p.name}` : `מעבר ל־${p.name}`}
                variant={rank(p.key) > rank(acc.plan) ? 'primary' : 'outline'}
                loading={m.isPending}
                onPress={() => change(p.key)}
              />
            )}
          </View>
        );
      })}
      <Text variant="caption" color={colors.inkMuted}>
        גבייה אוטומטית של המנוי תחובר בשלב הבא. כרגע שינוי מסלול נכנס לתוקף מיד.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  current: { borderRadius: radius.lg, ...shadow.md, backgroundColor: colors.night, padding: space.lg, gap: 4 },
  currentName: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, color: colors.inverse },
  plan: { borderRadius: radius.lg, gap: space.md, padding: space.lg, borderWidth: 1, borderColor: colors.line },
  planOn: { borderColor: colors.ink, borderWidth: 2 },
  planHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  planName: { fontFamily: fonts.displayMedium, fontSize: 24, color: colors.ink },
  price: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
