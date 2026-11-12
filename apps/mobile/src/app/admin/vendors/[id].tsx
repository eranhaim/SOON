import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { getVendorReadiness, type AdminVendorDetail, type VendorOwnerDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { VendorPage } from '@/components/VendorPage';
import { Card, Divider, ReadinessList, SectionTitle, StatusBadge } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatDate, formatDateTime } from '@/lib/dates';
import { colors, space } from '@/theme/tokens';

const ACTION_LABELS: Record<string, string> = {
  'vendor.approve': 'אושר',
  'vendor.reject': 'נדחה',
  'vendor.suspend': 'הושעה',
  'vendor.reinstate': 'הושב לפעילות',
};

/** Review one vendor: storefront as couples see it, owner details, and moderation actions. */
export default function AdminVendorReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminVendorDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<'reject' | 'suspend' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setDetail(await api<AdminVendorDetail>(`/api/admin/vendors/${id}`));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    api<AdminVendorDetail>(`/api/admin/vendors/${id}`)
      .then((d) => alive && (setDetail(d), setFailed(false)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id]);

  async function act(action: 'approve' | 'reject' | 'suspend' | 'reinstate') {
    setError(undefined);
    if (action === 'approve' || action === 'reinstate') {
      const ok = await confirm(
        action === 'approve' ? 'אישור ספק' : 'החזרה לפעילות',
        'הפרופיל יוצג לזוגות בחיפוש. להמשיך?',
        'אישור',
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api<VendorOwnerDTO>(`/api/admin/vendors/${id}/${action}`, {
        method: 'POST',
        json: action === 'reject' || action === 'suspend' ? { reason } : {},
      });
      setMode(null);
      setReason('');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'הפעולה נכשלה'));
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <Screen title="לא הצלחנו לטעון" back backTo="/admin">
        <Button label="נסו שוב" onPress={load} />
      </Screen>
    );
  }
  if (!detail) return <Loading />;
  const { vendor, owner, history } = detail;

  return (
    <Screen title={vendor.businessName} subtitle={vendor.categoryLabel} back backTo="/admin" maxWidth={960}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
        {/* Decision panel */}
        <View style={{ flexGrow: 1, flexBasis: 320, gap: space.lg }}>
          <Card tone="muted">
            <StatusBadge status={vendor.status} />
            {vendor.submittedAt ? (
              <Text variant="caption" color={colors.inkSoft}>
                {`נשלח לאישור ${formatDateTime(vendor.submittedAt)}`}
              </Text>
            ) : null}
            {vendor.statusReason ? (
              <Text variant="bodySmall" color={colors.inkSoft}>
                {`סיבה: ${vendor.statusReason}`}
              </Text>
            ) : null}

            {mode ? (
              <>
                <TextField
                  label={mode === 'reject' ? 'סיבת הדחייה (תוצג לספק)' : 'סיבת ההשעיה (תוצג לספק)'}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  style={{ minHeight: 90, textAlignVertical: 'top' }}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button variant="ghost" label="ביטול" onPress={() => setMode(null)} style={{ flex: 1 }} />
                  <Button
                    label={mode === 'reject' ? 'דחייה' : 'השעיה'}
                    loading={busy}
                    disabled={reason.trim().length < 5}
                    onPress={() => act(mode)}
                    style={{ flex: 2 }}
                  />
                </View>
              </>
            ) : (
              <View style={{ gap: space.sm }}>
                {vendor.status === 'pending' || vendor.status === 'rejected' ? (
                  <Button label="אישור ופרסום" loading={busy} onPress={() => act('approve')} />
                ) : null}
                {vendor.status === 'pending' ? (
                  <Button variant="outline" label="דחייה עם הערה" onPress={() => setMode('reject')} />
                ) : null}
                {vendor.status === 'approved' ? (
                  <Button variant="outline" label="השעיה" onPress={() => setMode('suspend')} />
                ) : null}
                {vendor.status === 'suspended' ? (
                  <Button label="החזרה לפעילות" loading={busy} onPress={() => act('reinstate')} />
                ) : null}
                {vendor.status === 'draft' ? (
                  <Text variant="bodySmall" color={colors.inkSoft}>
                    הספק עדיין לא שלח את הפרופיל לאישור.
                  </Text>
                ) : null}
              </View>
            )}
            {error ? (
              <Text variant="bodySmall" color={colors.danger}>
                {error}
              </Text>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>בעל העסק</SectionTitle>
            <Info label="שם" value={owner.name || '—'} />
            <Info label="אימייל" value={owner.email} ltr />
            <Info label="טלפון" value={vendor.phone ?? '—'} ltr />
            <Info label="נרשם" value={formatDate(owner.createdAt)} />
          </Card>

          <Card>
            <SectionTitle>שלמות הפרופיל</SectionTitle>
            <ReadinessList items={getVendorReadiness(vendor)} />
          </Card>

          {history.length ? (
            <Card>
              <SectionTitle>היסטוריה</SectionTitle>
              {history.map((h, i) => (
                <View key={h.id} style={{ gap: 2 }}>
                  {i > 0 ? <Divider /> : null}
                  <Text variant="bodySmall">{`${ACTION_LABELS[h.action] ?? h.action} · ${formatDateTime(h.createdAt)}`}</Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {h.adminEmail ?? ''}
                  </Text>
                  {h.reason ? (
                    <Text variant="caption" color={colors.inkSoft}>
                      {h.reason}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}
        </View>

        {/* Storefront exactly as couples will see it */}
        <View style={{ flexGrow: 2, flexBasis: 420, borderWidth: 1, borderColor: colors.line, paddingBottom: space.lg }}>
          <VendorPage vendor={vendor} width={560} />
        </View>
      </View>
    </Screen>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <Text variant="bodySmall" color={colors.inkMuted} style={{ width: 64 }}>
        {label}
      </Text>
      <Text variant="bodySmall" style={{ flex: 1, writingDirection: ltr ? 'ltr' : 'rtl' }}>
        {value}
      </Text>
    </View>
  );
}
