import type { FastifyInstance } from 'fastify';

import { uploadRequestSchema, type UploadPurpose } from '@soon/shared';

import { parseBody, requireOwnVendor } from '../session';
import { storage } from '../storage';

const FOLDER: Record<UploadPurpose, string> = {
  'vendor-cover': 'cover',
  'vendor-logo': 'logo',
  'vendor-gallery': 'gallery',
};

export function vendorScope(vendorId: string) {
  return `vendors/${vendorId}`;
}

export async function uploadRoutes(app: FastifyInstance) {
  /**
   * Issues a presigned PUT URL. The app uploads the file straight to object storage,
   * then saves the returned publicUrl via the vendor endpoints (which verify ownership).
   */
  app.post('/api/uploads', async (request, reply) => {
    if (!storage.enabled) return reply.status(503).send({ error: 'Uploads are not configured' });
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const body = await parseBody(uploadRequestSchema, request.body, reply);
    if (!body) return;

    const key = storage.newKey(`${vendorScope(ctx.vendor.id)}/${FOLDER[body.purpose]}`, body.contentType);
    return storage.presignPut(key, body.contentType);
  });
}
