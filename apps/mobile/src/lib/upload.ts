import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { UploadPurpose, UploadTicket } from '@soon/shared';

import { api } from './api';

/** Longest side we keep. Big enough for a full-width cover on a desktop screen. */
const MAX_WIDTH = 2000;

/** Opens the photo library. Returns local URIs (empty if cancelled). */
export async function pickImages(opts: { multiple?: boolean; limit?: number } = {}): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: Boolean(opts.multiple),
    selectionLimit: opts.limit ?? 0,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => a.uri);
}

/**
 * Shrinks on-device (saves the user's data plan), uploads straight to object storage
 * with a presigned URL, and returns the public URL to save on the vendor.
 */
export async function uploadImage(uri: string, purpose: UploadPurpose): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri, { maxWidth: MAX_WIDTH }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
  const blob = await (await fetch(saved.uri)).blob();

  const ticket = await api<UploadTicket>('/api/uploads', {
    method: 'POST',
    json: { purpose, contentType: 'image/jpeg', size: blob.size },
  });
  const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: blob });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return ticket.publicUrl;
}

export type PickedMedia = { uri: string; kind: 'image' | 'video'; mimeType: string | null };

/** Photo library, images and videos together (portfolio). */
export async function pickMedia(opts: { limit?: number } = {}): Promise<PickedMedia[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: opts.limit ?? 0,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    uri: a.uri,
    kind: a.type === 'video' ? 'video' : 'image',
    mimeType: a.mimeType ?? null,
  }));
}

/** Uploads a file as-is (videos, PDFs). Images should go through uploadImage (resized). */
export async function uploadFile(uri: string, purpose: UploadPurpose, contentType: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const type = contentType || blob.type;
  const ticket = await api<UploadTicket>('/api/uploads', {
    method: 'POST',
    json: { purpose, contentType: type, size: blob.size },
  });
  const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: blob });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return ticket.publicUrl;
}
