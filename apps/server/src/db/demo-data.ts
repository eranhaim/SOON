/**
 * Demo data: a believable marketplace so every screen has data.
 * Used by the seed-demo CLI and by POST /api/demo/reset (DEMO_TOOLS=true).
 * Idempotent: wipes previous demo users (…@demo.soon) and everything hanging off them.
 * Every demo user signs in with the password DEMO_PASSWORD.
 */
import { randomUUID } from 'node:crypto';

import { hashPassword } from 'better-auth/crypto';
import { and, eq, inArray, isNull, like, sql } from 'drizzle-orm';

import { addDays, budgetCategoryForVendor, categoryLabel, todayIso, type RegionSlug } from '@soon/shared';

import { STARTER_BOARDS } from '../routes/boards';
import { syncChecklist } from '../services/checklist';
import { db } from './index';
import {
  account,
  availabilityEntry,
  board,
  boardItem,
  clientDocument,
  vendorExpense,
  weddingSong,
  budgetItem,
  conversation,
  guest,
  lead,
  leadPayment,
  message,
  review,
  savedVendor,
  user,
  vendor,
  vendorFaq,
  vendorMedia,
  vendorPackage,
  vendorRegion,
  vendorStatDaily,
  wedding,
  weddingCategory,
  weddingEvent,
  weddingMember,
  weddingPayment,
} from './schema';

export const DEMO_PASSWORD = 'demo1234';
let demoPasswordHash = '';

const img = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

const PHOTOS = {
  couple: [
    '1519741497674-611481863552', '1511285560929-80b456fea0bc', '1465495976277-4387d4b0b4c6',
    '1522673607200-164d1b6ce486', '1507504031003-b417219a0fde', '1515934751635-c81c6bc9a2d8',
    '1532712938310-34cb3982ef74', '1469371670807-013ccf25f16a', '1583939003579-730e3918a45a',
    '1537633552985-df8429e8048b',
  ],
  venue: [
    '1519225421980-715cb0215aed', '1464366400600-7168b8af9bc3', '1469371670807-013ccf25f16a',
    '1530023367847-a683933f4172', '1513278974582-3e1b4a4fa21e', '1522673607200-164d1b6ce486',
    '1511795409834-ef04bbd61622',
  ],
  flowers: [
    '1525258946800-98cfd641d0de', '1515934751635-c81c6bc9a2d8', '1469371670807-013ccf25f16a',
    '1511795409834-ef04bbd61622', '1519225421980-715cb0215aed',
  ],
  party: [
    '1470229722913-7c0e2dbbafd3', '1516450360452-9312f5e86fc7', '1511285560929-80b456fea0bc',
    '1527529482837-4698179dc6ce', '1517457373958-b7bdd4587205',
  ],
  beauty: ['1487412947147-5cebf100ffc2', '1522337360788-8b13dee7a37e'],
  dress: ['1594552072238-b8a33785b261', '1591604466107-ec97de577aff', '1541250848049-b4f7141dca3f'],
  rings: ['1605100804763-247f67b3557e', '1606800052052-a08af7148866', '1511795409834-ef04bbd61622'],
};

type Pool = keyof typeof PHOTOS;
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]!;
const rotate = <T,>(arr: T[], n: number, start: number) => Array.from({ length: n }, (_, i) => pick(arr, start + i));

type DemoVendor = {
  name: string;
  category: string;
  regions: RegionSlug[];
  from: number;
  to?: number;
  pool: Pool;
  about: string;
  featured?: boolean;
  packages: [string, number, string[]][];
};

const ABOUT_TAIL = 'אנחנו מאמינים שכל חתונה צריכה להרגיש אישית, רגועה ומדויקת — מהפגישה הראשונה ועד הרגע האחרון של הערב.';

