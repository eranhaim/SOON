import { Linking } from 'react-native';

/** Israeli mobile/landline to international digits for wa.me (05x-xxxxxxx → 9725xxxxxxxx). */
export function toWhatsAppNumber(phone: string): string | null {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `972${d.slice(1)}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** Opens a WhatsApp chat with the number (app on phones, web elsewhere). Returns false if the number is invalid. */
export async function openWhatsApp(phone: string, text?: string): Promise<boolean> {
  const n = toWhatsAppNumber(phone);
  if (!n) return false;
  const url = `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  await Linking.openURL(url);
  return true;
}
