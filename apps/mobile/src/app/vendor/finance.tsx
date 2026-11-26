import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  addMonths,
  agorotToShekelsInput,
  DOCUMENT_KINDS,
  EXPENSE_CATEGORIES,
  formatAgorot,
  PAYMENT_METHODS,
  shekelsToAgorot,
  todayIso,
  type ClientDocumentDTO,
  type DocumentKind,
  type ExpenseCategory,
  type ExpenseDTO,
  type FinanceDTO,
  type FinancePayment,
  type LeadsDTO,
  type PaymentMethod,
} from '@soon/shared';

import { BarChart } from '@/components/BarChart';
import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { Loading, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup, EmptyState } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { formatDayDots } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { uploadFile, uploadImage } from '@/lib/upload';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

type Tab = 'income' | 'expenses' | 'documents';
type Range = 'month' | 'quarter' | 'year';

function rangeOf(r: Range) {
  const today = todayIso();
  if (r === 'month') return { from: `${today.slice(0, 7)}-01`, to: lastDay(today) };
  if (r === 'quarter') return { from: `${addMonths(today, -2).slice(0, 7)}-01`, to: lastDay(today) };
  return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
}
function lastDay(iso: string) {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

/** Money and paperwork: income, business expenses, and documents issued to clients — kept apart. */
export default function Finance() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'expenses' || params.tab === 'documents' ? params.tab : 'income');
  const [range, setRange] = useState<Range>('year');
  const r = rangeOf(range);

  return (
    <Screen back backTo="/vendor/business" title="כספים ומסמכים" subtitle="הכנסות, הוצאות ומסמכים ללקוחות">
      <Segmented
        options={[
          { key: 'income', label: 'הכנסות' },
          { key: 'expenses', label: 'הוצאות' },
          { key: 'documents', label: 'מסמכים' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab !== 'documents' ? (
        <ChipGroup>
          {(
            [
              ['month', 'החודש'],
              ['quarter', '3 חודשים'],
              ['year', 'השנה'],
            ] as const
          ).map(([k, l]) => (
            <Chip key={k} label={l} selected={range === k} onPress={() => setRange(k)} />
          ))}
        </ChipGroup>
      ) : null}
      {tab === 'income' ? <Income from={r.from} to={r.to} /> : tab === 'expenses' ? <Expenses from={r.from} to={r.to} /> : <Documents />}
    </Screen>
  );
}

// ---------------- income ----------------

function Income({ from, to }: { from: string; to: string }) {
  const { width } = useWindowDimensions();
  const q = useApiQuery<FinanceDTO>(keys.finance(from, to), `/api/vendors/me/finance?from=${from}&to=${to}`);
  if (q.isPending) return <Loading />;
  const f = q.data!;
  const profit = f.collectedAgorot - f.expensesAgorot;

  return (
    <View style={{ gap: space.xl }}>
      <View style={styles.hero}>
        <Text variant="eyebrow" color="rgba(255,255,255,0.6)">
          נגבה בפועל
        </Text>
        <Text style={styles.heroNum}>{formatAgorot(f.collectedAgorot)}</Text>
        <View style={styles.heroRow}>
          <HeroStat label="עוד צפוי להיכנס" value={formatAgorot(f.expectedAgorot)} />
          <HeroStat label="הוצאות" value={formatAgorot(f.expensesAgorot)} />
          <HeroStat label="רווח (נגבה פחות הוצאות)" value={formatAgorot(profit)} />
        </View>
      </View>

      {f.months.length > 1 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="h2">גבייה לפי חודש</Text>
          <BarChart
            values={f.months.map((m) => Math.round(m.collected / 100))}
            labels={f.months.map((m) => MONTHS[Number(m.month.slice(5, 7)) - 1]!)}
            width={Math.min(width, 720) - space.lg * 2}
            height={160}
          />
        </View>
      ) : null}

      <Block title="מקדמות ותשלומים שהתקבלו" empty="אין תשלומים שהתקבלו בתקופה.">
        {f.deposits.map((p) => (
          <PaymentRow key={p.id} p={p} date={p.paidAt ? formatDayDots(p.paidAt.slice(0, 10)) : ''} />
        ))}
      </Block>

      <Block title="תשלומים עתידיים לפי אירוע" empty="אין תשלומים פתוחים.">
        {f.upcoming.map((p) => (
          <PaymentRow key={p.id} p={p} date={p.dueDate ? `לתשלום עד ${formatDayDots(p.dueDate)}` : 'ללא מועד'} open />
        ))}
      </Block>

      <Block title="יתרות לתשלום לפי עסקה" empty="אין יתרות פתוחות.">
        {f.balances.map((b) => (
          <Pressable key={b.leadId} onPress={() => router.push({ pathname: '/vendor/lead/[id]', params: { id: b.leadId } })} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" style={{ fontFamily: fonts.bodyMedium }}>
                {b.clientName}
              </Text>
              <Text variant="caption" color={colors.inkMuted}>
                {`${b.eventDate ? formatDayDots(b.eventDate) : ''} · שולם ${formatAgorot(b.paidAgorot)} מתוך ${formatAgorot(b.totalAgorot)}`}
              </Text>
            </View>
            <Text style={styles.amount}>{formatAgorot(b.totalAgorot - b.paidAgorot)}</Text>
          </Pressable>
        ))}
      </Block>
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" color="rgba(255,255,255,0.6)">
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.inverse }}>{value}</Text>
    </View>
  );
}

