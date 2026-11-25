import { Platform, Share } from 'react-native';

import { API_URL } from './config';
import { notify } from './confirm';

/** Public web address of a page in the app (the web app and the API share one origin in production). */
export function webUrl(path: string): string {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : API_URL;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The vendor's own link: /v/<slug>. Works without the app, e.g. in an Instagram bio. */
export const vendorLink = (slug: string) => webUrl(`/v/${slug}`);

/** Share sheet on phones; on the web, copy to the clipboard (Web Share where available). */
export async function shareLink(url: string, title: string, message?: string) {
  const text = message ? `${message}\n${url}` : url;
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      try {
        await nav.share({ title, text: message, url });
        return;
      } catch {
        // Cancelled or blocked: fall back to copying.
      }
    }
    await copyLink(url);
    return;
  }
  await Share.share({ message: text, url, title });
}

/** Copy on the web (browser clipboard); phones get the share sheet, which has "Copy". */
export async function copyLink(url: string) {
  if (Platform.OS !== 'web') {
    await Share.share({ message: url, url });
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    notify('הקישור הועתק', url);
  } catch {
    notify('העתיקו את הקישור', url);
  }
}

export function shareVendorLink(v: { slug: string; businessName: string }) {
  return shareLink(vendorLink(v.slug), v.businessName, `${v.businessName} ב־SOON`);
}
