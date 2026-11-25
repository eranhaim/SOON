/**
 * "Help me write" for the vendor's About text: turns a few words into one good paragraph.
 * Uses Claude when ANTHROPIC_API_KEY is set; otherwise a template paragraph, so it always works.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { FastifyBaseLogger } from 'fastify';

import { REGIONS } from '@soon/shared';

import { env } from '../env';

export type AboutFacts = {
  businessName: string;
  categoryLabel: string;
  regions: string[];
  /** What the vendor typed (notes or a draft). */
  notes: string;
};

let client: Anthropic | null = null;

export async function writeVendorAbout(f: AboutFacts, log: FastifyBaseLogger): Promise<{ text: string; source: 'ai' | 'template' }> {
  if (env.ANTHROPIC_API_KEY) {
    try {
      return { text: await writeWithClaude(f), source: 'ai' };
    } catch (err) {
      log.warn({ err }, 'AI about text failed; using the template');
    }
  }
  return { text: writeFromTemplate(f), source: 'template' };
}

function regionText(regions: string[]) {
  if (regions.length >= REGIONS.length) return 'בכל הארץ';
  const names = regions.map((r) => REGIONS.find((x) => x.slug === r)?.he).filter(Boolean);
  return names.length ? `ב${names.join(', ')}` : '';
}

async function writeWithClaude(f: AboutFacts) {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const facts = [
    `שם העסק: ${f.businessName}`,
    `תחום: ${f.categoryLabel}`,
    regionText(f.regions) ? `אזור שירות: ${regionText(f.regions)}` : '',
    f.notes ? `מה הספק כתב על עצמו: ${f.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 1500,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system:
      'את/ה כותב/ת טקסט "אודות" לעמוד עסק של ספק חתונות באפליקציה לזוגות. כתוב/כתבי פסקה אחת בעברית, 60–110 מילים, בגוף ראשון רבים ("אנחנו"), ' +
      'חמה, מקצועית וטבעית. השתמש/י רק בעובדות שנמסרו, אל תמציא/י מחירים, פרסים, שנות ניסיון או מספרים. בלי אימוג׳י, בלי כותרת ובלי מירכאות. ' +
      'החזר/י רק את הפסקה עצמה.',
    messages: [{ role: 'user', content: `${facts}\n\nכתבו את פסקת האודות.` }],
  });
  if (response.stop_reason === 'refusal') throw new Error('refused');
  const text = response.content
    .filter((b): b is Extract<(typeof response.content)[number], { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (text.length < 20) throw new Error('empty about text');
  return text.slice(0, 4000);
}

function writeFromTemplate(f: AboutFacts) {
  const where = regionText(f.regions);
  const notes = f.notes.trim().replace(/[.\s]+$/, '');
  return [
    `אנחנו ${f.businessName}, ${f.categoryLabel}${where ? ` ${where}` : ''}.`,
    notes ? `${notes}.` : '',
    'אנחנו מאמינים שכל חתונה היא סיפור אחר, ולכן מקשיבים לכל זוג ומתאימים את עצמנו לחלום שלכם, מהפגישה הראשונה ועד הרגע האחרון של האירוע.',
    'נשמח להכיר ולספר לכם עוד – שלחו לנו הודעה כאן באפליקציה.',
  ]
    .filter(Boolean)
    .join(' ');
}
