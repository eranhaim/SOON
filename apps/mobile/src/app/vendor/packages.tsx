import { useState } from 'react';
import { View } from 'react-native';

import {
  agorotToShekelsInput,
  formatAgorot,
  shekelsToAgorot,
  vendorPackageInputSchema,
  type VendorPackageDTO,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, IconButton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, space } from '@/theme/tokens';

type Draft = { id?: string; name: string; price: string; description: string; includes: string };
const EMPTY: Draft = { name: '', price: '', description: '', includes: '' };

/** Packages with price and what's included (spec §5). */
export default function Packages() {
  const { vendor, mutate } = useOwnVendor();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function edit(p?: VendorPackageDTO) {
    setError(undefined);
    setDraft(
      p
        ? {
            id: p.id,
            name: p.name,
            price: agorotToShekelsInput(p.priceAgorot),
            description: p.description ?? '',
            includes: p.includes.join('\n'),
          }
        : EMPTY,
    );
  }

  async function save() {
    if (!draft) return;
    const payload = {
      name: draft.name,
      priceAgorot: shekelsToAgorot(draft.price),
      description: draft.description.trim() || null,
      includes: draft.includes
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    };
    const parsed = vendorPackageInputSchema.safeParse(payload);
    if (!parsed.success) return setError('נא למלא שם לחבילה');
    setBusy(true);
    try {
      await mutate(draft.id ? `/api/vendors/me/packages/${draft.id}` : '/api/vendors/me/packages', {
        method: draft.id ? 'PUT' : 'POST',
        json: parsed.data,
      });
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: VendorPackageDTO) {
    if (!(await confirm('מחיקת חבילה', `למחוק את "${p.name}"?`, 'מחיקה'))) return;
    try {
      await mutate(`/api/vendors/me/packages/${p.id}`, { method: 'DELETE' });
    } catch (err) {
      notify('המחיקה נכשלה', errorMessage(err));
    }
  }

  return (
    <Screen title="חבילות ומחירים" back backTo="/vendor/business">
      {draft ? (
        <Card tone="muted">
          <Text variant="h2">{draft.id ? 'עריכת חבילה' : 'חבילה חדשה'}</Text>
          <TextField label="שם החבילה" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} autoFocus />
          <TextField
            label="מחיר (₪)"
            ltr
            keyboardType="number-pad"
            value={draft.price}
            onChangeText={(price) => setDraft({ ...draft, price })}
          />
          <TextField
            label="תיאור קצר"
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
            value={draft.description}
            onChangeText={(description) => setDraft({ ...draft, description })}
          />
          <TextField
            label="מה כלול (שורה לכל פריט)"
            multiline
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            value={draft.includes}
            onChangeText={(includes) => setDraft({ ...draft, includes })}
          />
          {error ? (
            <Text variant="bodySmall" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button variant="ghost" label="ביטול" onPress={() => setDraft(null)} style={{ flex: 1 }} />
            <Button label="שמירה" loading={busy} onPress={save} style={{ flex: 2 }} />
          </View>
        </Card>
      ) : (
        <Button variant="outline" label="+ הוספת חבילה" onPress={() => edit()} />
      )}

      {vendor.packages.length === 0 && !draft ? (
        <Text variant="bodySmall" color={colors.inkSoft}>
          חבילות עוזרות לזוגות להבין מה מקבלים ובכמה. למשל: ״חבילת יום מלא״, ״חבילת חופה וקבלת פנים״.
        </Text>
      ) : null}

      {vendor.packages.map((p) => (
        <Card key={p.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h2">{p.name}</Text>
              {p.priceAgorot != null ? <Text variant="body">{formatAgorot(p.priceAgorot)}</Text> : null}
            </View>
            <IconButton icon="edit-2" label="עריכה" onPress={() => edit(p)} />
            <IconButton icon="trash-2" label="מחיקה" onPress={() => remove(p)} />
          </View>
          {p.description ? (
            <Text variant="bodySmall" color={colors.inkSoft}>
              {p.description}
            </Text>
          ) : null}
          {p.includes.length ? (
            <Text variant="bodySmall" color={colors.inkSoft}>
              {p.includes.map((l) => `• ${l}`).join('\n')}
            </Text>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
