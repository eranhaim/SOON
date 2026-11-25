import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AdminUserDTO } from '@soon/shared';

import { AdminNav } from '@/components/AdminNav';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { useSessionUser } from '@/lib/session';
import { pickImages, uploadImage } from '@/lib/upload';
import { colors, fonts, hairline, space } from '@/theme/tokens';

type Role = 'couple' | 'vendor' | 'admin';
const ROLE_LABEL: Record<Role, string> = { couple: 'זוג', vendor: 'ספק', admin: 'מנהל/ת' };
const FILTERS: { key: Role | 'all'; label: string }[] = [
  { key: 'all', label: 'כולם' },
  { key: 'couple', label: 'זוגות' },
  { key: 'vendor', label: 'ספקים' },
  { key: 'admin', label: 'מנהלים' },
];

/** All users: search, filter by role (admins tab), create accounts with a password, manage them. */
export default function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useSessionUser();
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const [q, setQ] = useState('');
  const key = ['admin-users', filter, q.trim()];
  const list = useApiQuery<AdminUserDTO[]>(key, `/api/admin/users?${new URLSearchParams({ ...(filter !== 'all' ? { role: filter } : {}), ...(q.trim() ? { q: q.trim() } : {}) })}`);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<AdminUserDTO | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-users'] });

  return (
    <Screen title="משתמשים" subtitle="כל החשבונות במערכת" maxWidth={960}>
      <AdminNav />
      <View style={styles.tools}>
        <View style={{ flex: 1 }}>
          <TextField label="חיפוש" value={q} onChangeText={setQ} placeholder="שם או אימייל" />
        </View>
        <Button label={filter === 'admin' ? 'מנהל/ת חדש/ה' : 'משתמש חדש'} icon="user-plus" onPress={() => setCreating(true)} />
      </View>
      <ChipGroup>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ChipGroup>

      <View>
        {list.data?.map((u) => (
          <View key={u.id} style={styles.row}>
            <Avatar u={u} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" style={{ fontFamily: fonts.bodyMedium }}>
                {u.name}
                {u.bannedAt ? '  · חסום/ה' : ''}
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                {[u.email, u.context].filter(Boolean).join(' · ')}
              </Text>
              <Text variant="caption" color={colors.inkMuted}>
                {`${u.role ? ROLE_LABEL[u.role] : 'ללא תפקיד'} · נרשם/ה ${formatDate(u.createdAt)}`}
              </Text>
            </View>
            <Button size="sm" variant="ghost" label="ניהול" onPress={() => setSelected(u)} />
          </View>
        ))}
        {list.data && !list.data.length ? <Text color={colors.inkSoft}>לא נמצאו משתמשים.</Text> : null}
      </View>

      <CreateUserSheet visible={creating} defaultRole={filter === 'all' ? 'couple' : filter} onClose={() => setCreating(false)} onDone={refresh} />
      <ManageUserSheet user={selected} isMe={selected?.id === me?.id} onClose={() => setSelected(null)} onDone={refresh} />
    </Screen>
  );
}

function Avatar({ u, size = 44 }: { u: { name: string; image: string | null }; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {u.image ? (
        <Image source={u.image} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text color={colors.accent} style={{ fontFamily: fonts.display, fontSize: size * 0.42 }}>
          {u.name.charAt(0)}
        </Text>
      )}
    </View>
  );
}

function CreateUserSheet({ visible, defaultRole, onClose, onDone }: { visible: boolean; defaultRole: Role; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(defaultRole);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [seen, setSeen] = useState(defaultRole);
  if (seen !== defaultRole) {
    setSeen(defaultRole);
    setRole(defaultRole);
  }

  async function pickAvatar() {
    const [uri] = await pickImages();
    if (!uri) return;
    try {
      setImage(await uploadImage(uri, 'admin-template'));
    } catch (err) {
      notify('ההעלאה נכשלה', errorMessage(err));
    }
  }

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await api('/api/admin/users', { method: 'POST', json: { name: name.trim(), email: email.trim(), password, role, image } });
      notify('החשבון נוצר', `${email.trim()} יכול/ה להיכנס עם הסיסמה שקבעתם.`);
      setName('');
      setEmail('');
      setPassword('');
      setImage(null);
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="ניהול"
      title="חשבון חדש"
      footer={<Button label="יצירה" loading={busy} disabled={name.trim().length < 2 || !email.includes('@') || password.length < 8} onPress={save} style={{ flex: 1 }} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar u={{ name: name || '?', image }} size={56} />
        <Button size="sm" variant="outline" icon="image" label="תמונת פרופיל" onPress={pickAvatar} />
      </View>
      <ChipGroup>
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <Chip key={r} label={ROLE_LABEL[r]} selected={role === r} onPress={() => setRole(r)} />
        ))}
      </ChipGroup>
      <TextField label="שם" value={name} onChangeText={setName} />
      <TextField label="אימייל" ltr autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextField label="סיסמה (לפחות 8 תווים)" ltr secureTextEntry value={password} onChangeText={setPassword} />
      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

function ManageUserSheet({ user: u, isMe, onClose, onDone }: { user: AdminUserDTO | null; isMe: boolean; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    try {
      await fn();
      notify(done);
      onDone();
      onClose();
    } catch (err) {
      notify('הפעולה נכשלה', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet visible={u != null} onClose={onClose} eyebrow={u?.email} title={u?.name ?? ''}>
      {u ? (
        <>
          <Text variant="caption" color={colors.inkSoft}>
            תפקיד
          </Text>
          <ChipGroup>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <Chip
                key={r}
                label={ROLE_LABEL[r]}
                selected={u.role === r}
                onPress={() => {
                  if (u.role === r || (isMe && r !== 'admin')) return;
                  void run('role', () => api(`/api/admin/users/${u.id}/role`, { method: 'PUT', json: { role: r } }), 'התפקיד עודכן');
                }}
              />
            ))}
          </ChipGroup>
          <TextField label="סיסמה חדשה" ltr secureTextEntry value={password} onChangeText={setPassword} />
          <Button
            variant="outline"
            label="קביעת סיסמה"
            loading={busy === 'pw'}
            disabled={password.length < 8}
            onPress={() => run('pw', () => api(`/api/admin/users/${u.id}/password`, { method: 'PUT', json: { password } }), 'הסיסמה עודכנה')}
          />
          {!isMe ? (
            <Button
              variant="ghost"
              label={u.bannedAt ? 'ביטול חסימה' : 'חסימת המשתמש'}
              loading={busy === 'ban'}
              onPress={async () => {
                if (!u.bannedAt && !(await confirm('חסימה', `לחסום את ${u.name}? הוא/היא יתנתקו מיד.`, 'חסימה'))) return;
                await run('ban', () => api(`/api/admin/users/${u.id}/ban`, { method: 'PUT', json: { banned: !u.bannedAt } }), u.bannedAt ? 'החסימה בוטלה' : 'המשתמש נחסם');
              }}
            />
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tools: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: hairline, borderBottomColor: colors.line },
  avatar: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

