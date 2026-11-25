import type { FastifyInstance } from 'fastify';

import { uploadRequestSchema, type UploadPurpose } from '@soon/shared';

import { parseBody, requireOwnVendor, requireWedding } from '../session';
import { storage } from '../storage';

const FOLDER: Record<UploadPurpose, string> = {
  'vendor-cover': 'cover',
  'vendor-logo': 'logo',
  'vendor-gallery': 'gallery',
  'vendor-video': 'video',
  'vendor-receipt': 'receipts',
  'wedding-cover': 'cover',
  'wedding-image': 'images',
};

export function vendorScope(vendorId: string) {
  return `vendors/${vendorId}`;
}

export function weddingScope(weddingId: string) {
  return `weddings/${weddingId}`;
}

export async function uploadRoutes(app: FastifyInstance) {
  /**
   * Issues a presigned PUT URL. The app uploads the file straight to object storage,
   * then saves the returned publicUrl via the owning endpoint (which verifies ownership).
   * Vendor purposes need the caller's own vendor; wedding purposes need the caller's wedding.
   */
  app.post('/api/uploads', async (request, reply) => {
    if (!storage.enabled) return reply.status(503).send({ error: 'Uploads are not configured' });
    const purpose = (request.body as { purpose?: unknown } | undefined)?.purpose;
    const isWedding = typeof purpose === 'string' && purpose.startsWith('wedding-');

    let scope: string;
    if (isWedding) {
      const ctx = await requireWedding(request, reply);
      if (!ctx) return;
      scope = weddingScope(ctx.wedding.id);
    } else {
      const ctx = await requireOwnVendor(request, reply);
      if (!ctx) return;
      scope = vendorScope(ctx.vendor.id);
    }

    const body = await parseBody(uploadRequestSchema, request.body, reply);
    if (!body) return;
    if (body.purpose.startsWith('wedding-') !== isWedding) return reply.status(400).send({ error: 'Bad purpose' });

    const key = storage.newKey(`${scope}/${FOLDER[body.purpose]}`, body.contentType);
    return storage.presignPut(key, body.contentType);
  });
}
