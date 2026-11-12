const url = process.env.EXPO_PUBLIC_API_URL;
if (!url) {
  throw new Error('EXPO_PUBLIC_API_URL is not set. Copy apps/mobile/.env.example to apps/mobile/.env');
}

export const API_URL = url.replace(/\/$/, '');
