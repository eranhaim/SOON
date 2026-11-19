import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatAgorot, LEAD_STATUS_LABELS, type LeadsDTO, type VendorDashboardDTO } from '@soon/shared';

import { PressableScale, Reveal, useCountUp } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Sparkline } from '@/components/Sparkline';
import { Text } from '@/components/Text';
import { VendorStatusCard } from '@/components/VendorStatusCard';
import { SectionTitle, type IconName } from '@/components/ui';
import { formatDateTime, formatDayDots, formatToday, greeting } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

/** Vendor dashboard (spec §9): revenue, pipeline, calendar and profile performance at a glance. */
export default function VendorDashboard() {
  const { vendor, reload, loading } = useOwnVendor();
  const d = useApiQuery<VendorDashboardDTO>(keys.dashboard, '/api/vendors/me/dashboard');
  const leads = useApiQuery<LeadsDTO>(keys.leads, '/api/leads');
  const s = d.data;
  const revenue = useCountUp(Math.round((s?.bookedRevenueAgorot ?? 0) / 100));
  const newLeads = (leads.data?.items ?? []).filter((l) => l.status === 'new').slice(0, 4);
  const approved = vendor.status === 'approved';

  return (
    <Screen
      refreshing={loading || d.isRefetching}
      onRefresh={() => {
        void reload();
        void d.refetch();
        void leads.refetch();
      }}>
      <Reveal style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color={colors.inkMuted}>
            {formatToday()}
          </Text>
          <Text variant="h1">{`${greeting()},`}</Text>
          <Text variant="h1" color={colors.accent} style={{ marginTop: -6 }}>
            {vendor.businessName}
          </Text>
        </View>
        <View style={styles.sidePill}>
          <Text variant="eyebrow" color={colors.gold} style={{ letterSpacing: 1 }}>
            צד הספק
          </Text>
        </View>
      </Reveal>

      {!approved ? <VendorStatusCard vendor={vendor} /> : null}

      {/* Revenue hero */}
      <Reveal index={1} style={styles.revenue}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="eyebrow" color={colors.goldLight}>
            הכנסות שנסגרו השנה
          </Text>
          <Text color={colors.inverse} style={styles.revenueNum}>
            {`₪${revenue.toLocaleString('he-IL')}`}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.7)">
            {`נגבו ${formatAgorot(s?.collectedAgorot ?? 0)}`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Sparkline values={smooth((s?.viewsSeries ?? []).map((p) => p.views))} width={120} height={52} />
          <Text variant="caption" color="rgba(255,255,255,0.6)" style={{ fontSize: 10 }}>
            צפיות · 30 יום
          </Text>
        </View>
      </Reveal>

      {/* Stat grid */}
      <Reveal index={2} style={styles.grid}>
        <Stat icon="inbox" value={s?.newLeads} label="פניות חדשות" onPress={() => router.push('/vendor/leads')} highlight />
        <Stat icon="message-circle" value={s?.unreadMessages} label="הודעות חדשות" onPress={() => router.push('/vendor/messages')} />
        <Stat icon="users" value={s?.activeClients} label="לקוחות פעילים" onPress={() => router.push('/vendor/leads')} />
        <Stat icon="calendar" value={s?.upcomingEvents} label="אירועים קרובים" onPress={() => router.push('/vendor/calendar')} />
        <Stat icon="check-square" value={s?.followUps.length} label="משימות פתוחות" onPress={() => router.push('/vendor/leads')} />
        <Stat icon="lock" value={s?.bookedDates} label="תאריכים תפוסים" onPress={() => router.push('/vendor/calendar')} />
      </Reveal>

      <Reveal index={3} style={styles.perf}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color={colors.inkSoft}>
            צפיות בפרופיל · 30 יום
          </Text>
          <Text style={styles.perfNum}>{(s?.views30 ?? 0).toLocaleString('he-IL')}</Text>
        </View>
        <View style={styles.perfRule} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color={colors.inkSoft}>
            שמירות על ידי זוגות
          </Text>
          <Text style={styles.perfNum}>{(s?.saves ?? 0).toLocaleString('he-IL')}</Text>
        </View>
        <View style={styles.perfRule} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color={colors.inkSoft}>
            דירוג
          </Text>
          <Text style={styles.perfNum}>{s?.reviewAvg != null ? `${s.reviewAvg}★` : '—'}</Text>
        </View>
      </Reveal>

      <SectionTitle
        eyebrow="לטיפול"
        action={
          <PressableScale onPress={() => router.push('/vendor/leads')} style={{ paddingVertical: 4 }}>
            <Text variant="caption" color={colors.accent} style={{ fontFamily: fonts.bodyMedium }}>
              כל הלידים
            </Text>
          </PressableScale>
        }>
        פניות חדשות
      </SectionTitle>
      <View style={{ gap: space.sm }}>
        {newLeads.length ? (
          newLeads.map((l, i) => (
            <Reveal key={l.id} index={i}>
              <PressableScale
                scaleTo={0.98}
                onPress={() => router.push({ pathname: '/vendor/lead/[id]', params: { id: l.id } })}
                style={styles.lead}>
                <View style={styles.leadDot} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h3">{l.clientName}</Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {[l.eventDate ? formatDayDots(l.eventDate) : null, l.guestCount ? `${l.guestCount} מוזמנים` : null, l.location]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {l.quotedPriceAgorot ? (
                  <Text variant="label" color={colors.accent}>
                    {formatAgorot(l.quotedPriceAgorot)}
                  </Text>
                ) : null}
              </PressableScale>
            </Reveal>
          ))
        ) : (
          <Text variant="bodySmall" color={colors.inkMuted}>
            אין פניות חדשות כרגע.
          </Text>
        )}
      </View>

      {s?.upcoming.length ? (
        <>
          <SectionTitle eyebrow="ביומן">אירועים קרובים</SectionTitle>
          <View style={{ gap: space.sm }}>
            {s.upcoming.slice(0, 4).map((e) => (
              <View key={e.id} style={styles.event}>
                <View style={styles.eventDate}>
                  <Text color={colors.accent} style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 24 }}>
                    {new Date(e.startsAt).getDate()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h3" numberOfLines={1}>
                    {e.clientName ?? e.title ?? 'אירוע'}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                    {[formatDateTime(e.startsAt), e.location, e.leadStatus ? LEAD_STATUS_LABELS[e.leadStatus] : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/** 5-day moving average, so day-to-day noise doesn't hide the trend. */
function smooth(values: number[]) {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - 4), i + 1);
    return win.reduce((a, v) => a + v, 0) / win.length;
  });
}

function Stat({
  icon,
  value,
  label,
  onPress,
  highlight,
}: {
  icon: IconName;
  value: number | undefined;
  label: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  const n = useCountUp(value ?? 0, 800);
  return (
    <PressableScale scaleTo={0.96} onPress={onPress} style={styles.stat}>
      <View style={styles.statTop}>
        <Feather name={icon} size={15} color={highlight && value ? colors.accent : colors.gold} />
        {highlight && value ? <View style={styles.newDot} /> : null}
      </View>
      <Text style={styles.statNum}>{n}</Text>
      <Text variant="caption" color={colors.inkSoft} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space.md },
  sidePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.goldSoft },
  revenue: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.night,
        ...shadow.md,
  } as object,
  revenueNum: { fontFamily: fonts.display, fontSize: 36, lineHeight: 44 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: {
    flexBasis: '31%',
    flexGrow: 1,
    padding: space.md,
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  statNum: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.ink },
  perf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.offWhite,
  },
  perfRule: { width: 1, alignSelf: 'stretch', backgroundColor: colors.stone },
  perfNum: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  leadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  event: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  eventDate: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
