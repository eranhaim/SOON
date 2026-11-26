/**
 * First-visit guides, one per screen. Each guide is 1–3 short steps about what the screen does.
 * Matched by path (expo-router pathname). Shown once per user and device; skippable at any step.
 */
import type { IconName } from '@/components/ui';

export type GuideStep = { icon: IconName; title: string; body: string };
export type Guide = { key: string; role: 'couple' | 'vendor'; match: (path: string) => boolean; steps: GuideStep[] };

const is = (p: string) => (path: string) => path === p;
const starts = (p: string) => (path: string) => path.startsWith(p);

export const GUIDES: Guide[] = [
  // ---------- couples ----------
  {
    key: 'couple-home',
    role: 'couple',
    match: is('/couple'),
    steps: [
      { icon: 'heart', title: 'ברוכים הבאים ל־SOON', body: 'כל התכנון של החתונה במקום אחד: ספקים, תקציב, מוזמנים, משימות, הזמנה ואתר חתונה.' },
      { icon: 'grid', title: 'המסך שלכם', body: 'ספירה לאחור, מצב התקציב, הספקים שסגרתם והמשימות הקרובות. כל אריח נפתח בלחיצה.' },
      { icon: 'camera', title: 'בהתאמה אישית', body: 'כפתור המצלמה מחליף את תמונת הרקע, גם לתמונה מהגלריה שלכם. כפתור ההודעות מציג בעיגול אדום כמה הודעות חדשות מחכות.' },
    ],
  },
  {
    key: 'couple-explore',
    role: 'couple',
    match: is('/couple/explore'),
    steps: [
      { icon: 'search', title: 'חיפוש ספקים', body: 'כתבו כל מה שעולה לכם: שם, תחום, אזור או מילה מתוך החבילות. בזמן ההקלדה תופיע גם הצעה לתחום המתאים.' },
      { icon: 'calendar', title: 'פנויים בתאריך שלכם', body: 'בחרו תחום בפס העליון. הכפתור "פנוי בתאריך" מציג רק ספקים פנויים בתאריך החתונה, ו"סינון" מוסיף אזור, מחיר ומיון.' },
      { icon: 'heart', title: 'שומרים ומשווים', body: 'הלב שומר ספק לרשימה המשותפת שלכם. לחיצה על הכרטיס פותחת את עמוד הספק.' },
    ],
  },
  {
    key: 'vendor-page',
    role: 'couple',
    match: starts('/v/'),
    steps: [
      { icon: 'image', title: 'עמוד הספק', body: 'תיק עבודות, חבילות ומחירים, ביקורות של זוגות ושאלות נפוצות, הכול במקום אחד.' },
      { icon: 'message-circle', title: 'פונים בלחיצה', body: '"הודעה", "בדיקת זמינות" ו"הצעת מחיר" פותחים שיחה ישירה עם הספק, עם התאריך שלכם כבר בפנים.' },
      { icon: 'phone-call', title: 'שיחת התאמה', body: 'בחרו שעה פנויה ביומן של הספק, או בקשו שיחזרו אליכם. אחרי שעבדתם איתם, כתבו ביקורת לזוגות הבאים.' },
    ],
  },
  {
    key: 'couple-saved',
    role: 'couple',
    match: is('/couple/saved'),
    steps: [
      { icon: 'heart', title: 'שמורים', body: 'הספקים ששמרתם, ברשימה אחת משותפת לשניכם.' },
      { icon: 'layers', title: 'לוחות השראה', body: 'אספו תמונות לפי נושא, כמו שמלה, פרחים או עיצוב, כדי לראות מה אתם אוהבים ולהראות לספקים.' },
    ],
  },
  {
    key: 'couple-planning',
    role: 'couple',
    match: is('/couple/planning'),
    steps: [
      { icon: 'grid', title: 'כלי התכנון', body: 'תקציב, ספקים, צ׳קליסט, יומן, מוזמנים, הזמנה, אתר החתונה ופלייליסט. כל כלי נפתח בלחיצה.' },
      { icon: 'feather', title: 'היועצת של SOON', body: 'שאלו כל שאלה על התכנון. היועצת מכירה את התאריך, התקציב והספקים שלכם.' },
    ],
  },
  {
    key: 'couple-profile',
    role: 'couple',
    match: is('/couple/profile'),
    steps: [
      { icon: 'user-plus', title: 'מתכננים יחד', body: '"הזמנת בן/בת הזוג" שולח קישור. אחרי ההצטרפות שניכם רואים ועורכים את אותה חתונה.' },
      { icon: 'users', title: 'קהילת זוגות', body: 'הצטרפו כדי להתייעץ עם זוגות שמתחתנים בתקופה שלכם. כאן גם עורכים את פרטי החתונה ומתנתקים.' },
    ],
  },
  {
    key: 'couple-budget',
    role: 'couple',
    match: is('/couple/planning/budget'),
    steps: [
      { icon: 'pie-chart', title: 'התקציב שלכם', body: 'התקציב הכולל למעלה. לחצו "עריכה" כדי לשנות אותו בכל רגע.' },
      { icon: 'list', title: 'שורה לכל קטגוריה', body: 'לכל קטגוריה יש שורה אחת: כמה תכננתם, כמה סוכם וכמה שולם. "+" מוסיף שורה.' },
      { icon: 'credit-card', title: 'תשלומים', body: 'בלשונית "תשלומים" רושמים מקדמות ותשלומים עתידיים, ומסמנים מה כבר שולם.' },
    ],
  },
  {
    key: 'couple-checklist',
    role: 'couple',
    match: is('/couple/planning/checklist'),
    steps: [{ icon: 'check-square', title: 'צ׳קליסט', body: 'המשימות מסודרות לפי הזמן שנשאר עד החתונה. סמנו משימה שסיימתם, והוסיפו משימות משלכם.' }],
  },
  {
    key: 'couple-guests',
    role: 'couple',
    match: is('/couple/planning/guests'),
    steps: [
      { icon: 'user-check', title: 'רשימת מוזמנים', body: 'הוסיפו מוזמנים, צד ומספר אנשים. כך רואים כמה אישרו, כמה לא וכמה עוד לא ענו.' },
      { icon: 'globe', title: 'אישורים מהאתר', body: 'כשאורחים מאשרים הגעה באתר החתונה, התשובה נכנסת לכאן לבד.' },
    ],
  },
  {
    key: 'couple-calendar',
    role: 'couple',
    match: is('/couple/planning/calendar'),
    steps: [{ icon: 'calendar', title: 'היומן שלכם', body: 'פגישות, טעימות ומדידות. מה שספק קבע איתכם, כמו שיחת התאמה, מופיע כאן עם "נקבע על ידי הספק".' }],
  },
  {
    key: 'couple-vendors',
    role: 'couple',
    match: is('/couple/planning/vendors'),
    steps: [{ icon: 'briefcase', title: 'הספקים שלכם', body: 'כל הקטגוריות: מה כבר נסגר ומה עוד חסר. לחיצה על קטגוריה פותחת חיפוש בתחום.' }],
  },
  {
    key: 'couple-invitation',
    role: 'couple',
    match: is('/couple/planning/invitation'),
    steps: [
      { icon: 'edit-3', title: 'נוסח ההזמנה', body: 'מלאו כמה פרטים ובחרו סגנון. נכתוב נוסח, ואתם יכולים לבקש נוסח אחר או לערוך אותו.' },
      { icon: 'image', title: 'עיצוב ושיתוף', body: 'בחרו עיצוב מהתבניות, שמרו ושתפו. מכאן עוברים גם לאתר החתונה עם אישורי הגעה.' },
    ],
  },
  {
    key: 'couple-site',
    role: 'couple',
    match: is('/couple/planning/site'),
    steps: [
      { icon: 'globe', title: 'אתר החתונה', body: 'קישור אחד לאורחים: ההזמנה, ספירה לאחור, ניווט, אישור הגעה, ברכות ומתנה באשראי.' },
      { icon: 'edit-3', title: 'עורכים ומפרסמים', body: 'כתבו סיפור, לוח זמנים ופרטים לאורחים. "פרסום האתר" פותח אותו לאורחים, ו"שליחה לאורחים" משתף את הקישור.' },
      { icon: 'gift', title: 'אישורים, ברכות ומתנות', body: 'בלשונית השנייה רואים מי מגיע, את הברכות ואת המתנות ששולמו.' },
    ],
  },
  {
    key: 'couple-playlist',
    role: 'couple',
    match: is('/couple/planning/playlist'),
    steps: [{ icon: 'music', title: 'הפלייליסט', body: 'שירים לכל רגע בחתונה: כניסה לחופה, שבירת הכוס, ריקוד ראשון ועוד. שתפו עם ה־DJ.' }],
  },
  {
    key: 'couple-advisor',
    role: 'couple',
    match: is('/couple/advisor'),
    steps: [{ icon: 'feather', title: 'היועצת של SOON', body: 'שאלו כל שאלה על התכנון. התשובות לוקחות בחשבון את התאריך, התקציב, הספקים והמשימות שלכם.' }],
  },
  {
    key: 'couple-community',
    role: 'couple',
    match: is('/couple/community'),
    steps: [
      { icon: 'users', title: 'קהילת זוגות', body: 'הצטרפו כדי שזוגות אחרים יראו אתכם ויוכלו לכתוב לכם. לא מוצג טלפון ולא אימייל.' },
      { icon: 'message-circle', title: 'שואלים מי שכבר סגר', body: 'בכל זוג רואים אילו ספקים כבר סגרו. שלחו הודעה ושאלו איך היה.' },
    ],
  },
  {
    key: 'messages',
    role: 'couple',
    match: is('/messages'),
    steps: [{ icon: 'message-circle', title: 'הודעות', body: 'כל השיחות עם הספקים. עיגול אדום מסמן הודעות חדשות. "שיחות עם זוגות" מוביל לקהילה.' }],
  },
  {
    key: 'thread-couple',
    role: 'couple',
    match: starts('/messages/'),
    steps: [{ icon: 'message-circle', title: 'שיחה עם ספק', body: 'פרטי האירוע מופיעים למעלה, כדי שלא תצטרכו לחזור עליהם. הכפתור הירוק פותח את השיחה בוואטסאפ.' }],
  },

  // ---------- vendors ----------
  {
    key: 'vendor-home',
    role: 'vendor',
    match: is('/vendor'),
    steps: [
      { icon: 'briefcase', title: 'ברוכים הבאים ל־SOON', body: 'כאן זוגות מוצאים אתכם, ואתם מנהלים את העסק: פניות, לקוחות, יומן וכספים.' },
      { icon: 'trending-up', title: 'הדשבורד', body: 'הכנסות השנה, פניות חדשות, האירועים הקרובים ומשימות מעקב, במבט אחד.' },
      { icon: 'menu', title: 'הלשוניות למטה', body: 'יומן, לקוחות, הודעות ו"העסק" לעמוד, לנתונים, לכספים ולהגדרות.' },
    ],
  },
  {
    key: 'vendor-calendar',
    role: 'vendor',
    match: is('/vendor/calendar'),
    steps: [
      { icon: 'calendar', title: 'היומן שלכם', body: 'לחצו על יום כדי לראות מה בו. "+" מוסיף אירוע, פגישה, שיחת התאמה או יום חופש.' },
      { icon: 'heart', title: 'משייכים זוג', body: 'בחרו זוג מ־SOON: הרשומה תופיע בכרטיס הלקוח וגם ביומן של הזוג. אפשר להוסיף מקום ומקדמה.' },
      { icon: 'refresh-cw', title: 'סנכרון', body: 'כפתור הסנכרון מחבר את היומן ל־Google או ל־Apple, כך שהכול מופיע גם בטלפון.' },
    ],
  },
  {
    key: 'vendor-leads',
    role: 'vendor',
    match: is('/vendor/leads'),
    steps: [
      { icon: 'users', title: 'לקוחות ופניות', body: 'כל פנייה מזוג נכנסת לכאן. בחרו שלב למעלה או חפשו לקוח לפי שם.' },
      { icon: 'user-plus', title: 'לקוח חדש', body: 'הוסיפו זוג שרשום ב־SOON (חיפוש לפי טלפון או אימייל), או לקוח חיצוני.' },
    ],
  },
  {
    key: 'vendor-lead',
    role: 'vendor',
    match: starts('/vendor/lead/'),
    steps: [{ icon: 'file-text', title: 'כרטיס לקוח', body: 'שלב הלקוח, הצעת המחיר, התשלומים, האירועים ביומן ומשימת ההמשך. עדכנו את השלב כשמשהו מתקדם.' }],
  },
  {
    key: 'vendor-messages',
    role: 'vendor',
    match: is('/vendor/messages'),
    steps: [{ icon: 'message-circle', title: 'הודעות מזוגות', body: 'עיגול אדום מסמן הודעות חדשות. מתוך שיחה אפשר להוסיף את הזוג ללקוחות.' }],
  },
  {
    key: 'thread-vendor',
    role: 'vendor',
    match: starts('/messages/'),
    steps: [{ icon: 'message-circle', title: 'שיחה עם זוג', body: 'פרטי האירוע של הזוג מופיעים למעלה. "הוספה כלקוח" מכניס אותם ל־CRM, והכפתור הירוק פותח וואטסאפ.' }],
  },
  {
    key: 'vendor-business',
    role: 'vendor',
    match: is('/vendor/business'),
    steps: [
      { icon: 'link', title: 'הקישור שלכם', body: 'הקישור לעמוד העסק. שימו אותו בביו באינסטגרם או שלחו ללקוחות.' },
      { icon: 'settings', title: 'כל העסק', body: 'עמוד העסק, נתונים, הכנסות והוצאות, מסמכים ללקוחות, מנוי והגדרות.' },
    ],
  },
  {
    key: 'vendor-storefront',
    role: 'vendor',
    match: is('/vendor/storefront'),
    steps: [
      { icon: 'eye', title: 'כך זוגות רואים אתכם', body: 'זה עמוד העסק שלכם. "עריכה" ליד כל חלק פותחת אותו לעריכה.' },
      { icon: 'image', title: 'תמונות וסרטונים', body: '"+" בתיק העבודות מעלה תמונות וסרטונים מהטלפון. העמוד הכי מוכר כשיש בו הרבה עבודות.' },
    ],
  },
  {
    key: 'vendor-profile',
    role: 'vendor',
    match: is('/vendor/profile'),
    steps: [{ icon: 'feather', title: 'פרטי העסק', body: 'תחום, אזורי שירות (או כל הארץ) ומחיר. כתבו כמה מילים על העסק ולחצו "השלמה לפסקה מלאה".' }],
  },
  {
    key: 'vendor-faq',
    role: 'vendor',
    match: is('/vendor/faq'),
    steps: [{ icon: 'help-circle', title: 'שאלות נפוצות', body: 'בחרו תשובה אחת לכל שאלה מוכנה. אפשר להוסיף גם שאלות משלכם.' }],
  },
  {
    key: 'vendor-stats',
    role: 'vendor',
    match: is('/vendor/stats'),
    steps: [{ icon: 'bar-chart-2', title: 'נתונים', body: 'צפיות בעמוד, שמירות, פניות ועסקאות לפי שבועות, ואחוזי ההמרה ביניהם.' }],
  },
  {
    key: 'vendor-finance',
    role: 'vendor',
    match: is('/vendor/finance'),
    steps: [{ icon: 'trending-up', title: 'כספים', body: 'הכנסות ומה צפוי להיכנס, הוצאות עם קבלות, ומסמכים ללקוחות: קבלות, הצעות מחיר ודרישות תשלום.' }],
  },
  {
    key: 'vendor-subscription',
    role: 'vendor',
    match: is('/vendor/subscription'),
    steps: [{ icon: 'award', title: 'המנוי', body: 'החודש הראשון חינם. Pro ו־Premium מוסיפים כלים, חשיפה בראש החיפוש ותג "מומלץ".' }],
  },
  {
    key: 'vendor-settings',
    role: 'vendor',
    match: is('/vendor/settings'),
    steps: [{ icon: 'phone-call', title: 'הגדרות', body: 'כאן קובעים מתי זוגות יכולים לקבוע איתכם שיחת התאמה, ומגדירים התראות ופרטים למסמכים.' }],
  },
];

export function guideFor(path: string, role: string | null): Guide | null {
  if (role !== 'couple' && role !== 'vendor') return null;
  return GUIDES.find((g) => g.role === role && g.match(path)) ?? null;
}