const VENDORS: DemoVendor[] = [
  { name: 'אור ולבן צילום', category: 'photography', regions: ['center', 'tel_aviv', 'sharon'], from: 9000, to: 16000, pool: 'couple', featured: true,
    about: 'צילום חתונות בגישה דוקומנטרית ועדינה. אור טבעי, רגעים אמיתיים ואלבומים שנשארים לנצח.',
    packages: [['חבילת יום מלא', 12500, ['צלם ראשי ועוזר', 'עד 900 תמונות ערוכות', 'גלריה דיגיטלית']], ['חבילת פרימיום', 16000, ['שני צלמים', 'אלבום מעוצב 40 עמודים', 'צילומי טרום חתונה']]] },
  { name: 'סטודיו נגטיב', category: 'photography', regions: ['jerusalem', 'shfela'], from: 7000, to: 12000, pool: 'couple',
    about: 'סטודיו לצילום אירועים עם עין קולנועית. אנחנו מספרים את הסיפור שלכם בתמונות נקיות ונצחיות.',
    packages: [['בסיסית', 7000, ['צלם אחד', '600 תמונות']], ['מורחבת', 11000, ['שני צלמים', 'אלבום']]] },
  { name: 'רגעים — צילום חתונות', category: 'photography', regions: ['north', 'haifa'], from: 6500, to: 11000, pool: 'couple',
    about: 'צילום חתונות בצפון כבר 12 שנה. מתמחים באירועי חוץ, גנים ושקיעות על רקע הנוף.',
    packages: [['קלאסית', 8000, ['צלם ראשי', 'גלריה דיגיטלית']]] },
  { name: 'פריים וידאו', category: 'video', regions: ['center', 'tel_aviv'], from: 8000, to: 14000, pool: 'couple', featured: true,
    about: 'סרטי חתונה קולנועיים, קליפ היילייטס של 4 דקות וסרט מלא. רחפן כלול בכל חבילה.',
    packages: [['קליפ + סרט מלא', 11000, ['צלם וידאו ועוזר', 'רחפן', 'קליפ 4 דקות']], ['קולנועית', 14000, ['שני צלמי וידאו', 'סרט דוקומנטרי']]] },
  { name: 'מומנטס סושיאל', category: 'social', regions: ['center', 'tel_aviv', 'sharon', 'shfela'], from: 2500, to: 4500, pool: 'party',
    about: 'צילום סושיאל לחתונות: סטוריז ורילז בזמן אמת, כדי שכולם ירגישו שהם שם.',
    packages: [['סטוריז לאורך הערב', 2500, ['עד 5 שעות', 'סטוריז בזמן אמת']], ['רילז + סטוריז', 4500, ['3 רילז ערוכים', 'מסירה תוך 24 שעות']]] },
  { name: 'גן הזית', category: 'venue', regions: ['shfela', 'center'], from: 180000, to: 320000, pool: 'venue', featured: true,
    about: 'גן אירועים בין עצי זית עתיקים, עד 650 אורחים. מטבח שף כשר למהדרין ורחבת ריקודים מקורה.',
    packages: [['חבילת מנה', 320000, ['קבלת פנים', 'מנה עיקרית לבחירה', 'בר משקאות קלים']]] },
  { name: 'אחוזת הים', category: 'venue', regions: ['sharon', 'tel_aviv'], from: 220000, to: 400000, pool: 'venue',
    about: 'אולם אירועים על קו המים עם חופה מול השקיעה. עד 500 אורחים, חניה צמודה ושירות עד הפרט האחרון.',
    packages: [['חבילת זהב', 400000, ['חופה על הים', 'תפריט שף', 'הגברה ותאורה בסיסית']]] },
  { name: 'לופט 45', category: 'venue', regions: ['tel_aviv'], from: 120000, to: 220000, pool: 'venue',
    about: 'לופט אורבני בלב העיר לחתונות קטנות ובינוניות, עד 220 אורחים. אווירה של מסיבה ועיצוב נקי.',
    packages: [['ערב בלופט', 150000, ['קייטרינג שף', 'בר אלכוהול מלא']]] },
  { name: 'חצר בהרים', category: 'venue', regions: ['jerusalem'], from: 140000, to: 260000, pool: 'venue',
    about: 'חצר אבן ירושלמית מוקפת ירק, עד 400 אורחים. חופה תחת כיפת השמיים ומטבח כשר.',
    packages: [['חבילה מלאה', 230000, ['חופה', 'ארוחת ערב', 'עיצוב בסיסי']]] },
  { name: 'DJ איתי בן דוד', category: 'dj', regions: ['center', 'tel_aviv', 'sharon', 'shfela'], from: 6000, to: 9500, pool: 'party', featured: true,
    about: 'די ג׳יי חתונות שקורא את הרחבה. מזרחית, היפ הופ, האוס ושירים שכולם מכירים — בדיוק במינון הנכון.',
    packages: [['ערב מלא', 7500, ['הגברה ותאורה', 'מיקס כניסה לחופה']], ['פרימיום', 9500, ['עשן כבד', 'תאורה חכמה', 'MC']]] },
  { name: 'סאונד סיסטם', category: 'dj', regions: ['north', 'haifa'], from: 5000, to: 8000, pool: 'party',
    about: 'הגברה, תאורה ודי ג׳יי לאירועים בצפון. ציוד מקצועי ותכנון פלייליסט משותף מראש.',
    packages: [['בסיסית', 5000, ['DJ', 'הגברה']]] },
  { name: 'מאיה — איפור כלות', category: 'makeup', regions: ['center', 'tel_aviv', 'sharon'], from: 1800, to: 3200, pool: 'beauty', featured: true,
    about: 'איפור כלות טבעי ועמיד שמחזיק מהצילומים ועד הריקוד האחרון. כולל ניסיון איפור.',
    packages: [['איפור כלה', 2200, ['ניסיון איפור', 'ריסים', 'טאצ׳ לפני החופה']], ['כלה + אמהות', 3200, ['איפור כלה', 'שני איפורי ערב']]] },
  { name: 'גלואו סטודיו', category: 'makeup', regions: ['jerusalem', 'shfela'], from: 1500, to: 2600, pool: 'beauty',
    about: 'סטודיו לאיפור ושיער לכלות. מגיעות עד הבית או למלון ההתארגנות.',
    packages: [['כלה', 1800, ['ניסיון', 'איפור יום החתונה']]] },
  { name: 'שיער — נוי אלמוג', category: 'hair', regions: ['center', 'tel_aviv'], from: 1200, to: 2400, pool: 'beauty',
    about: 'תסרוקות כלה רכות ואלגנטיות, אסופים נמוכים ושיער פזור עם נפח שמחזיק כל הערב.',
    packages: [['תסרוקת כלה', 1500, ['ניסיון תסרוקת', 'אביזרים']]] },
  { name: 'אטלייה לבן', category: 'dresses', regions: ['tel_aviv', 'center'], from: 9000, to: 22000, pool: 'dress', featured: true,
    about: 'אטלייה לשמלות כלה בעיצוב אישי ובהשכרה. בדים מאירופה, תפירה מדויקת ושלוש מדידות.',
    packages: [['השכרה', 9000, ['שלוש מדידות', 'ניקוי']], ['עיצוב אישי', 22000, ['שמלה בתפירה אישית', 'הינומה']]] },
  { name: 'בית הכלה', category: 'dresses', regions: ['jerusalem', 'shfela', 'south'], from: 6000, to: 15000, pool: 'dress',
    about: 'שמלות כלה בהשכרה ובמכירה, קולקציה חדשה מדי עונה ויחס אישי לכל כלה.',
    packages: [['השכרה', 6000, ['מדידות', 'התאמות']]] },
  { name: 'חליפות גבריאל', category: 'suits', regions: ['tel_aviv', 'center', 'sharon'], from: 2500, to: 6500, pool: 'couple',
    about: 'חליפות חתן בתפירה אישית ובמידות מוכנות. בדים איטלקיים ושלוש מדידות כלולות.',
    packages: [['חליפה מוכנה', 2500, ['התאמות']], ['תפירה אישית', 6500, ['שלוש מדידות', 'עניבה וחפתים']]] },
  { name: 'פלורה עיצוב ופרחים', category: 'flowers', regions: ['center', 'tel_aviv', 'sharon'], from: 6000, to: 25000, pool: 'flowers', featured: true,
    about: 'עיצוב פרחים לחופה, לשולחנות ולזר הכלה. פרחי עונה טריים וקומפוזיציות שקטות ואלגנטיות.',
    packages: [['זר כלה + חופה', 6000, ['זר כלה', 'עיצוב חופה']], ['עיצוב מלא', 25000, ['חופה', 'מרכזי שולחן', 'שולחן קבלת פנים']]] },
  { name: 'בוטניקה', category: 'flowers', regions: ['jerusalem', 'shfela'], from: 4500, to: 18000, pool: 'flowers',
    about: 'סטודיו פרחים בהשראת טבע פראי. ירוק, לבן ומרקמים עשירים בכל עיצוב.',
    packages: [['חופה', 4500, ['עיצוב חופה']]] },
  { name: 'סטודיו קנבס עיצוב אירועים', category: 'design', regions: ['center', 'tel_aviv', 'shfela'], from: 12000, to: 40000, pool: 'venue',
    about: 'עיצוב אירועים מקצה לקצה: קונספט, תאורה, טקסטיל ופרחים. מינימליזם חם ויוקרתי.',
    packages: [['קונספט ועיצוב', 20000, ['תכנון קונספט', 'תאורה', 'מרכזי שולחן']]] },
  { name: 'נעמה — הפקת אירועים', category: 'production', regions: ['center', 'tel_aviv', 'sharon', 'jerusalem'], from: 8000, to: 20000, pool: 'venue', featured: true,
    about: 'מפיקת חתונות עם 10 שנות ניסיון. ליווי מלא מהתקציב ועד יום האירוע, כדי שאתם רק תיהנו.',
    packages: [['ניהול יום האירוע', 8000, ['תיאום ספקים ביום האירוע', 'לוח זמנים']], ['הפקה מלאה', 20000, ['ליווי מלא', 'בניית תקציב', 'בחירת ספקים']]] },
  { name: 'בר על גלגלים', category: 'alcohol', regions: ['center', 'tel_aviv', 'sharon', 'shfela'], from: 9000, to: 20000, pool: 'party',
    about: 'בר אלכוהול נייד עם ברמנים מקצועיים, קוקטיילים בהתאמה אישית ובר וויסקי.',
    packages: [['בר בסיסי', 9000, ['שני ברמנים', 'אלכוהול ל־250 אורחים']]] },
  { name: 'טבעות אמה', category: 'rings', regions: ['tel_aviv', 'center'], from: 3000, to: 15000, pool: 'rings',
    about: 'טבעות נישואין ואירוסין בעבודת יד. זהב ממוחזר ויהלומי מעבדה בעיצוב נקי ונצחי.',
    packages: [['זוג טבעות זהב', 4500, ['חריטה אישית', 'אחריות לכל החיים']]] },
  { name: 'הרב יונתן לוי', category: 'officiant', regions: ['center', 'jerusalem', 'shfela', 'sharon'], from: 1500, to: 3000, pool: 'couple',
    about: 'עריכת חופה וקידושין בגישה חמה, מכילה ומותאמת לזוג. פגישת היכרות לפני החתונה.',
    packages: [['עריכת חופה', 1800, ['פגישת היכרות', 'כתובה']]] },
  { name: 'הסעות שחר', category: 'transportation', regions: ['center', 'sharon', 'shfela', 'jerusalem', 'south'], from: 1800, to: 6000, pool: 'party',
    about: 'הסעות לאורחים באוטובוסים ומיניבוסים חדשים, נהגים מקצועיים ותיאום מלא מול האולם.',
    packages: [['אוטובוס הלוך ושוב', 2200, ['50 מקומות', 'נהג מקצועי']]] },
];

