import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  agorotToShekelsInput,
  BUDGET_CATEGORIES,
  budgetCategoryLabel,
  formatAgorot,
  shekelsToAgorot,
  todayIso,
  type BudgetDTO,
  type BudgetItemDTO,
  type WeddingPaymentDTO,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { Loading, Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { PressableScale, Reveal } from '@/components/motion';
import { ProgressBar } from '@/components/Progress';
import { Segmented } from '@/components/Segmented';
import { Chip, ChipGroup, IconButton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatDayShort } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, hairline, radius, shadow, space } from '@/theme/tokens';

type ItemDraft = { id?: string; category: string; title: string; vendorName: string; planned: string; actual: string; notes: string };
type PayDraft = { id?: string; budgetItemId: string | null; title: string; amount: string; dueDate: string | null; paid: boolean };

/** Budget (spec §7.2): Budget / Actual / Paid / Remaining per category, payments with due dates. */
export default function Budget() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'budget' | 'payments'>(params.tab === 'payments' ? 'payments' : 'budget');
  const q = useApiQuery<BudgetDTO>(keys.budget, '/api/planning/budget');
  const m = useApiMutation<BudgetDTO>({ setData: keys.budget, invalidate: [keys.home] });
  const [item, setItem] = useState<ItemDraft | null>(null);
  const [pay, setPay] = useState<PayDraft | null>(null);
  const [error, setError] = useState<string>();
  const [totalDraft, setTotalDraft] = useState<string | null>(null);
  const saveTotal = useApiMutation({ invalidate: [keys.budget, keys.home, keys.wedding] });

  if (q.isPending) return <Loading />;
  const b = q.data!;
  const total = b.totalAgorot;
  const over = total != null && b.committedAgorot > total;
  const today = todayIso();

  async function run(input: Parameters<typeof m.mutateAsync>[0], close: () => void) {
    setError(undefined);
    try {
      await m.mutateAsync(input);
      close();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function splitBySuggestion() {
    if (!total) return;
    for (const c of BUDGET_CATEGORIES) {
      if (b.items.some((i) => i.category === c.key)) continue;
      await m.mutateAsync({
        path: '/api/planning/budget/items',
        json: { category: c.key, title: c.label, planned: Math.round((total * c.suggestedPct) / 100) },
      });
    }
  }

  const editItem = (i?: BudgetItemDTO) =>
    setItem(
      i
        ? {
            id: i.id,
            category: i.category,
            title: i.title,
            vendorName: i.vendorId ? '' : (i.vendorName ?? ''),
            planned: agorotToShekelsInput(i.plannedAgorot),
            actual: agorotToShekelsInput(i.actualAgorot),
            notes: i.notes ?? '',
          }
        : { category: 'other', title: '', vendorName: '', planned: '', actual: '', notes: '' },
    );
  const editPay = (p?: WeddingPaymentDTO) =>
    setPay(
      p
        ? { id: p.id, budgetItemId: p.budgetItemId, title: p.title, amount: agorotToShekelsInput(p.amountAgorot), dueDate: p.dueDate, paid: Boolean(p.paidAt) }
        : { budgetItemId: null, title: '', amount: '', dueDate: null, paid: false },
    );

  return (
    <Screen
      title="תקציב"
      back
      backTo="/couple/planning"
      right={<IconButton icon="plus" label="הוספה" onPress={() => (tab === 'budget' ? editItem() : editPay())} />}>
      <Reveal style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="עריכת התקציב הכולל"
          onPress={() => setTotalDraft(agorotToShekelsInput(total))}
          style={styles.totalRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="eyebrow" color={colors.goldLight}>
              תקציב כולל
            </Text>
            <Text color={colors.inverse} style={styles.heroNum}>
              {total != null ? formatAgorot(total) : '—'}
            </Text>
          </View>
          <View style={styles.totalEdit}>
            <Feather name="edit-2" size={14} color={colors.inverse} />
            <Text variant="caption" color={colors.inverse}>
              עריכה
            </Text>
          </View>
        </Pressable>
        {total ? (
          <ProgressBar value={b.committedAgorot / total} color={over ? colors.inverse : colors.goldLight} track="rgba(255,255,255,0.18)" height={5} />
        ) : null}
        <View style={styles.sumRow}>
          <Sum label="הוצאנו" value={formatAgorot(b.committedAgorot)} danger={over} />
          <Sum label="שולם" value={formatAgorot(b.paidAgorot)} />
          <Sum label={over ? 'חריגה' : 'נותר בתקציב'} value={total != null ? formatAgorot(Math.abs(total - b.committedAgorot)) : '—'} danger={over} />
          <Sum label="נותר לתשלום" value={formatAgorot(b.committedAgorot - b.paidAgorot)} />
        </View>
        {!total ? (
          <Text variant="caption" color="rgba(255,255,255,0.7)">
            הגדירו תקציב כולל (לחצו על ״עריכה״) כדי לראות יתרות וחריגות.
          </Text>
        ) : null}
      </Reveal>

      <Segmented
        options={[
          { key: 'budget', label: 'לפי קטגוריה' },
          { key: 'payments', label: `תשלומים · ${b.payments.filter((p) => !p.paidAt).length}` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'budget' ? (
        <View>
          {b.items.length === 0 ? (
            <View style={{ gap: space.md }}>
              <Text color={colors.inkSoft}>עוד אין שורות תקציב.</Text>
              {total ? <Button variant="outline" label="חלוקה מומלצת לפי קטגוריות" loading={m.isPending} onPress={splitBySuggestion} /> : null}
            </View>
          ) : null}
          {b.items.map((i, n) => {
            const spent = i.actualAgorot ?? 0;
            const planned = i.plannedAgorot ?? 0;
            const itemOver = planned > 0 && spent > planned;
            const left = Math.max(0, spent - i.paidAgorot);
            return (
              <Reveal key={i.id} index={n}>
                <PressableScale scaleTo={0.98} onPress={() => editItem(i)} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="h3">{i.title}</Text>
                      <Text variant="caption" color={colors.inkMuted}>
                        {[budgetCategoryLabel(i.category), i.vendorName].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={[styles.itemNum, itemOver && { color: colors.danger }]}>{formatAgorot(spent)}</Text>
                  </View>
                  <ProgressBar value={planned ? spent / planned : spent ? 1 : 0} color={itemOver ? colors.danger : colors.accent} />
                  <Text variant="caption" color={colors.inkSoft}>
                    {`תקציב ${formatAgorot(planned)} · שולם ${formatAgorot(i.paidAgorot)} · נותר ${formatAgorot(left)}`}
                  </Text>
                </PressableScale>
              </Reveal>
            );
          })}
        </View>
      ) : (
        <View style={styles.listCard}>
          {b.payments.length === 0 ? <Text color={colors.inkSoft}>הוסיפו תשלומים עם תאריך יעד כדי לקבל תזכורת.</Text> : null}
          {b.payments.map((p) => {
            const late = !p.paidAt && p.dueDate != null && p.dueDate < today;
            return (
              <View key={p.id} style={styles.row}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: Boolean(p.paidAt) }}
                  accessibilityLabel={`${p.title} שולם`}
                  onPress={() => m.mutate({ path: `/api/planning/budget/payments/${p.id}`, method: 'PATCH', json: { paid: !p.paidAt } })}
                  style={[styles.check, p.paidAt && styles.checkOn]}>
                  {p.paidAt ? <Feather name="check" size={14} color={colors.inverse} /> : null}
                </Pressable>
                <Pressable style={{ flex: 1, gap: 2 }} onPress={() => editPay(p)}>
                  <Text variant="body">{p.title}</Text>
                  <Text variant="caption" color={late ? colors.danger : colors.inkMuted}>
                    {p.paidAt ? 'שולם' : p.dueDate ? `${late ? 'באיחור · ' : ''}${formatDayShort(p.dueDate)}` : 'ללא תאריך'}
                  </Text>
                </Pressable>
                <Text variant="body">{formatAgorot(p.amountAgorot)}</Text>
              </View>
            );
          })}
          <Text variant="caption" color={colors.inkMuted} style={{ marginTop: space.md }}>
            תשלום מסומן כ״שולם״ רק כשאתם מאשרים זאת.
          </Text>
        </View>
      )}

      <Sheet
        visible={totalDraft != null}
        onClose={() => setTotalDraft(null)}
        eyebrow="תקציב"
        title="תקציב כולל לחתונה"
        footer={
          <Button
            label="שמירה"
            loading={saveTotal.isPending}
            style={{ flex: 1 }}
            onPress={() =>
              saveTotal.mutate(
                { path: '/api/weddings/me', method: 'PATCH', json: { budgetTotal: shekelsToAgorot(totalDraft ?? '') } },
                { onSuccess: () => setTotalDraft(null), onError: (e) => setError(errorMessage(e)) },
              )
            }
          />
        }>
        <TextField
          label="סכום (₪)"
          ltr
          keyboardType="number-pad"
          value={totalDraft ?? ''}
          onChangeText={setTotalDraft}
        />
        <Text variant="caption" color={colors.inkMuted}>
          השאירו ריק כדי להסיר את התקציב הכולל.
        </Text>
        {error ? <Text variant="bodySmall" color={colors.danger}>{error}</Text> : null}
      </Sheet>

      <Sheet
        visible={item != null}
        onClose={() => setItem(null)}
        title={item?.id ? 'עריכת שורת תקציב' : 'שורת תקציב חדשה'}
        footer={
          <>
            {item?.id ? (
              <Button
                variant="ghost"
                label="מחיקה"
                style={{ flex: 1 }}
                onPress={async () => {
                  if (await confirm('מחיקה', item.title, 'מחיקה')) await run({ path: `/api/planning/budget/items/${item.id}`, method: 'DELETE' }, () => setItem(null));
                }}
              />
            ) : null}
            <Button
              label="שמירה"
              loading={m.isPending}
              style={{ flex: 2 }}
              onPress={() => {
                if (!item?.title.trim()) return setError('נא לכתוב שם');
                const json = {
                  category: item.category,
                  title: item.title,
                  vendorName: item.vendorName.trim() || null,
                  planned: shekelsToAgorot(item.planned),
                  actual: shekelsToAgorot(item.actual),
                  notes: item.notes.trim() || null,
                };
                void run(
                  item.id ? { path: `/api/planning/budget/items/${item.id}`, method: 'PATCH', json } : { path: '/api/planning/budget/items', json },
                  () => setItem(null),
                );
              }}
            />
          </>
        }>
        {item ? (
          <>
            <ChipGroup>
              {BUDGET_CATEGORIES.map((c) => {
                const taken = c.key !== 'other' ? b.items.find((i) => i.category === c.key && i.id !== item.id) : undefined;
                return (
                  <Chip
                    key={c.key}
                    label={taken ? `${c.label} ✓` : c.label}
                    selected={item.category === c.key}
                    onPress={() => {
                      // One line per category (except "other"): jump to the existing line.
                      if (taken) return editItem(taken);
                      setItem({ ...item, category: c.key, title: item.title || c.label });
                    }}
                  />
                );
              })}
            </ChipGroup>
            <Text variant="caption" color={colors.inkMuted}>
              לכל קטגוריה יש שורה אחת. קטגוריה עם ✓ כבר קיימת – לחיצה עליה פותחת אותה לעריכה.
            </Text>
            <TextField label="שם" value={item.title} onChangeText={(title) => setItem({ ...item, title })} />
            <TextField label="ספק (אם לא מ־SOON)" value={item.vendorName} onChangeText={(vendorName) => setItem({ ...item, vendorName })} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <TextField label="תכנון (₪)" ltr keyboardType="number-pad" value={item.planned} onChangeText={(planned) => setItem({ ...item, planned })} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="בפועל / סוכם (₪)" ltr keyboardType="number-pad" value={item.actual} onChangeText={(actual) => setItem({ ...item, actual })} />
              </View>
            </View>
            <TextField label="הערות" value={item.notes} onChangeText={(notes) => setItem({ ...item, notes })} multiline />
            {error ? <Text variant="bodySmall" color={colors.danger}>{error}</Text> : null}
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={pay != null}
        onClose={() => setPay(null)}
        title={pay?.id ? 'עריכת תשלום' : 'תשלום חדש'}
        footer={
          <>
            {pay?.id ? (
              <Button
                variant="ghost"
                label="מחיקה"
                style={{ flex: 1 }}
                onPress={async () => {
                  if (await confirm('מחיקה', pay.title, 'מחיקה')) await run({ path: `/api/planning/budget/payments/${pay.id}`, method: 'DELETE' }, () => setPay(null));
                }}
              />
            ) : null}
            <Button
              label="שמירה"
              loading={m.isPending}
              style={{ flex: 2 }}
              onPress={() => {
                const amount = shekelsToAgorot(pay?.amount ?? '');
                if (!pay?.title.trim() || amount == null) return setError('נא למלא שם וסכום');
                const json = { budgetItemId: pay.budgetItemId, title: pay.title, amount, dueDate: pay.dueDate, paid: pay.paid };
                void run(
                  pay.id ? { path: `/api/planning/budget/payments/${pay.id}`, method: 'PATCH', json } : { path: '/api/planning/budget/payments', json },
                  () => setPay(null),
                );
              }}
            />
          </>
        }>
        {pay ? (
          <>
            <TextField label="על מה?" value={pay.title} onChangeText={(title) => setPay({ ...pay, title })} />
            <TextField label="סכום (₪)" ltr keyboardType="number-pad" value={pay.amount} onChangeText={(amount) => setPay({ ...pay, amount })} />
            <DateField label="תאריך יעד" value={pay.dueDate} onChange={(dueDate) => setPay({ ...pay, dueDate })} clearable />
            {b.items.length ? (
              <View style={{ gap: space.sm }}>
                <Text variant="caption" color={colors.inkSoft}>שורת תקציב</Text>
                <ChipGroup>
                  {b.items.map((i) => (
                    <Chip key={i.id} label={i.title} selected={pay.budgetItemId === i.id} onPress={() => setPay({ ...pay, budgetItemId: pay.budgetItemId === i.id ? null : i.id })} />
                  ))}
                </ChipGroup>
              </View>
            ) : null}
            <Chip label="כבר שולם" selected={pay.paid} onPress={() => setPay({ ...pay, paid: !pay.paid })} />
            {error ? <Text variant="bodySmall" color={colors.danger}>{error}</Text> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function Sum({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', gap: 2 }}>
      <Text variant="caption" color="rgba(255,255,255,0.65)">
        {label}
      </Text>
      <Text color={danger ? colors.inverse : colors.inverse} style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 28 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  totalEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  hero: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.night,
        ...shadow.md,
  } as object,
  heroNum: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, marginTop: -6 },
  sumRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  itemCard: { gap: 10, padding: space.md, marginBottom: space.sm, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.sm },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  itemNum: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.ink },
  listCard: { paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: hairline, borderBottomColor: colors.line },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.stoneDeep, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
});
