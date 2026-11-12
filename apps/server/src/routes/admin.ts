import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';

import {
  adminRejectSchema,
  adminSuspendSchema,
  VENDOR_STATUSES,
  type AdminAction,
  type AdminVendorDetail,
  type AdminVendorList,
  type VendorStatus,
} from '@soon/shared';

import { db } from '../db';
import { adminAction, category, user, vendor } from '../db/schema';
import { parseBody, requireAdmin } from '../session';
import { loadVendor } from './vendors';

/** Allowed moderation transitions: action → (from statuses, to status). */
const TRANSITIONS: Record<AdminAction, { from: VendorStatus[]; to: VendorStatus }> = {
  'vendor.approve': { from: ['pending', 'rejected'], to: 'approved' },
  'vendor.reject': { from: ['pending'], to: 'rejected' },
  'vendor.suspend': { from: ['approved'], to: 'suspended' },
  'vendor.reinstate': { from: ['suspended'], to: 'approved' },
};

async function transition(
  reply: FastifyReply,
  adminUserId: string,
  vendorId: string,
  action: AdminAction,
  reason: string | null,
) {
  const rule = TRANSITIONS[action];
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(vendor)
      .set({
        status: rule.to,
        statusReason: reason,
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
      })
      .where(and(eq(vendor.id, vendorId), inArray(vendor.status, rule.from)))
      .returning();
    if (!row) return null;
    await tx.insert(adminAction).values({
      adminUserId,
      action,
      targetType: 'vendor',
      targetId: vendorId,
      reason,
    });
    return row;
  });

  if (!updated) {
    const [exists] = await db.select({ status: vendor.status }).from(vendor).where(eq(vendor.id, vendorId));
    if (!exists) return reply.status(404).send({ error: 'Not found' });
    return reply.status(409).send({ error: `Cannot ${action.split('.')[1]} a ${exists.status} vendor` });
  }
  return loadVendor(updated);
}

export async function adminRoutes(app: FastifyInstance) {
  /** Vendors by status (default: pending, oldest submission first) + counts per status. */
  app.get<{ Querystring: { status?: string } }>('/api/admin/vendors', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const status = (VENDOR_STATUSES as readonly string[]).includes(request.query.status ?? '')
      ? (request.query.status as VendorStatus)
      : 'pending';

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: vendor.id,
          slug: vendor.slug,
          businessName: vendor.businessName,
          categoryLabel: category.labelHe,
          status: vendor.status,
          coverUrl: vendor.coverUrl,
          ownerEmail: user.email,
          submittedAt: vendor.submittedAt,
          updatedAt: vendor.updatedAt,
        })
        .from(vendor)
        .innerJoin(user, eq(user.id, vendor.ownerUserId))
        .innerJoin(category, eq(category.slug, vendor.categorySlug))
        .where(eq(vendor.status, status))
        .orderBy(
          status === 'pending' ? sql`${vendor.submittedAt} asc nulls last` : desc(vendor.updatedAt),
        )
        .limit(200),
      db.select({ status: vendor.status, n: count() }).from(vendor).groupBy(vendor.status),
    ]);

    const counts = Object.fromEntries(VENDOR_STATUSES.map((s) => [s, 0])) as Record<VendorStatus, number>;
    for (const r of countRows) counts[r.status] = Number(r.n);

    const result: AdminVendorList = {
      counts,
      items: rows.map((r) => ({
        ...r,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
    return result;
  });

  /** Full storefront + owner + moderation history. */
  app.get<{ Params: { id: string } }>('/api/admin/vendors/:id', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const [row] = await db.select().from(vendor).where(eq(vendor.id, request.params.id)).limit(1);
    if (!row) return reply.status(404).send({ error: 'Not found' });

    const [[owner], history] = await Promise.all([
      db
        .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, row.ownerUserId)),
      db
        .select({
          id: adminAction.id,
          action: adminAction.action,
          reason: adminAction.reason,
          createdAt: adminAction.createdAt,
          adminEmail: user.email,
        })
        .from(adminAction)
        .leftJoin(user, eq(user.id, adminAction.adminUserId))
        .where(and(eq(adminAction.targetType, 'vendor'), eq(adminAction.targetId, row.id)))
        .orderBy(desc(adminAction.createdAt)),
    ]);

    const detail: AdminVendorDetail = {
      vendor: await loadVendor(row),
      owner: { ...owner!, createdAt: owner!.createdAt.toISOString() },
      history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
    };
    return detail;
  });

  app.post<{ Params: { id: string } }>('/api/admin/vendors/:id/approve', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    return transition(reply, admin.id, request.params.id, 'vendor.approve', null);
  });

  app.post<{ Params: { id: string } }>('/api/admin/vendors/:id/reject', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const body = await parseBody(adminRejectSchema, request.body, reply);
    if (!body) return;
    return transition(reply, admin.id, request.params.id, 'vendor.reject', body.reason);
  });

  app.post<{ Params: { id: string } }>('/api/admin/vendors/:id/suspend', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const body = await parseBody(adminSuspendSchema, request.body, reply);
    if (!body) return;
    return transition(reply, admin.id, request.params.id, 'vendor.suspend', body.reason);
  });

  app.post<{ Params: { id: string } }>('/api/admin/vendors/:id/reinstate', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    return transition(reply, admin.id, request.params.id, 'vendor.reinstate', null);
  });
}