function PaymentRow({ p, date, open }: { p: FinancePayment; date: string; open?: boolean }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/vendor/lead/[id]', params: { id: p.leadId } })} style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ fontFamily: fonts.bodyMedium }}>
          {`${p.clientName} · ${p.title}`}
        </Text>
        <Text variant="caption" color={colors.inkMuted}>
          {[date, p.eventDate ? `אירוע ${formatDayDots(p.eventDate)}` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={[styles.amount, open && { color: colors.inkSoft }]}>{formatAgorot(p.amountAgorot)}</Text>
    </Pressable>
  );
}

function Block({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <View>
      <View style={styles.blockHead}>
        <Text variant="h3" style={{ fontFamily: fonts.displayMedium, fontSize: 19 }}>
          {title}
        </Text>
      </View>
      {children.length ? (
        children
      ) : (
        <Text variant="bodySmall" color={colors.inkMuted} style={{ paddingVertical: space.md }}>
          {empty}
        </Text>
      )}
    </View>
  );
}

// ---------------- expenses ----------------

type ExpenseDraft = { id?: string; title: string; amount: string; spentOn: string; category: ExpenseCategory; receiptUrl: string | null; note: string };

function Expenses({ from, to }: { from: string; to: string }) {
  const q = useApiQuery<ExpenseDTO[]>(keys.expenses(from, to), `/api/vendors/me/expenses?from=${from}&to=${to}`);
  const m = useApiMutation({ invalidate: [keys.expensesAll, keys.financeAll] });
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);

  if (q.isPending) return <Loading />;
  const rows = q.data ?? [];
  const total = rows.reduce((a, e) => a + e.amountAgorot, 0);
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ ...c, sum: rows.filter((e) => e.category === c.key).reduce((a, e) => a + e.amountAgorot, 0) })).filter(
    (c) => c.sum > 0,
  );
  const catLabel = (k: string) => EXPENSE_CATEGORIES.find((c) => c.key === k)?.label ?? k;

  async function attach() {
    if (!draft) return;
    const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const url = a.mimeType === 'application/pdf' ? await uploadFile(a.uri, 'vendor-receipt', 'application/pdf') : await uploadImage(a.uri, 'vendor-receipt');
      setDraft((d) => (d ? { ...d, receiptUrl: url } : d));
    } catch (err) {
      notify('ההעלאה נכשלה', errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft) return;
    const amount = shekelsToAgorot(draft.amount);
    if (!draft.title.trim() || !amount) return setError('נא למלא תיאור וסכום');
    setError(undefined);
    const json = { title: draft.title.trim(), amount, spentOn: draft.spentOn, category: draft.category, receiptUrl: draft.receiptUrl, note: draft.note.trim() || null };
    try {
      await m.mutateAsync(draft.id ? { path: `/api/vendors/me/expenses/${draft.id}`, method: 'PATCH', json } : { path: '/api/vendors/me/expenses', json });
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={styles.sumRow}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.inkSoft}>
            סה״כ הוצאות בתקופה
          </Text>
          <Text style={styles.big}>{formatAgorot(total)}</Text>
        </View>
        <Button
          label="הוצאה"
          icon="plus"
          size="sm"
          onPress={() => setDraft({ title: '', amount: '', spentOn: todayIso(), category: 'equipment', receiptUrl: null, note: '' })}
        />
      </View>

      {byCat.length ? (
        <View style={styles.cats}>
          {byCat.map((c) => (
            <View key={c.key} style={styles.catRow}>
              <Text variant="bodySmall" style={{ flex: 1 }}>
                {c.label}
              </Text>
              <View style={[styles.catBar, { width: `${Math.max(4, (c.sum / total) * 45)}%` }]} />
              <Text variant="bodySmall" style={{ width: 86, textAlign: 'left' }}>
                {formatAgorot(c.sum)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Spreadsheet-style table */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 560, flex: 1 }}>
          <View style={[styles.tr, styles.th]}>
            <Text style={[styles.td, styles.cDate, styles.thText]}>תאריך</Text>
            <Text style={[styles.td, styles.cTitle, styles.thText]}>תיאור</Text>
            <Text style={[styles.td, styles.cCat, styles.thText]}>קטגוריה</Text>
            <Text style={[styles.td, styles.cAmount, styles.thText]}>סכום</Text>
            <Text style={[styles.td, styles.cFile, styles.thText]}>קבלה</Text>
          </View>
          {rows.map((e) => (
            <Pressable
              key={e.id}
              onPress={() =>
                setDraft({
                  id: e.id,
                  title: e.title,
                  amount: agorotToShekelsInput(e.amountAgorot),
                  spentOn: e.spentOn,
                  category: e.category,
                  receiptUrl: e.receiptUrl,
                  note: e.note ?? '',
                })
              }
              style={({ pressed }) => [styles.tr, pressed && { backgroundColor: colors.offWhite }]}>
              <Text style={[styles.td, styles.cDate]}>{formatDayDots(e.spentOn)}</Text>
              <Text style={[styles.td, styles.cTitle]} numberOfLines={1}>
                {e.title}
              </Text>
              <Text style={[styles.td, styles.cCat]} numberOfLines={1}>
                {catLabel(e.category)}
              </Text>
              <Text style={[styles.td, styles.cAmount]}>{formatAgorot(e.amountAgorot)}</Text>
              <View style={[styles.cFile, { alignItems: 'center', justifyContent: 'center' }]}>
                {e.receiptUrl ? (
                  <Pressable hitSlop={8} accessibilityLabel="צפייה בקבלה" onPress={() => Linking.openURL(e.receiptUrl!)}>
                    <Feather name="paperclip" size={15} color={colors.ink} />
                  </Pressable>
                ) : (
                  <Text style={{ color: colors.stoneDeep }}>—</Text>
                )}
              </View>
            </Pressable>
          ))}
          <View style={[styles.tr, styles.tfoot]}>
            <Text style={[styles.td, styles.cDate, styles.thText]}>{`${rows.length} שורות`}</Text>
            <Text style={[styles.td, styles.cTitle]} />
            <Text style={[styles.td, styles.cCat]} />
            <Text style={[styles.td, styles.cAmount, styles.thText]}>{formatAgorot(total)}</Text>
            <Text style={[styles.td, styles.cFile]} />
          </View>
        </View>
      </ScrollView>

      <Sheet
        visible={draft != null}
        onClose={() => setDraft(null)}
        eyebrow="הוצאות העסק"
        title={draft?.id ? 'עריכת הוצאה' : 'הוצאה חדשה'}
        footer={
          <>
            {draft?.id ? (
              <Button
                variant="ghost"
                label="מחיקה"
                style={{ flex: 1 }}
                onPress={async () => {
                  if (draft?.id && (await confirm('מחיקת הוצאה', draft.title, 'מחיקה'))) {
                    await m.mutateAsync({ path: `/api/vendors/me/expenses/${draft.id}`, method: 'DELETE' });
                    setDraft(null);
                  }
                }}
              />
            ) : null}
            <Button label="שמירה" style={{ flex: 2 }} loading={m.isPending} onPress={save} />
          </>
        }>
        {draft ? (
          <>
            <TextField label="תיאור" placeholder="למשל: עדשה 85 מ״מ" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <TextField label="סכום (₪)" ltr keyboardType="number-pad" value={draft.amount} onChangeText={(amount) => setDraft({ ...draft, amount })} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="תאריך" value={draft.spentOn} onChange={(d) => setDraft({ ...draft, spentOn: d ?? todayIso() })} />
              </View>
            </View>
            <ChipGroup>
              {EXPENSE_CATEGORIES.map((c) => (
                <Chip key={c.key} label={c.label} selected={draft.category === c.key} onPress={() => setDraft({ ...draft, category: c.key })} />
              ))}
            </ChipGroup>
            <View style={styles.attach}>
              <Feather name="paperclip" size={16} color={colors.ink} />
              <Text variant="bodySmall" style={{ flex: 1 }}>
                {draft.receiptUrl ? 'קבלה / חשבונית מצורפת' : 'צירוף קבלה או חשבונית (תמונה / PDF)'}
              </Text>
              {draft.receiptUrl ? (
                <Button label="צפייה" size="sm" variant="ghost" onPress={() => Linking.openURL(draft.receiptUrl!)} />
              ) : null}
              <Button label={draft.receiptUrl ? 'החלפה' : 'צירוף'} size="sm" variant="outline" loading={uploading} onPress={attach} />
            </View>
            <TextField label="הערה" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} error={error} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

// ---------------- documents (issued to clients) ----------------

type DocDraft = {
  kind: DocumentKind;
  leadId: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  description: string;
  amount: string;
  issuedOn: string;
  paymentMethod: PaymentMethod | null;
};

function Documents() {
  const q = useApiQuery<ClientDocumentDTO[]>(keys.documents, '/api/vendors/me/documents');
  const leads = useApiQuery<LeadsDTO>(keys.leads, '/api/leads');
  const m = useApiMutation<ClientDocumentDTO>({ invalidate: [keys.documents] });
  const [draft, setDraft] = useState<DocDraft | null>(null);
  const [error, setError] = useState<string>();

  if (q.isPending) return <Loading />;
  const docs = q.data ?? [];
  const clients = (leads.data?.items ?? []).filter((l) => ['booked', 'completed', 'proposal', 'meeting'].includes(l.status));
  const kindLabel = (k: DocumentKind) => DOCUMENT_KINDS.find((d) => d.key === k)!.label;

  async function issue() {
    if (!draft) return;
    const amount = shekelsToAgorot(draft.amount);
    if (!draft.clientName.trim() || !draft.description.trim() || !amount) return setError('נא למלא לקוח, תיאור וסכום');
    setError(undefined);
    try {
      const doc = await m.mutateAsync({
        path: '/api/vendors/me/documents',
        json: {
          kind: draft.kind,
          leadId: draft.leadId,
          clientName: draft.clientName.trim(),
          clientPhone: draft.clientPhone.trim() || null,
          clientEmail: draft.clientEmail.trim() || null,
          description: draft.description.trim(),
          amount,
          issuedOn: draft.issuedOn,
          paymentMethod: draft.kind === 'receipt' ? draft.paymentMethod : null,
        },
      });
      setDraft(null);
      router.push({ pathname: '/vendor/document/[id]', params: { id: doc.id } } as unknown as Href);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={styles.notice}>
        <Feather name="info" size={14} color={colors.ink} />
        <Text variant="caption" color={colors.inkSoft} style={{ flex: 1 }}>
          מסמכים שהעסק מפיק ללקוחות: קבלות, הצעות מחיר ודרישות תשלום. מספור רץ לכל סוג. חשבוניות מס עם מספר הקצאה של רשות המסים
          יופקו דרך חיבור לספק חשבוניות מורשה (בשלב הבא).
        </Text>
      </View>
      <Button
        label="מסמך חדש"
        icon="file-plus"
        onPress={() =>
          setDraft({ kind: 'receipt', leadId: null, clientName: '', clientPhone: '', clientEmail: '', description: '', amount: '', issuedOn: todayIso(), paymentMethod: 'transfer' })
        }
      />
      {docs.length ? (
        <View>
          {docs.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => router.push({ pathname: '/vendor/document/[id]', params: { id: d.id } } as unknown as Href)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.offWhite }]}>
              <View style={styles.docBadge}>
                <Text variant="caption" style={{ fontFamily: fonts.bodyMedium }}>
                  {kindLabel(d.kind)}
                </Text>
                <Text variant="caption" color={colors.inkMuted}>{`#${String(d.number).padStart(4, '0')}`}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" style={{ fontFamily: fonts.bodyMedium }} numberOfLines={1}>
                  {d.clientName}
                </Text>
                <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                  {`${formatDayDots(d.issuedOn)} · ${d.description}`}
                </Text>
              </View>
              <Text style={styles.amount}>{formatAgorot(d.amountAgorot)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState icon="file-text" title="עוד לא הופקו מסמכים" body="קבלה, הצעת מחיר או דרישת תשלום — משויכים ללקוח ולעסקה." />
      )}

      <Sheet
        visible={draft != null}
        onClose={() => setDraft(null)}
        eyebrow="מסמך ללקוח"
        title="הפקת מסמך"
        footer={<Button label="הפקה" icon="check" style={{ flex: 1 }} loading={m.isPending} onPress={issue} />}>
        {draft ? (
          <>
            <ChipGroup>
              {DOCUMENT_KINDS.map((k) => (
                <Chip key={k.key} label={k.label} selected={draft.kind === k.key} onPress={() => setDraft({ ...draft, kind: k.key })} />
              ))}
            </ChipGroup>
            {clients.length ? (
              <View style={{ gap: space.sm }}>
                <Text variant="caption" color={colors.inkSoft}>
                  שיוך ללקוח ולעסקה
                </Text>
                <ChipGroup>
                  {clients.map((l) => (
                    <Chip
                      key={l.id}
                      label={l.clientName}
                      selected={draft.leadId === l.id}
                      onPress={() =>
                        setDraft({
                          ...draft,
                          leadId: draft.leadId === l.id ? null : l.id,
                          clientName: draft.leadId === l.id ? draft.clientName : l.clientName,
                          description: draft.description || (l.eventDate ? `צילום אירוע ${formatDayDots(l.eventDate)}` : ''),
                        })
                      }
                    />
                  ))}
                </ChipGroup>
              </View>
            ) : null}
            <TextField label="שם הלקוח" value={draft.clientName} onChangeText={(clientName) => setDraft({ ...draft, clientName })} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <TextField label="טלפון" ltr keyboardType="phone-pad" value={draft.clientPhone} onChangeText={(clientPhone) => setDraft({ ...draft, clientPhone })} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="אימייל" ltr autoCapitalize="none" keyboardType="email-address" value={draft.clientEmail} onChangeText={(clientEmail) => setDraft({ ...draft, clientEmail })} />
              </View>
            </View>
            <TextField label="תיאור" placeholder="למשל: מקדמה לצילום חתונה" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <TextField label="סכום (₪)" ltr keyboardType="number-pad" value={draft.amount} onChangeText={(amount) => setDraft({ ...draft, amount })} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="תאריך" value={draft.issuedOn} onChange={(d) => setDraft({ ...draft, issuedOn: d ?? todayIso() })} />
              </View>
            </View>
            {draft.kind === 'receipt' ? (
              <ChipGroup>
                {PAYMENT_METHODS.map((p) => (
                  <Chip key={p.key} label={p.label} selected={draft.paymentMethod === p.key} onPress={() => setDraft({ ...draft, paymentMethod: p.key })} />
                ))}
              </ChipGroup>
            ) : null}
            {error ? (
              <Text variant="caption" color={colors.danger}>
                {error}
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, ...shadow.md, backgroundColor: colors.night, padding: space.lg, gap: space.sm },
  heroNum: { fontFamily: fonts.display, fontSize: 38, lineHeight: 46, color: colors.inverse },
  heroRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  blockHead: { paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  amount: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  sumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  big: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, color: colors.ink },
  cats: { borderRadius: radius.md, gap: 8, padding: space.md, backgroundColor: colors.offWhite },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  catBar: { borderRadius: 3, height: 6, backgroundColor: colors.accent },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, minHeight: 44, alignItems: 'center' },
  th: { borderBottomColor: colors.goldLight, backgroundColor: colors.offWhite },
  tfoot: { borderTopWidth: 1, borderTopColor: colors.ink, borderBottomWidth: 0 },
  thText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  td: { paddingHorizontal: 8, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  cDate: { width: 92 },
  cTitle: { flex: 1, minWidth: 160 },
  cCat: { width: 110 },
  cAmount: { width: 100 },
  cFile: { width: 56 },
  attach: { borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, backgroundColor: colors.offWhite },
  notice: { borderRadius: radius.md, flexDirection: 'row', gap: space.sm, padding: space.md, backgroundColor: colors.offWhite },
  docBadge: { width: 84, gap: 2 },
});
