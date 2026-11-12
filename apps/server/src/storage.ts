import { randomUUID } from 'node:crypto';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from './env';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const configured =
  env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY && env.S3_PUBLIC_BASE_URL;

const client = configured
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY!, secretAccessKey: env.S3_SECRET_KEY! },
    })
  : null;

const publicBase = env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? '';

export const storage = {
  enabled: Boolean(client),

  /** Key layout: <env>/<owner-scope>/<uuid>.<ext>, e.g. prod/vendors/<vendorId>/gallery/<uuid>.jpg */
  newKey(scope: string, contentType: string) {
    return `${env.STORAGE_PREFIX}/${scope}/${randomUUID()}.${EXT[contentType] ?? 'bin'}`;
  },

  publicUrl(key: string) {
    return `${publicBase}/${key}`;
  },

  /** Returns the key if `url` is one of our public URLs under `scope`, else null. */
  keyIfOwned(url: string, scope: string): string | null {
    const prefix = `${publicBase}/${env.STORAGE_PREFIX}/${scope}/`;
    if (!url.startsWith(prefix)) return null;
    const key = url.slice(publicBase.length + 1);
    return /^[\w\-/.]+$/.test(key) && !key.includes('..') ? key : null;
  },

  /** Presigned PUT valid for 10 minutes. The client must send the same Content-Type. */
  async presignPut(key: string, contentType: string) {
    if (!client) throw new Error('Storage is not configured');
    const cmd = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 600 });
    return {
      uploadUrl,
      publicUrl: this.publicUrl(key),
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    };
  },

  /** Best-effort delete; never throws. */
  async remove(url: string, scope: string) {
    const key = this.keyIfOwned(url, scope);
    if (!client || !key) return;
    await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })).catch(() => undefined);
  },
};
