import { z } from 'zod';

/**
 * Ready FAQ questions with multiple-choice answers. A vendor taps one answer per question
 * instead of writing text; couples see the question with the chosen answer on the vendor page.
 * `categories` limits a question to those vendor categories (none = every vendor).
 */
export type FaqTemplate = { key: string; question: string; options: readonly string[]; categories?: readonly string[] };

export const FAQ_TEMPLATES: readonly FaqTemplate[] = [
  // ----- every vendor -----
  { key: 'travel', question: 'האם אתם עובדים בכל הארץ?', options: ['כן, בכל הארץ', 'כן, בתוספת דמי נסיעה', 'רק באזורי השירות שלנו'] },
  { key: 'booking_ahead', question: 'כמה זמן מראש כדאי לסגור אתכם?', options: ['חודש–חודשיים', '3–6 חודשים', '6–12 חודשים', 'שנה ומעלה'] },
  { key: 'deposit', question: 'כמה מקדמה צריך כדי לשריין תאריך?', options: ['בלי מקדמה', 'עד 10%', '20%–30%', '50% ומעלה'] },
  { key: 'payment_methods', question: 'איך אפשר לשלם?', options: ['העברה בנקאית', 'כרטיס אשראי', 'ביט / פייבוקס', 'כל האמצעים'] },
  { key: 'cancellation', question: 'מה מדיניות הביטולים?', options: ['החזר מלא עד 90 יום לפני', 'המקדמה לא מוחזרת', 'לפי החוזה'] },
  { key: 'meeting', question: 'אפשר להיפגש לפני שסוגרים?', options: ['כן, פגישה פרונטלית', 'כן, בשיחת וידאו', 'בשיחת טלפון'] },
  { key: 'invoice', question: 'האם אתם מוציאים חשבונית מס?', options: ['כן, חשבונית מס', 'קבלה בלבד'] },
  { key: 'events_per_day', question: 'האם אתם עובדים ביותר מאירוע אחד ביום?', options: ['לא, אירוע אחד ביום', 'לפעמים', 'כן'] },

  // ----- by category -----
  { key: 'photo_delivery', question: 'תוך כמה זמן מקבלים את התמונות?', options: ['עד שבועיים', 'עד חודש', 'עד חודשיים', 'יותר מחודשיים'], categories: ['photography', 'social'] },
  { key: 'photo_album', question: 'האם אלבום כלול במחיר?', options: ['כן', 'בתוספת תשלום', 'אנחנו לא מציעים אלבומים'], categories: ['photography'] },
  { key: 'photo_team', question: 'כמה צלמים מגיעים לאירוע?', options: ['צלם/ת אחד/ת', 'שני צלמים', 'צלם + צלם וידאו', 'לפי החבילה'], categories: ['photography', 'video'] },
  { key: 'video_delivery', question: 'תוך כמה זמן מקבלים את הסרט?', options: ['עד חודש', 'עד חודשיים', 'עד 3 חודשים', 'יותר מ־3 חודשים'], categories: ['video'] },
  { key: 'video_clip', question: 'האם יש קליפ קצר לרשתות?', options: ['כן, כלול', 'בתוספת תשלום', 'לא'], categories: ['video', 'social'] },
  { key: 'social_live', question: 'מתי עולים הסטוריז והתכנים?', options: ['בזמן האירוע', 'בסוף האירוע', 'למחרת'], categories: ['social'] },
  { key: 'dj_equipment', question: 'האם ציוד הגברה ותאורה כלולים?', options: ['כן, הכול כלול', 'הגברה כלולה, תאורה בתוספת', 'לפי החבילה'], categories: ['dj'] },
  { key: 'dj_requests', question: 'אפשר לבקש שירים מראש?', options: ['כן, בונים פלייליסט יחד', 'כן, רשימת בקשות', 'סומכים על ה־DJ'], categories: ['dj'] },
  { key: 'venue_capacity', question: 'כמה אורחים המקום מכיל?', options: ['עד 250', '250–500', '500–800', '800 ומעלה'], categories: ['venue'] },
  { key: 'venue_kosher', question: 'האם האוכל כשר?', options: ['כשר', 'כשר למהדרין', 'לא כשר', 'לפי בקשה'], categories: ['venue', 'catering'] },
  { key: 'venue_parking', question: 'האם יש חניה?', options: ['חניה חינם', 'חניה בתשלום', 'שירות ואלה'], categories: ['venue'] },
  { key: 'catering_tasting', question: 'האם יש טעימות לפני האירוע?', options: ['כן, ללא עלות', 'כן, בתשלום', 'לא'], categories: ['venue', 'catering'] },
  { key: 'beauty_trial', question: 'האם יש ניסיון לפני האירוע?', options: ['כן, כלול במחיר', 'כן, בתוספת תשלום', 'לא'], categories: ['makeup', 'hair'] },
  { key: 'beauty_location', question: 'איפה מתארגנים?', options: ['אצלנו בסטודיו', 'אנחנו מגיעים אליכם', 'גם וגם'], categories: ['makeup', 'hair'] },
  { key: 'dress_fittings', question: 'כמה מדידות כלולות?', options: ['מדידה אחת', '2–3 מדידות', 'ללא הגבלה'], categories: ['dresses', 'suits'] },
  { key: 'dress_rent', question: 'להשכרה או לרכישה?', options: ['השכרה', 'רכישה', 'גם וגם'], categories: ['dresses', 'suits'] },
  { key: 'design_setup', question: 'האם ההקמה והפירוק כלולים?', options: ['כן', 'בתוספת תשלום'], categories: ['design', 'flowers', 'attractions', 'photo_booths', 'magnets'] },
  { key: 'production_scope', question: 'מה כוללת ההפקה?', options: ['ליווי מלא מההתחלה', 'ניהול ביום האירוע', 'לפי החבילה'], categories: ['production', 'event_management'] },
  { key: 'rsvp_method', question: 'איך אוספים אישורי הגעה?', options: ['הודעות וואטסאפ', 'שיחות טלפון', 'גם וגם'], categories: ['rsvp'] },
];

/** The ready questions that fit a vendor category. */
export function faqTemplatesFor(category: string): FaqTemplate[] {
  return FAQ_TEMPLATES.filter((t) => !t.categories || t.categories.includes(category));
}

export const faqTemplateAnswerSchema = z.object({ answer: z.string().trim().min(1).max(200) });
