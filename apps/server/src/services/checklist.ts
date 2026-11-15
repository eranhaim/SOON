/**
 * Auto-generated checklist (spec §7.1). Templates are planned back from the wedding date;
 * past-due template dates are pulled forward to today so nothing starts out "overdue".
 * Safe to run repeatedly: (wedding_id, template_key) is unique, and only open tasks move.
 */
import { eq, sql } from 'drizzle-orm';

import { addDays, CHECKLIST_TEMPLATES, maxIso, todayIso } from '@soon/shared';

import type { DB } from '../db';
import { task, weddingCategory } from '../db/schema';
import type { WeddingRow } from '../session';

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export async function syncChecklist(tx: Tx, w: WeddingRow) {
  const closed = new Set(
    (await tx.select().from(weddingCategory).where(eq(weddingCategory.weddingId, w.id)))
      .filter((c) => c.status === 'closed')
      .map((c) => c.categorySlug),
  );
  const today = todayIso();
  const now = new Date();

  await tx
    .insert(task)
    .values(
      CHECKLIST_TEMPLATES.map((t) => ({
        weddingId: w.id,
        title: t.title,
        templateKey: t.key,
        categorySlug: t.closesCategory ?? null,
        dueDate: w.weddingDate ? maxIso(today, addDays(w.weddingDate, -t.daysBefore)) : null,
        doneAt: t.closesCategory && closed.has(t.closesCategory) ? now : null,
      })),
    )
    .onConflictDoUpdate({
      target: [task.weddingId, task.templateKey],
      set: { dueDate: sql`excluded.due_date` },
      setWhere: sql`${task.doneAt} is null`,
    });
}