const REVIEW_TEXTS = [
  'היו פשוט מושלמים. מקצועיים, רגועים וזמינים לכל שאלה. ממליצים בחום!',
  'עבודה מדהימה, התוצאה עלתה על כל הציפיות שלנו. תודה ענקית.',
  'שירות אישי ומוקפד. הרגשנו בידיים טובות מהרגע הראשון.',
  'יחס חם, דייקנות ותוצאה מרגשת. כל האורחים שאלו עליהם.',
  'הכל היה מסודר ובזמן. היה שווה כל שקל.',
  'קצת התעכבו בתשובות לפני החתונה, אבל ביום עצמו היו מעולים.',
];

async function wipe() {
  await db.transaction(async (tx) => {
    const demoUsers = await tx.select({ id: user.id }).from(user).where(like(user.email, '%@demo.soon'));
    const ids = demoUsers.map((u) => u.id);
    const weddings = ids.length
      ? await tx.select({ id: weddingMember.weddingId }).from(weddingMember).where(inArray(weddingMember.userId, ids))
      : [];
    if (ids.length) await tx.delete(user).where(inArray(user.id, ids)); // cascades to vendors and their data
    if (weddings.length) {
      const wids = weddings.map((w) => w.id);
      // Leads at non-demo vendors keep the couple's name once the wedding is gone (lead_has_client_ck).
      await tx
        .update(lead)
        .set({
          clientName: sql`(select ${wedding.partner1Name} || ' ו' || ${wedding.partner2Name} from ${wedding} where ${wedding.id} = ${lead.weddingId})`,
        })
        .where(and(inArray(lead.weddingId, wids), isNull(lead.clientName)));
      await tx.delete(wedding).where(inArray(wedding.id, wids));
    }
  });
}

