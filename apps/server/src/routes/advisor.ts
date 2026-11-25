/**
 * AI wedding advisor for couples: answers planning questions in Hebrew with the couple's own
 * data (date, budget, closed / open categories, open tasks, guests). Without an API key or
 * when the model is unavailable, it answers with a short fixed tip and the right tool.
 */
import Anthropic from '@anthropic-ai/sdk';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { daysBetween, formatHebrewDate, regionLabel, todayIso } from '@soon/shared';

import { db } from '../db';
import { category, guest, task, weddingCategory } from '../db/schema';
import { env } from '../env';
import { parseBody, requireWedding, type WeddingRow } from '../session';
import { loadBudget } from './planning';

const advisorSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20)
    .refine((m) => m[m.length - 1]!.role === 'user', 'Last message must be the couple'),
});

let client: Anthropic | null = null;

async function contextOf(w: WeddingRow): Promise<string> {
  const [cats, tasks, guests, budget] = await Promise.all([
    db
      .select({ label: category.labelHe, status: weddingCategory.status })
      .from(weddingCategory)
      .innerJoin(category, eq(category.slug, weddingCategory.categorySlug))
      .where(eq(weddingCategory.weddingId, w.id)),
    db
      .select({ title: task.title, due: task.dueDate })
      .from(task)
      .where(and(eq(task.weddingId, w.id), isNull(task.doneAt)))
      .orderBy(sql`${task.dueDate} asc nulls last`, asc(task.createdAt))
      .limit(8),
    db.select({ n: sql<number>`coalesce(sum(${guest.partySize}), 0)::int` }).from(guest).where(eq(guest.weddingId, w.id)),
    loadBudget(w.id, w.budgetTotalAgorot),
  ]);
  const ils = (a: number | null) => (a == null ? 'לא הוגדר' : `₪${Math.round(a / 100).toLocaleString('he-IL')}`);
  return [
    `בני הזוג: ${w.partner1Name} ו${w.partner2Name}`,
    w.weddingDate ? `תאריך החתונה: ${w.weddingDate} (${formatHebrewDate(w.weddingDate)}), עוד ${daysBetween(todayIso(), w.weddingDate)} ימים` : 'תאריך: עוד לא נקבע',
    w.region ? `אזור: ${regionLabel(w.region)}` : '',
    w.venueName ? `מקום: ${w.venueName}` : '',
    `תקציב כולל: ${ils(budget.totalAgorot)}; התחייבו עד עכשיו: ${ils(budget.committedAgorot)}; שולם: ${ils(budget.paidAgorot)}`,
    `ספקים שכבר נסגרו: ${cats.filter((c) => c.status === 'closed').map((c) => c.label).join(', ') || 'אין עדיין'}`,
    `עוד צריך לסגור: ${cats.filter((c) => c.status === 'needed').map((c) => c.label).join(', ') || 'לא צוין'}`,
    `מוזמנים ברשימה: ${guests[0]?.n ?? 0}`,
    `משימות פתוחות קרובות: ${tasks.map((t) => (t.due ? `${t.title} (עד ${t.due})` : t.title)).join('; ') || 'אין'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const FALLBACK =
  'היועצת החכמה לא זמינה כרגע, אבל הנה כמה כלים שיעזרו מיד:\n' +
  '• צ׳קליסט: מה לעשות ומתי, לפי תאריך החתונה שלכם.\n' +
  '• תקציב: חלוקה מומלצת לפי קטגוריות ומעקב תשלומים.\n' +
  '• חיפוש ספקים: לפי תחום, אזור וזמינות בתאריך.\n' +
  'נסו לשאול שוב בעוד כמה דקות.';

export async function advisorRoutes(app: FastifyInstance) {
  app.post('/api/advisor', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const b = await parseBody(advisorSchema, request.body, reply);
    if (!b) return;
    if (!env.ANTHROPIC_API_KEY) return { reply: FALLBACK, source: 'fallback' };
    try {
      client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const response = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 1500,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system:
          'את/ה "היועצת של SOON": מתכננת חתונות מנוסה בישראל שעוזרת לזוג לתכנן את החתונה שלהם. ' +
          'עונים בעברית, בגובה העיניים, חם וענייני, בתשובות קצרות (עד 150 מילים) עם צעדים ברורים. ' +
          'משתמשים בנתונים של הזוג כשזה רלוונטי. לא ממציאים מחירים מדויקים של ספקים מסוימים; אפשר לתת טווחים מקובלים בישראל ולהבהיר שהם הערכה. ' +
          'כשמתאים, מפנים לכלים באפליקציה: חיפוש ספקים, תקציב, צ׳קליסט, רשימת מוזמנים, יומן, אתר החתונה, שיחת התאמה עם ספק. ' +
          'אין להמליץ על ספק לפי שם. בלי אימוג׳י.\n\nהנתונים של הזוג:\n' +
          (await contextOf(ctx.wedding)),
        messages: b.messages.slice(-12),
      });
      if (response.stop_reason === 'refusal') return { reply: 'על זה לא אוכל לעזור. אשמח לעזור בכל שאלה על תכנון החתונה.', source: 'ai' };
      const text = response.content
        .filter((c): c is Extract<(typeof response.content)[number], { type: 'text' }> => c.type === 'text')
        .map((c) => c.text)
        .join('')
        .trim();
      return { reply: text || FALLBACK, source: text ? 'ai' : 'fallback' };
    } catch (err) {
      request.log.warn({ err }, 'advisor failed');
      return { reply: FALLBACK, source: 'fallback' };
    }
  });
}
