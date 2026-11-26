import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.url(),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 chars'),
  WEB_ORIGINS: z
    .string()
    .default('http://localhost:8081')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  /** Demo server: enables POST /api/demo/reset (demo accounts only). */
  DEMO_TOOLS: flag,
  /** Upay (Israeli card clearing). Without both, payments run in test mode (no real money). */
  UPAY_EMAIL: optional,
  /** Upay account password (API mode: server-to-server payment pages, saved cards). */
  UPAY_PASSWORD: optional,
  UPAY_KEY: optional,
  /** Use Upay's demo system (demo.upay.co.il). */
  UPAY_DEMO: flag,
  /** Allow the built-in test payment page when Upay is not configured. */
  PAYMENTS_TEST_MODE: flag,
  /** Enables AI-written invitations (Claude). Without it a built-in writer is used. */
  ANTHROPIC_API_KEY: optional,
  /** Comma-separated emails that get the admin role. */
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),

  // S3-compatible object storage (Vultr). Uploads are disabled if any are missing.
  S3_ENDPOINT: optional,
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: optional,
  S3_ACCESS_KEY: optional,
  S3_SECRET_KEY: optional,
  /** Public base URL for objects, e.g. https://ams1.vultrobjects.com/soon-media */
  S3_PUBLIC_BASE_URL: optional,
  /** Key prefix separating environments: dev / prod. */
  STORAGE_PREFIX: z.string().default('dev'),

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  APPLE_CLIENT_ID: optional,
  APPLE_CLIENT_SECRET: optional,
  APPLE_APP_BUNDLE_IDENTIFIER: optional,
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:\n', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === 'development';