async function createUser(email: string, name: string, role: 'couple' | 'vendor') {
  const id = randomUUID();
  await db.insert(user).values({ id, email, name, role, emailVerified: true });
  // Better Auth's email+password login reads the 'credential' account row.
  await db.insert(account).values({
    id: randomUUID(), userId: id, accountId: id, providerId: 'credential', password: demoPasswordHash, updatedAt: new Date(),
  });
  return id;
}

/** Wipe and recreate all demo data. Returns a one-line summary. */
export async function seedDemo(): Promise<string> {
  demoPasswordHash ||= await hashPassword(DEMO_PASSWORD);
  await wipe();
  const today = todayIso();
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000);

  // ---- vendors ----
  const vendorIds: string[] = [];
  for (const [i, v] of VENDORS.entries()) {
    const email = i === 0 ? 'vendor@demo.soon' : `vendor${i}@demo.soon`;
    const ownerId = await createUser(email, v.name, 'vendor');
    const photos = rotate(PHOTOS[v.pool], 6, i);
    const [row] = await db
      .insert(vendor)
      .values({
        ownerUserId: ownerId,
        businessName: v.name,
        slug: `demo${String(i).padStart(2, '0')}`,
        categorySlug: v.category,
        status: 'approved',
        submittedAt: daysAgo(30 + i * 3),
        reviewedAt: daysAgo(20 + i * 3),
        about: `${v.about}\n\n${ABOUT_TAIL}`,
        phone: `05${(20000000 + i * 1234567).toString().slice(0, 8)}`,
        email,
        instagramUrl: 'https://instagram.com/',
        coverUrl: img(photos[0]!),
        logoUrl: img(photos[1]!, 300),
        priceFromAgorot: v.from * 100,
        priceToAgorot: (v.to ?? v.from) * 100,
        cancellationPolicy: 'ביטול עד 90 יום לפני האירוע ללא עלות. לאחר מכן המקדמה אינה מוחזרת.',
        isFeatured: Boolean(v.featured),
      })
      .returning({ id: vendor.id });
    const vendorId = row!.id;
    vendorIds.push(vendorId);
    await db.insert(vendorRegion).values(v.regions.map((region) => ({ vendorId, region })));
    await db.insert(vendorMedia).values(photos.slice(1).map((p, j) => ({ vendorId, url: img(p), sortOrder: j })));
    await db.insert(vendorPackage).values(
      v.packages.map(([name, price, includes], j) => ({ vendorId, name, priceAgorot: price * 100, includes, sortOrder: j })),
    );
    await db.insert(vendorFaq).values([
      { vendorId, question: 'האם אתם מגיעים לכל הארץ?', answer: 'כן, בתוספת נסיעות מחוץ לאזורי השירות שלנו.', sortOrder: 0 },
      { vendorId, question: 'כמה זמן מראש כדאי לסגור?', answer: 'מומלץ 8–12 חודשים לפני, במיוחד בעונת החתונות.', sortOrder: 1 },
    ]);
    // Half a year of profile views (gently growing) for the statistics screen.
    await db.insert(vendorStatDaily).values(
      Array.from({ length: 182 }, (_, d) => ({
        vendorId,
        day: addDays(today, -d),
        views: 6 + ((i * 7 + d * 13) % 28) + Math.floor((182 - d) / 9),
      })),
    );
  }

  // Two storefronts waiting in the admin queue.
  for (const [j, name] of ['סטודיו אלה לצילום', 'DJ רון כהן'].entries()) {
    const ownerId = await createUser(`pending${j}@demo.soon`, name, 'vendor');
    const [row] = await db
      .insert(vendor)
      .values({
        ownerUserId: ownerId,
        businessName: name,
        slug: `demop${j}`,
        categorySlug: j === 0 ? 'photography' : 'dj',
        status: 'pending',
        submittedAt: daysAgo(1 + j),
        about: 'עסק חדש ב־SOON. ' + ABOUT_TAIL,
        phone: '0501234567',
        coverUrl: img(j === 0 ? PHOTOS.couple[3]! : PHOTOS.party[1]!),
        priceFromAgorot: 500000,
        priceToAgorot: 900000,
      })
      .returning({ id: vendor.id });
    await db.insert(vendorRegion).values({ vendorId: row!.id, region: 'center' });
    await db
      .insert(vendorMedia)
      .values(rotate(PHOTOS.couple, 3, j).map((p, k) => ({ vendorId: row!.id, url: img(p), sortOrder: k })));
  }

  // ---- reviewer couples (verified reviews come from booked leads) ----
  const reviewerNames: [string, string][] = [
    ['שירה', 'דניאל'], ['מיכל', 'עומר'], ['יעל', 'אורי'], ['תמר', 'נדב'], ['רוני', 'גיל'], ['הילה', 'אלון'],
  ];
  for (const [r, [p1, p2]] of reviewerNames.entries()) {
    const uid = await createUser(`reviewer${r}@demo.soon`, `${p1} ו${p2}`, 'couple');
    const [w] = await db
      .insert(wedding)
      .values({ partner1Name: p1, partner2Name: p2, weddingDate: addDays(today, -40 - r * 25), region: 'center' })
      .returning();
    await db.insert(weddingMember).values({ weddingId: w!.id, userId: uid });
    for (const [k, vendorId] of vendorIds.entries()) {
      if ((k + r) % 3 === 0) continue; // not everyone reviews everyone
      const rating = (k + r) % 7 === 0 ? 4 : 5 - ((k * r) % 2);
      await db.insert(lead).values({ vendorId, weddingId: w!.id, status: 'completed', eventDate: w!.weddingDate });
      await db.insert(review).values({
        vendorId,
        weddingId: w!.id,
        authorUserId: uid,
        rating,
        ratingProfessionalism: Math.min(5, rating + ((k + 1) % 2)),
        ratingService: rating,
        ratingAvailability: Math.max(3, rating - (k % 2)),
        ratingValue: rating,
        body: pick(REVIEW_TEXTS, k + r),
        verified: true,
        createdAt: daysAgo(30 + r * 20 - (k % 10)),
      });
    }
  }

  // ---- the demo couple ----
  const coupleId = await createUser('couple@demo.soon', 'נועה כהן', 'couple');
  const weddingDate = addDays(today, 214);
  const [w] = await db
    .insert(wedding)
    .values({
      partner1Name: 'נועה',
      partner2Name: 'איתי',
      weddingDate,
      region: 'center',
      venueName: 'גן הזית',
      budgetTotalAgorot: 220_000_00,
      coverImageUrl: img(PHOTOS.couple[1]!, 1400),
    })
    .returning();
  const weddingId = w!.id;
  await db.insert(weddingMember).values({ weddingId, userId: coupleId });
  await db.insert(weddingCategory).values([
    { weddingId, categorySlug: 'venue', status: 'closed' },
    { weddingId, categorySlug: 'dresses', status: 'closed' },
    { weddingId, categorySlug: 'social', status: 'closed' },
    ...['photography', 'video', 'dj', 'makeup', 'hair', 'flowers'].map((slug) => ({
      weddingId,
      categorySlug: slug,
      status: 'needed' as const,
    })),
  ]);
  await db.transaction((tx) => syncChecklist(tx, w!));

  const [photographer, , , videographer, , venue, , , , dj, , makeup] = vendorIds;
  await db.insert(savedVendor).values(
    [photographer!, videographer!, dj!, makeup!, vendorIds[17]!].map((vendorId) => ({ weddingId, vendorId, savedByUserId: coupleId })),
  );

  // Booked: the venue. In talks: the photographer (proposal) and the DJ (new).
  const [venueLead] = await db
    .insert(lead)
    .values({ vendorId: venue!, weddingId, status: 'booked', eventDate: weddingDate, guestCount: 350, quotedPriceAgorot: 280_000_00 })
    .returning();
  const [photoLead] = await db
    .insert(lead)
    .values({
      vendorId: photographer!,
      weddingId,
      status: 'proposal',
      eventDate: weddingDate,
      guestCount: 350,
      location: 'גן הזית',
      quotedPriceAgorot: 13_500_00,
      nextAction: 'לשלוח הצעת מחיר מעודכנת',
      nextActionAt: daysAgo(-2),
    })
    .returning();
  const [djLead] = await db
    .insert(lead)
    .values({ vendorId: dj!, weddingId, status: 'new', eventDate: weddingDate, guestCount: 350 })
    .returning();

  // Conversations.
  const ownerOf = async (vendorId: string) =>
    (await db.select({ o: vendor.ownerUserId }).from(vendor).where(inArray(vendor.id, [vendorId])))[0]!.o;
  const threads: [string, string, [boolean, string, number][]][] = [
    [photographer!, photoLead!.id, [
      [true, 'היי! אנחנו מתחתנים בגן הזית ומאוד אהבנו את הגלריה שלכם. אתם פנויים בתאריך?', 72],
      [false, 'מזל טוב! כן, התאריך עדיין פנוי אצלנו. אשמח לקבוע שיחת היכרות.', 70],
      [true, 'מעולה. אפשר לקבל הצעת מחיר לחבילת יום מלא?', 48],
      [false, 'בטח, שלחתי לכם הצעה ל־13,500 ₪ כולל צלם עוזר. אשמח לשמוע מה דעתכם', 30],
    ]],
    [dj!, djLead!.id, [[true, 'שלום, מחפשים DJ לחתונה של 350 איש. מה הסגנון שלך?', 5]]],
    [venue!, venueLead!.id, [
      [true, 'נשמח לתאם פגישת טעימות', 200],
      [false, 'בשמחה! מה דעתכם על יום שלישי הבא בשש?', 199],
    ]],
  ];
  for (const [vendorId, leadId, msgs] of threads) {
    const owner = await ownerOf(vendorId);
    const last = msgs[msgs.length - 1]!;
    const [c] = await db
      .insert(conversation)
      .values({
        vendorId,
        weddingId,
        leadId,
        lastMessageAt: new Date(now - last[2] * 3_600_000),
        weddingReadAt: last[0] ? new Date(now - last[2] * 3_600_000) : null,
        vendorReadAt: last[0] ? null : new Date(now - last[2] * 3_600_000),
      })
      .returning();
    await db.insert(message).values(
      msgs.map(([fromCouple, body, hoursAgo]) => ({
        conversationId: c!.id,
        senderUserId: fromCouple ? coupleId : owner,
        body,
        createdAt: new Date(now - hoursAgo * 3_600_000),
      })),
    );
  }

  // Planning data.
  const items = await db
    .insert(budgetItem)
    .values([
      { weddingId, category: 'venue', title: 'גן הזית', vendorId: venue!, plannedAgorot: 120_000_00, actualAgorot: 128_000_00 },
      { weddingId, category: budgetCategoryForVendor('photography'), title: categoryLabel('photography'), plannedAgorot: 14_000_00 },
      { weddingId, category: 'dj', title: 'DJ', plannedAgorot: 8_000_00 },
      { weddingId, category: 'dress', title: 'שמלת כלה', plannedAgorot: 12_000_00 },
      { weddingId, category: 'flowers', title: 'פרחים ועיצוב', plannedAgorot: 15_000_00 },
      { weddingId, category: 'alcohol', title: 'בר אלכוהול', vendorName: 'ספק חיצוני', plannedAgorot: 12_000_00, actualAgorot: 11_000_00 },
    ])
    .returning();
  await db.insert(weddingPayment).values([
    { weddingId, budgetItemId: items[0]!.id, title: 'מקדמה לאולם', amountAgorot: 20_000_00, dueDate: addDays(today, -30), paidAt: daysAgo(30) },
    { weddingId, budgetItemId: items[0]!.id, title: 'תשלום שני לאולם', amountAgorot: 40_000_00, dueDate: addDays(today, 45) },
    { weddingId, budgetItemId: items[5]!.id, title: 'מקדמה לבר', amountAgorot: 2_000_00, dueDate: addDays(today, 10) },
  ]);
  const guests: [string, 'bride' | 'groom' | 'shared', 'invited' | 'confirmed' | 'declined' | 'waiting', number][] = [
    ['משפחת כהן', 'bride', 'confirmed', 4], ['משפחת לוי', 'groom', 'confirmed', 5], ['דנה ויואב', 'bride', 'waiting', 2],
    ['סבתא רחל', 'bride', 'confirmed', 1], ['חברים מהצבא', 'groom', 'invited', 8], ['משפחת אברהם', 'groom', 'declined', 3],
    ['צוות העבודה של נועה', 'bride', 'invited', 6], ['הדס ותומר', 'shared', 'confirmed', 2], ['משפחת מזרחי', 'groom', 'waiting', 4],
  ];
  await db.insert(guest).values(guests.map(([name, side, rsvp, partySize]) => ({ weddingId, name, side, rsvp, partySize })));
  const at = (days: number, hour: number) => new Date(`${addDays(today, days)}T${String(hour).padStart(2, '0')}:00:00+02:00`);
  await db.insert(weddingEvent).values([
    { weddingId, kind: 'tasting', title: 'טעימות בגן הזית', startsAt: at(1, 18), location: 'גן הזית', vendorId: venue! },
    { weddingId, kind: 'meeting', title: 'פגישה עם הצלם', startsAt: at(6, 19), vendorId: photographer! },
    { weddingId, kind: 'fitting', title: 'מדידת שמלה ראשונה', startsAt: at(20, 11) },
    { weddingId, kind: 'payment', title: 'תשלום שני לאולם', startsAt: at(45, 9) },
  ]);

  // ---- the demo vendor's business (vendor@demo.soon = the photographer) ----
  const clients: [string, string, string, number, number, string][] = [
    ['שני ועידו', '0521112233', 'meeting', 120, 12_000_00, 'ת"א'],
    ['ליאת ורועי', '0544445566', 'contacted', 160, 0, 'ראשון לציון'],
    ['אביגיל ומתן', '0537778899', 'booked', 45, 15_500_00, 'אחוזת הים'],
    ['קרן ואסף', '0509990011', 'booked', 75, 12_500_00, 'לופט 45'],
    ['דנה ושחר', '0581231234', 'new', 300, 0, 'ירושלים'],
    ['מור ויונתן', '0524564567', 'lost', 90, 11_000_00, 'חיפה'],
  ];
  for (const [i, [name, phone, status, inDays, price, location]] of clients.entries()) {
    const eventDate = addDays(today, inDays);
    const [l] = await db
      .insert(lead)
      .values({
        vendorId: photographer!,
        clientName: name,
        clientPhone: phone,
        source: 'manual',
        status: status as 'new',
        eventDate,
        location,
        quotedPriceAgorot: price || null,
        nextAction: status === 'meeting' ? 'פגישת היכרות בסטודיו' : status === 'new' ? 'לחזור עם זמינות' : null,
        nextActionAt: status === 'meeting' ? at(3, 18) : status === 'new' ? at(0, 12) : null,
        createdAt: daysAgo(i * 4 + 1),
        bookedAt: status === 'booked' ? daysAgo(i * 4) : null,
      })
      .returning();
    if (status === 'booked') {
      await db.insert(availabilityEntry).values({
        vendorId: photographer!,
        status: 'booked',
        kind: 'event',
        title: `חתונה — ${name}`,
        location,
        leadId: l!.id,
        startsAt: at(inDays, 17),
        endsAt: at(inDays, 23),
      });
      await db.insert(leadPayment).values([
        { leadId: l!.id, title: 'מקדמה', amountAgorot: Math.round(price * 0.3), dueDate: addDays(today, -10), paidAt: daysAgo(10) },
        { leadId: l!.id, title: 'יתרה', amountAgorot: price - Math.round(price * 0.3), dueDate: eventDate },
      ]);
    }
    if (status === 'meeting') {
      await db.insert(availabilityEntry).values({
        vendorId: photographer!, status: 'pending', kind: 'meeting', title: `פגישה — ${name}`, leadId: l!.id, startsAt: at(3, 18), endsAt: at(3, 19),
      });
    }
  }
  await db.insert(availabilityEntry).values([
    { vendorId: photographer!, status: 'unavailable', kind: 'personal', title: 'חופשה', startsAt: at(12, 0), endsAt: at(15, 0) },
    { vendorId: photographer!, status: 'available', kind: 'other', title: 'פנוי לצילומי טרום חתונה', startsAt: at(9, 10), endsAt: at(9, 14) },
  ]);

  // Make two vendors busy on the demo couple's date, so "booked" badges show up in search.
  for (const vendorId of [vendorIds[1]!, vendorIds[10]!]) {
    await db.insert(availabilityEntry).values({
      vendorId, status: 'booked', kind: 'event', title: 'חתונה', startsAt: at(214, 17), endsAt: at(214, 23),
    });
  }

  // Inspiration boards with a few pictures each (photos from the vendors' galleries).
  const boards = await db
    .insert(board)
    .values(STARTER_BOARDS.map((b, i) => ({ weddingId, title: b.title, coverUrl: b.cover, sortOrder: i })))
    .returning();
  const boardPics: [number, string[], string | undefined][] = [
    [0, [PHOTOS.couple[2]!, PHOTOS.couple[5]!, PHOTOS.couple[8]!], undefined],
    [1, PHOTOS.flowers.slice(0, 4), vendorIds[2]],
    [2, PHOTOS.venue.slice(0, 3), venue],
    [3, [PHOTOS.couple[0]!, PHOTOS.couple[3]!, PHOTOS.couple[6]!, PHOTOS.couple[9]!], photographer],
  ];
  for (const [bi, pics, vendorId] of boardPics) {
    await db.insert(boardItem).values(
      pics.map((id, k) => ({ boardId: boards[bi]!.id, imageUrl: img(id, 900), vendorId: vendorId ?? null, createdAt: daysAgo(20 - k) })),
    );
  }

  // More inquiries for the demo photographer, so every CRM column has someone in it.
  const extra: [string, 'new' | 'proposal' | 'contacted', number, number, string, string][] = [
    ['גל וניר', 'new', 179, 5_800_00, 'Essential', 'גני התערוכה'],
    ['יעל ועמיר', 'new', 144, 8_400_00, 'Signature', 'חוות רונית'],
    ['דנה ואיתי', 'contacted', 172, 8_400_00, 'Signature', 'הרמוניה בגן'],
    ['רוני ועומר', 'proposal', 230, 9_900_00, 'Signature', 'טרוי'],
  ];
  for (const [k, [name, status, inDays, price, pkg, location]] of extra.entries()) {
    await db.insert(lead).values({
      vendorId: photographer!,
      clientName: name,
      clientPhone: `05${k + 2}${String(1234567 + k * 111).slice(0, 7)}`,
      source: 'manual',
      status,
      eventDate: addDays(today, inDays),
      location,
      guestCount: 180 + k * 40,
      quotedPriceAgorot: price,
      notes: `מתעניינים בחבילת ${pkg}.`,
      nextAction: status === 'proposal' ? 'לחכות לתשובה על ההצעה' : status === 'new' ? 'לחזור עם זמינות ומחירון' : 'לקבוע פגישת היכרות',
      nextActionAt: at(k, 12),
      createdAt: daysAgo(k),
    });
  }

  // ---- round 2: history for statistics, finances and documents (the demo photographer) ----
  await db
    .update(vendor)
    .set({ taxId: '305123456', businessAddress: 'שדרות רוטשילד 45, תל אביב', plan: 'pro', planSince: daysAgo(64) })
    .where(eq(vendor.id, photographer!));

  // Completed and booked weddings over the last months: deposits at booking, balance at the event.
  const past: [string, number, number, number, string][] = [
    // name, event (days from today, negative = past), booked (days ago), price, location
    ['הילה ונדב', -150, 230, 11_500_00, 'יקב צרעה'],
    ['רותם ועידן', -118, 200, 12_900_00, 'הגן הבוטני'],
    ['שירה ואלון', -96, 170, 9_800_00, 'מתחם הנגרייה'],
    ['נוי ודניאל', -70, 150, 13_500_00, 'אחוזת ספיר'],
    ['מיכל ואורי', -41, 120, 10_900_00, 'בית יערה'],
    ['טל ויובל', -12, 95, 12_000_00, 'חוות רונית'],
    ['ליה ואיתמר', 60, 66, 14_200_00, 'מלון דן'],
    ['עדי ורון', 95, 38, 11_900_00, 'האחוזה במודיעין'],
    ['ספיר ועמית', 130, 19, 13_000_00, 'גני הדר'],
    ['אגם ונועם', 165, 6, 15_500_00, 'יער ירושלים'],
  ];
  const pastLeads: { id: string; name: string; price: number; event: string }[] = [];
  for (const [name, eventIn, bookedAgo, price, location] of past) {
    const eventDate = addDays(today, eventIn);
    const done = eventIn < 0;
    const [l] = await db
      .insert(lead)
      .values({
        vendorId: photographer!,
        clientName: name,
        clientPhone: `05${(name.length % 8) + 1}${String(7_654_321 - eventIn * 97).slice(0, 7)}`,
        source: 'manual',
        status: done ? 'completed' : 'booked',
        eventDate,
        location,
        guestCount: 180 + (price % 7) * 40,
        quotedPriceAgorot: price,
        createdAt: daysAgo(bookedAgo + 9),
        bookedAt: daysAgo(bookedAgo),
      })
      .returning();
    pastLeads.push({ id: l!.id, name, price, event: eventDate });
    const deposit = Math.round(price * 0.3);
    await db.insert(leadPayment).values([
      { leadId: l!.id, title: 'מקדמה', amountAgorot: deposit, dueDate: addDays(today, -bookedAgo), paidAt: daysAgo(bookedAgo) },
      done
        ? { leadId: l!.id, title: 'יתרה', amountAgorot: price - deposit, dueDate: eventDate, paidAt: daysAgo(-eventIn - 1) }
        : { leadId: l!.id, title: 'יתרה', amountAgorot: price - deposit, dueDate: eventDate },
    ]);
    if (!done) {
      await db.insert(availabilityEntry).values({
        vendorId: photographer!, status: 'booked', kind: 'event', title: `חתונה — ${name}`, location, leadId: l!.id,
        startsAt: at(eventIn, 17), endsAt: at(eventIn, 23),
      });
    }
  }
  // Inquiries that didn't close (they count in the conversion rates).
  const lostNames = ['קרן ושי', 'אור ויונתן', 'בר ודור', 'נטע ועומר', 'יעלי ואסף', 'מאיה וגיא', 'רוני ובן', 'הדר ואייל', 'שקד וטל'];
  for (const [k, name] of lostNames.entries()) {
    await db.insert(lead).values({
      vendorId: photographer!, clientName: name, source: 'app', status: k % 3 === 0 ? 'contacted' : 'lost',
      eventDate: addDays(today, 120 + k * 17), createdAt: daysAgo(8 + k * 9),
    });
  }
  // Couples who saved the photographer, spread over the weeks.
  const savers = await db.select({ weddingId: review.weddingId }).from(review).where(eq(review.vendorId, photographer!));
  for (const [k, sv] of savers.entries()) {
    await db.insert(savedVendor).values({ weddingId: sv.weddingId, vendorId: photographer!, createdAt: daysAgo(4 + k * 13) }).onConflictDoNothing();
  }

  // Business expenses (some with a receipt).
  const receipt = img(PHOTOS.party[3]!, 900);
  const expenses: [string, number, number, string, boolean][] = [
    ['עדשה Sony 85mm', 6_490_00, 140, 'equipment', true],
    ['כרטיסי זיכרון ×4', 720_00, 120, 'equipment', true],
    ['קמפיין ממומן באינסטגרם', 1_200_00, 95, 'marketing', false],
    ['צלם עוזר — חתונת נוי ודניאל', 1_400_00, 70, 'staff', true],
    ['דלק ונסיעות — אוקטובר', 860_00, 45, 'travel', false],
    ['Adobe Lightroom + Photoshop', 89_00, 33, 'software', false],
    ['אלבומים מודפסים ×3', 2_250_00, 28, 'equipment', true],
    ['צלם עוזר — חתונת מיכל ואורי', 1_400_00, 41, 'staff', false],
    ['שכירות סטודיו — נובמבר', 2_800_00, 18, 'office', true],
    ['דלק ונסיעות — נובמבר', 640_00, 9, 'travel', false],
    ['קמפיין ממומן בפייסבוק', 900_00, 5, 'marketing', false],
    ['Adobe Lightroom + Photoshop', 89_00, 3, 'software', false],
  ];
  await db.insert(vendorExpense).values(
    expenses.map(([title, amount, ago, category, hasReceipt]) => ({
      vendorId: photographer!, title, amountAgorot: amount, spentOn: addDays(today, -ago), category, receiptUrl: hasReceipt ? receipt : null,
    })),
  );

  // Documents issued to clients.
  const docs: [string, number, string, number, string][] = [
    ['receipt', 1, pastLeads[3]!.name, Math.round(pastLeads[3]!.price * 0.3), 'מקדמה לצילום חתונה'],
    ['receipt', 2, pastLeads[4]!.name, Math.round(pastLeads[4]!.price * 0.3), 'מקדמה לצילום חתונה'],
    ['receipt', 3, pastLeads[5]!.name, pastLeads[5]!.price - Math.round(pastLeads[5]!.price * 0.3), 'יתרה לצילום חתונה'],
    ['quote', 1, 'רוני ועומר', 9_900_00, 'חבילת Signature — צילום יום מלא'],
    ['payment_request', 1, pastLeads[6]!.name, pastLeads[6]!.price - Math.round(pastLeads[6]!.price * 0.3), 'יתרה לצילום חתונה'],
  ];
  for (const [k, [kind, number, clientName, amount, description]] of docs.entries()) {
    const linked = pastLeads.find((pl) => pl.name === clientName);
    await db.insert(clientDocument).values({
      vendorId: photographer!, kind, number, issuedOn: addDays(today, -60 + k * 12), leadId: linked?.id ?? null,
      clientName, description, amountAgorot: amount, paymentMethod: kind === 'receipt' ? (k % 2 ? 'bit' : 'transfer') : null,
    });
  }

  // The couple's playlist.
  const songs: [string, string, string, string?][] = [
    ['reception', 'Fly Me to the Moon', 'Frank Sinatra'],
    ['reception', 'La Vie en Rose', 'Louis Armstrong'],
    ['reception', 'בואי', 'עידן רייכל'],
    ['chuppah_entry', 'A Thousand Years', 'Christina Perri', 'כניסת הכלה — מהפזמון'],
    ['chuppah_entry', 'אם ננעלו', 'נעמי שמר'],
    ['chuppah_exit', 'סימן טוב ומזל טוב', 'מסורתי'],
    ['first_dance', 'Perfect', 'Ed Sheeran'],
    ['dancing', 'Uptown Funk', 'Mark Ronson ft. Bruno Mars'],
    ['dancing', 'יש לי סיבה', 'הדג נחש'],
    ['dancing', 'Shut Up and Dance', 'Walk the Moon'],
    ['dancing', 'מלכת השושנים', 'עומר אדם'],
    ['closing', 'Time of My Life', 'Bill Medley & Jennifer Warnes'],
  ];
  await db.insert(weddingSong).values(
    songs.map(([stage, title, artist, note], k) => ({ weddingId, stage, title, artist, note: note ?? null, sortOrder: k })),
  );

  return `Seeded ${VENDORS.length} vendors, 2 pending, ${reviewerNames.length} reviewer couples, demo couple + vendor.`;
}
