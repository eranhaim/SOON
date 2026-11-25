import { useLocalSearchParams } from 'expo-router';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';

import { DOCUMENT_KINDS, formatAgorot, PAYMENT_METHODS, type ClientDocumentDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { formatDayDots } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

/** One issued document, laid out for print / PDF, with share, email and WhatsApp. */
export default function DocumentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApiQuery<ClientDocumentDTO>(['documents', id], `/api/vendors/me/documents/${id}`);
  if (q.isPending || !q.data) return <Loading />;
  const d = q.data;
  const kind = DOCUMENT_KINDS.find((k) => k.key === d.kind)!.label;
  const number = String(d.number).padStart(4, '0');
  const method = PAYMENT_METHODS.find((p) => p.key === d.paymentMethod)?.label;
  const summary = [
    `${kind} מס׳ ${number} · ${d.issuer.businessName}`,
    `תאריך: ${formatDayDots(d.issuedOn)}`,
    `לכבוד: ${d.clientName}`,
    `${d.description}: ${formatAgorot(d.amountAgorot)}`,
    method ? `אמצעי תשלום: ${method}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Screen back backTo="/vendor/finance" title={`${kind} ${number}`} subtitle={d.clientName}>
      <View style={styles.paper}>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.biz}>{d.issuer.businessName}</Text>
            {d.issuer.taxId ? <Text variant="caption" color={colors.inkSoft}>{`עוסק / ח.פ ${d.issuer.taxId}`}</Text> : null}
            {d.issuer.address ? <Text variant="caption" color={colors.inkSoft}>{d.issuer.address}</Text> : null}
            {[d.issuer.phone, d.issuer.email].filter(Boolean).length ? (
              <Text variant="caption" color={colors.inkSoft}>
                {[d.issuer.phone, d.issuer.email].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={styles.kind}>{kind}</Text>
            <Text variant="caption" color={colors.inkSoft}>{`מס׳ ${number}`}</Text>
            <Text variant="caption" color={colors.inkSoft}>
              {formatDayDots(d.issuedOn)}
            </Text>
          </View>
        </View>

        <View style={styles.rule} />
        <Text variant="eyebrow" color={colors.inkMuted}>
          לכבוד
        </Text>
        <Text variant="body" style={{ fontFamily: fonts.bodyMedium }}>
          {d.clientName}
        </Text>
        {[d.clientPhone, d.clientEmail].filter(Boolean).length ? (
          <Text variant="caption" color={colors.inkSoft}>
            {[d.clientPhone, d.clientEmail].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <Text style={[styles.td, { flex: 1 }, styles.thText]}>תיאור</Text>
            <Text style={[styles.td, styles.thText, { width: 110 }]}>סכום</Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.td, { flex: 1 }]}>{d.description}</Text>
            <Text style={[styles.td, { width: 110 }]}>{formatAgorot(d.amountAgorot)}</Text>
          </View>
          <View style={[styles.tr, styles.total]}>
            <Text style={[styles.td, { flex: 1 }, styles.thText]}>סה״כ</Text>
            <Text style={[styles.td, { width: 110, fontFamily: fonts.displayMedium, fontSize: 18 }]}>{formatAgorot(d.amountAgorot)}</Text>
          </View>
        </View>
        {method ? <Text variant="bodySmall">{`אמצעי תשלום: ${method}`}</Text> : null}

        <View style={styles.foot}>
          <Logo variant="symbol" size={20} />
          <Text variant="caption" color={colors.inkMuted} style={{ flex: 1 }}>
            הופק באמצעות SOON. המסמך שמור במערכת ומשויך ללקוח ולעסקה.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="שיתוף" icon="share-2" style={{ flex: 1 }} onPress={() => Share.share({ message: summary }).catch(() => undefined)} />
        {Platform.OS === 'web' ? (
          <Button label="הדפסה / PDF" icon="printer" variant="outline" style={{ flex: 1 }} onPress={() => window.print()} />
        ) : null}
      </View>
      <View style={styles.actions}>
        {d.clientEmail ? (
          <Button
            label="שליחה במייל"
            icon="mail"
            variant="soft"
            style={{ flex: 1 }}
            onPress={() => Linking.openURL(`mailto:${d.clientEmail}?subject=${encodeURIComponent(`${kind} ${number}`)}&body=${encodeURIComponent(summary)}`)}
          />
        ) : null}
        {d.clientPhone ? (
          <Button
            label="WhatsApp"
            icon="message-circle"
            variant="soft"
            style={{ flex: 1 }}
            onPress={() => Linking.openURL(`https://wa.me/972${d.clientPhone!.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(summary)}`)}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: radius.md, ...shadow.sm, backgroundColor: colors.surface, borderWidth: 0, padding: space.lg, gap: space.sm },
  head: { flexDirection: 'row', gap: space.md },
  biz: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.ink },
  kind: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  rule: { height: 1, backgroundColor: colors.ink, marginVertical: space.sm },
  table: { marginTop: space.md },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 },
  th: { borderBottomColor: colors.ink },
  total: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.ink },
  td: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingHorizontal: 4 },
  thText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  actions: { flexDirection: 'row', gap: space.sm },
});
