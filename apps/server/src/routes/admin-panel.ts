/**
 * Admin panel: users (list, create with a password, role, password reset, block), admins,
 * couples' progress, invitation templates and platform settings (gift fee).
 * Vendor approvals live in admin.ts.
 */
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  adminCreateUserSchema,
  adminPasswordSchema,
  adminRoleSchema,
  appSettingsSchema,
  templateInputSchema,
  type AdminCoupleDTO,
  type AdminUserDTO,
  type AppSettingsDTO,
} from '@soon/shared';
import { z } from 'zod';

import { auth } from '../auth';
import { db } from '../db';
import { appSetting, invitationTemplate, session as sessionTable, user } from '../db/schema';
import { badRequest, conflict, isUuid, notFound } from '../http';
import { parseBody, requireAdmin } from '../session';
import { checkUpayLogin, payments } from '../services/payments';
import { giftFeeBps, toTemplateDTO } from './wedding-site';

export async function adminPanelRoutes(app: FastifyInstance) {
  // ===== users =====
  app.get<{ Querystring: { q?: string; role?: string } }>('/api/admin/users', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const q = (request.query.q ?? '').trim().slice(0, 80);
    const role = ['couple', 'vendor', 'admin'].includes(request.query.role ?? '') ? request.query.role! : null;
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await db.execute<{
      id: string;
      name: string;
      email: string;
      role: AdminUserDTO['role'];
      image: string | null;
      created_at: string;
      banned_at: string | null;
      context: string | null;
    }>(sql`
      select u.id, u.name, u.email, u.role, u.image, u.created_at, u.banned_at,
        coalesce(
          (select v.business_name from vendor v where v.owner_user_id = u.id limit 1),
          (select w.partner1_name || ' ו' || w.partner2_name from wedding_member m join wedding w on w.id = m.wedding_id
            where m.user_id = u.id limit 1)
        ) as context
      from "user" u
      where true
        ${q ? sql`and (u.name ilike ${like} or u.email ilike ${like})` : sql``}
        ${role ? sql`and u.role = ${role}` : sql``}
      order by u.created_at desc
      limit 300`);
    return rows.rows.map(
      (r): AdminUserDTO => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        image: r.image,
        createdAt: new Date(r.created_at).toISOString(),
        bannedAt: r.banned_at ? new Date(r.banned_at).toISOString() : null,
        context: r.context,
      }),
    );
  });

  /** Create an account with a password (couple, vendor or another admin). */
  app.post('/api/admin/users', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const b = await parseBody(adminCreateUserSchema, request.body, reply);
    if (!b) return;
    const email = b.email.toLowerCase();
    const [exists] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (exists) return conflict(reply, 'כבר יש משתמש עם האימייל הזה');
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(b.password);
    const created = await ctx.internalAdapter.createUser(
      { email, name: b.name, emailVerified: true, image: b.image ?? null },
      { method: 'admin' },
    );
    await ctx.internalAdapter.linkAccount({ userId: created.id, providerId: 'credential', accountId: created.id, password: hash });
    await db.update(user).set({ role: b.role }).where(eq(user.id, created.id));
    return reply.status(201).send({ id: created.id });
  });

  app.put<{ Params: { id: string } }>('/api/admin/users/:id/role', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const b = await parseBody(adminRoleSchema, request.body, reply);
    if (!b) return;
    if (request.params.id === admin.id && b.role !== 'admin') return badRequest(reply, 'אי אפשר להוריד לעצמכם את הרשאת הניהול');
    const [row] = await db.update(user).set({ role: b.role }).where(eq(user.id, request.params.id)).returning({ id: user.id });
    if (!row) return notFound(reply);
    return { ok: true };
  });

  app.put<{ Params: { id: string } }>('/api/admin/users/:id/password', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const b = await parseBody(adminPasswordSchema, request.body, reply);
    if (!b) return;
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, request.params.id));
    if (!u) return notFound(reply);
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(b.password);
    const accounts = await ctx.internalAdapter.findAccounts(u.id);
    if (accounts.some((a) => a.providerId === 'credential')) await ctx.internalAdapter.updatePassword(u.id, hash);
    else await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: 'credential', accountId: u.id, password: hash });
    // Sign the user out everywhere.
    await db.delete(sessionTable).where(eq(sessionTable.userId, u.id));
    return { ok: true };
  });

  /** Block / unblock. A blocked user counts as signed out (session.ts). */
  app.put<{ Params: { id: string } }>('/api/admin/users/:id/ban', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const b = await parseBody(z.object({ banned: z.boolean(), reason: z.string().trim().max(300).nullable().optional() }), request.body, reply);
    if (!b) return;
    if (request.params.id === admin.id) return badRequest(reply, 'אי אפשר לחסום את עצמכם');
    const [row] = await db
      .update(user)
      .set(b.banned ? { bannedAt: new Date(), bannedReason: b.reason ?? null } : { bannedAt: null, bannedReason: null })
      .where(eq(user.id, request.params.id))
      .returning({ id: user.id });
    if (!row) return notFound(reply);
    if (b.banned) await db.delete(sessionTable).where(eq(sessionTable.userId, row.id));
    return { ok: true };
  });

  // ===== couples' progress =====
  app.get('/api/admin/couples', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const rows = await db.execute<{
      id: string;
      names: string;
      wedding_date: string | null;
      region: string | null;
      members: { name: string; email: string }[] | null;
      tasks_done: number;
      tasks_total: number;
      vendors_booked: number;
      budget_total: number | null;
      budget_committed: number;
      guests: number;
      site_published: boolean | null;
      gifts_paid: number;
      created_at: string;
    }>(sql`
      select w.id, w.partner1_name || ' ו' || w.partner2_name as names, w.wedding_date::text as wedding_date, w.region,
        (select json_agg(json_build_object('name', u.name, 'email', u.email)) from wedding_member m join "user" u on u.id = m.user_id
          where m.wedding_id = w.id) as members,
        (select count(*)::int from task t where t.wedding_id = w.id and t.done_at is not null) as tasks_done,
        (select count(*)::int from task t where t.wedding_id = w.id) as tasks_total,
        (select count(*)::int from lead l where l.wedding_id = w.id and l.status in ('booked', 'completed')) as vendors_booked,
        w.budget_total_agorot as budget_total,
        (select coalesce(sum(b.actual_agorot), 0)::int from budget_item b where b.wedding_id = w.id) as budget_committed,
        (select coalesce(sum(g.party_size), 0)::int from guest g where g.wedding_id = w.id) as guests,
        (select s.published from wedding_site s where s.wedding_id = w.id) as site_published,
        (select coalesce(sum(gf.amount_agorot), 0)::int from wedding_gift gf where gf.wedding_id = w.id and gf.status = 'paid') as gifts_paid,
        w.created_at
      from wedding w
      order by w.created_at desc
      limit 500`);
    return rows.rows.map(
      (r): AdminCoupleDTO => ({
        weddingId: r.id,
        names: r.names,
        weddingDate: r.wedding_date,
        region: r.region,
        members: r.members ?? [],
        tasks: { done: r.tasks_done, total: r.tasks_total },
        vendorsBooked: r.vendors_booked,
        budgetTotalAgorot: r.budget_total,
        budgetCommittedAgorot: r.budget_committed,
        guests: r.guests,
        sitePublished: Boolean(r.site_published),
        giftsPaidAgorot: r.gifts_paid,
        createdAt: new Date(r.created_at).toISOString(),
      }),
    );
  });

  // ===== invitation templates =====
  app.get('/api/admin/templates', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const rows = await db.select().from(invitationTemplate).orderBy(asc(invitationTemplate.sortOrder), desc(invitationTemplate.createdAt));
    return rows.map(toTemplateDTO);
  });

  app.post('/api/admin/templates', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const b = await parseBody(templateInputSchema, request.body, reply);
    if (!b) return;
    const [row] = await db.insert(invitationTemplate).values({ ...b, backgroundUrl: b.backgroundUrl ?? null }).returning();
    return reply.status(201).send(toTemplateDTO(row!));
  });

  app.put<{ Params: { id: string } }>('/api/admin/templates/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const b = await parseBody(templateInputSchema, request.body, reply);
    if (!b) return;
    const [row] = await db
      .update(invitationTemplate)
      .set({ ...b, backgroundUrl: b.backgroundUrl ?? null })
      .where(eq(invitationTemplate.id, request.params.id))
      .returning();
    if (!row) return notFound(reply);
    return toTemplateDTO(row);
  });

  app.delete<{ Params: { id: string } }>('/api/admin/templates/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    await db.delete(invitationTemplate).where(eq(invitationTemplate.id, request.params.id));
    return { ok: true };
  });

  // ===== payments status =====
  /** Which payment mode runs, and (API mode) whether the Upay login works. No money moves. */
  app.get('/api/admin/payments', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const login = payments.mode === 'api' ? await checkUpayLogin() : null;
    return { mode: payments.mode, live: payments.live, supportsTokens: payments.supportsTokens, login };
  });

  // ===== settings =====
  app.get('/api/admin/settings', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const dto: AppSettingsDTO = { giftFeeBps: await giftFeeBps() };
    return dto;
  });

  app.put('/api/admin/settings', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const b = await parseBody(appSettingsSchema, request.body, reply);
    if (!b) return;
    await db
      .insert(appSetting)
      .values({ key: 'giftFeeBps', value: b.giftFeeBps })
      .onConflictDoUpdate({ target: appSetting.key, set: { value: b.giftFeeBps, updatedAt: new Date() } });
    return { giftFeeBps: b.giftFeeBps };
  });
}
