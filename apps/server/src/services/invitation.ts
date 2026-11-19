/**
 * Wedding invitation writer. Uses Claude (structured output) when ANTHROPIC_API_KEY is set;
 * otherwise a built-in template writer, so the feature always works in demos.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';

import { formatHebrewDate, type InvitationDTO, type InvitationRequest, type InvitationStyle } from '@soon/shared';

import { env } from '../env';

const InvitationText = z.object({
  opening: z.string().describe('שורת פתיחה קצרה מעל שמות בני הזוג, עד 8 מילים'),
  body: z.string().describe('גוף ההזמנה: 2-4 משפטים, בלי לחזור על השמות, התאריך, השעה או המקום'),
  closing: z.string().describe('שורת סיום קצרה, עד 8 מילים'),
});

const STYLE_GUIDE: Record<InvitationStyle, string> = {
  classic: 'קלאסי ומכובד, בעברית תקנית ומעט חגיגית, בנוסח הזמנות מסורתי',
  modern: 'מודרני, קליל וחם, משפטים קצרים ועכשוויים',
  romantic: 'רומנטי ורגשי, עם דימוי עדין אחד לכל היותר',
  minimal: 'מינימליסטי מאוד: מעט מילים, ענייני ואלגנטי',
};

let client: Anthropic | null = null;

export async function writeInvitation(req: InvitationRequest, log: FastifyBaseLogger): Promise<InvitationDTO> {
  if (env.ANTHROPIC_API_KEY) {
    try {
      return { ...(await writeWithClaude(req)), style: req.style, request: req, source: 'ai' };
    } catch (err) {
      log.warn({ err }, 'AI invitation failed; using the template writer');
    }
  }
  return { ...writeFromTemplate(req), style: req.style, request: req, source: 'template' };
}

async function writeWithClaude(req: InvitationRequest) {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const hebrewDate = req.hebrewDate || (req.weddingDate ? formatHebrewDate(req.weddingDate) : '');
  const facts = [
    `בני הזוג: ${req.partner1Name} ו${req.partner2Name}`,
    req.partner1Parents ? `הורי ${req.partner1Name}: ${req.partner1Parents}` : '',
    req.partner2Parents ? `הורי ${req.partner2Name}: ${req.partner2Parents}` : '',
    hebrewDate ? `תאריך עברי: ${hebrewDate}` : '',
    req.venueName ? `מקום: ${req.venueName}` : '',
    req.extra ? `בקשה מיוחדת של הזוג: ${req.extra}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: zodOutputFormat(InvitationText) },
    system:
      'את/ה כותב/ת נוסחי הזמנות לחתונה בעברית. כתוב/כתבי טקסט טבעי, נקי מקלישאות מוגזמות, ללא אימוג׳י וללא סימני קריאה מרובים. ' +
      'השמות, התאריך, השעות והמקום מוצגים בהזמנה בנפרד, לכן אין לכלול אותם בגוף הטקסט. אם צוינו הורים, אפשר לפתוח בהזמנה בשמם.',
    messages: [{ role: 'user', content: `סגנון: ${STYLE_GUIDE[req.style]}\n\n${facts}\n\nכתבו את שורת הפתיחה, גוף ההזמנה ושורת הסיום.` }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new Error(`no invitation text (${response.stop_reason})`);
  return response.parsed_output;
}

/** Deterministic writer: a few hand-written variants per style. */
function writeFromTemplate(req: InvitationRequest) {
  const parents =
    req.partner1Parents && req.partner2Parents
      ? `${req.partner1Parents} ו${req.partner2Parents}`
      : req.partner1Parents || req.partner2Parents || '';
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;
  switch (req.style) {
    case 'classic':
      return {
        opening: parents ? `${parents} שמחים להזמינכם` : 'בשמחה רבה ובהודיה לבורא עולם',
        body: pick([
          'לשמוח עמנו בשמחת נישואי ילדינו היקרים. נשמח לראותכם בין באי השמחה ולחלוק עמכם את הרגע המרגש.',
          'הננו מתכבדים להזמינכם להשתתף בשמחת נישואינו. נוכחותכם תוסיף לנו שמחה וברכה.',
        ]),
        closing: 'נשמח לראותכם',
      };
    case 'modern':
      return {
        opening: pick(['זה קורה!', 'הגיע הרגע', 'סוף סוף']),
        body: pick([
          'אחרי הרבה צחוק, אהבה ותכנונים — אנחנו מתחתנים. יהיה אוכל טוב, מוזיקה טובה ואנשים שאנחנו הכי אוהבים. חסרים רק אתם.',
          'אנחנו מתחתנים ורוצים לחגוג את זה עם האנשים שהכי חשובים לנו. בואו לרקוד, להרים כוסית ולהיות חלק מהיום הכי שמח שלנו.',
        ]),
        closing: 'מחכים לחגוג איתכם',
      };
    case 'romantic':
      return {
        opening: 'שני לבבות, סיפור אחד',
        body: pick([
          'מהרגע שנפגשנו ידענו שזה הסיפור שלנו. עכשיו אנחנו מתחילים את הפרק הבא, ונשמח שתהיו שם איתנו כשנאמר "כן".',
          'אהבה שגדלה יום אחרי יום הביאה אותנו עד לכאן. נשמח לחלוק איתכם את הרגע שבו נהפוך למשפחה.',
        ]),
        closing: 'באהבה גדולה',
      };
    default:
      return {
        opening: 'אנחנו מתחתנים',
        body: 'נשמח לחגוג איתכם.',
        closing: 'נתראה',
      };
  }
}
