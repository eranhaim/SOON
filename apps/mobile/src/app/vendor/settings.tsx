import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NOTIFICATION_KINDS, type NotificationKind, type VendorAccountDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { LangSwitch } from '@/components/LangSwitch';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { notify } from '@/lib/confirm';
import { signOutToStart } from '@/lib/demo';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { useSessionUser } from '@/lib/session';
import { colors, fonts, space } from '@/theme/tokens';

/** Vendor settings: notifications, CRM automation, invoice details, account, language. */
export default function Settings() {
  const q = useApiQuery<VendorAccountDTO>(keys.account, '/api/vendors/me/account');
  const m = useApiMutation<VendorAccountDTO>({ setData: keys.account });
  const { user } = useSessionUser();
  const [invoice, setInvoice] = useState<{ taxId: string; address: string } | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwBusy, setPwBusy] = useState(false);

  if (q.isPending) return <Loading />;
  const acc = q.data!;
  const inv = invoice ?? { taxId: acc.taxId ?? '', address: acc.businessAddress ?? '' };
  const patch = (json: object) => m.mutate({ path: '/api/vendors/me/settings', method: 'PATCH', json });

  async function changePassword() {
    if (pw.next.length < 6) return notify('הסיסמה קצרה מדי', 'לפחות 6 תווים.');
    setPwBusy(true);
    const { error } = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next });
    setPwBusy(false);
    if (error) return notify('לא הצלחנו לשנות סיסמה', error.message ?? 'בדקו את הסיסמה הנוכחית.');
    setPw({ current: '', next: '' });
    notify('הסיסמה עודכנה');
  }

  return (
    <Screen back backTo="/vendor/business" title="הגדרות">
      <Section title="התראות">
        {NOTIFICATION_KINDS.map((n) => (
          <Toggle
            key={n.key}
            label={n.label}
            value={acc.settings.notifications[n.key as NotificationKind]}
            onChange={(v) => patch({ notifications: { [n.key]: v } })}
          />
        ))}
      </Section>

      <Section title="לקוחות">
        <Toggle
          label="הוספה אוטומטית של כל פנייה חדשה ללקוחות"
          hint="כשכבוי, אפשר להוסיף לקוח בלחיצה מתוך השיחה."
          value={acc.settings.autoLeadFromInquiry}
          onChange={(v) => patch({ autoLeadFromInquiry: v })}
        />
      </Section>

      <Section title="פרטים למסמכים">
        <TextField label="עוסק מורשה / ח.פ" ltr keyboardType="number-pad" value={inv.taxId} onChangeText={(taxId) => setInvoice({ ...inv, taxId })} />
        <TextField label="כתובת העסק" value={inv.address} onChangeText={(address) => setInvoice({ ...inv, address })} />
        {invoice ? (
          <Button
            label="שמירת הפרטים"
            loading={m.isPending}
            onPress={() =>
              m.mutate(
                { path: '/api/vendors/me/settings', method: 'PATCH', json: { taxId: inv.taxId.trim() || null, businessAddress: inv.address.trim() || null } },
                { onSuccess: () => setInvoice(null), onError: (e) => notify('השמירה נכשלה', errorMessage(e)) },
              )
            }
          />
        ) : null}
      </Section>

      <Section title="חשבון">
        <Row label="אימייל" value={user?.email ?? ''} />
        <TextField label="סיסמה נוכחית" ltr secureTextEntry value={pw.current} onChangeText={(current) => setPw({ ...pw, current })} />
        <TextField label="סיסמה חדשה" ltr secureTextEntry value={pw.next} onChangeText={(next) => setPw({ ...pw, next })} />
        <Button label="שינוי סיסמה" variant="outline" loading={pwBusy} disabled={!pw.current || !pw.next} onPress={changePassword} />
      </Section>

      <Section title="שפה והעדפות">
        <View style={styles.toggle}>
          <Text variant="body" style={{ flex: 1 }}>
            שפת האפליקציה
          </Text>
          <LangSwitch />
        </View>
      </Section>

      <Button label="התנתקות" variant="ghost" icon="log-out" onPress={signOutToStart} />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <Text variant="eyebrow" color={colors.inkMuted} style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" color={colors.inkMuted}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        hitSlop={8}
        onPress={() => onChange(!value)}
        style={[styles.track, value && styles.trackOn, { alignItems: value ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </Pressable>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.toggle}>
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodySmall" color={colors.inkSoft} style={{ fontFamily: fonts.body }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.ink },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  track: { borderRadius: 13, width: 46, height: 26, padding: 3, borderWidth: 1, borderColor: colors.stoneDeep, backgroundColor: colors.surface, justifyContent: 'center' },
  trackOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  thumb: { borderRadius: 9, width: 18, height: 18, backgroundColor: colors.stoneDeep },
  thumbOn: { backgroundColor: colors.inverse },
});
