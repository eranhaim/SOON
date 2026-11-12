/**
 * One-time / idempotent setup for the public media bucket.
 *   npx tsx --env-file=.env scripts/setup-storage.ts
 *
 * - creates S3_BUCKET if missing
 * - public-read policy (everything in this bucket is public portfolio media;
 *   private files like contracts will live in a separate private bucket)
 * - CORS so browsers can PUT directly with presigned URLs
 */
import {
  CreateBucketCommand,
  GetBucketCorsCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const bucket = must('S3_BUCKET');
const s3 = new S3Client({
  endpoint: must('S3_ENDPOINT'),
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: must('S3_ACCESS_KEY'), secretAccessKey: must('S3_SECRET_KEY') },
});

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'https://soon.64.176.175.97.nip.io',
  ...(process.env.EXTRA_CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
];

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

try {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`bucket ${bucket} exists`);
} catch {
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`bucket ${bucket} created`);
}

await s3.send(
  new PutBucketPolicyCommand({
    Bucket: bucket,
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    }),
  }),
);
console.log('public-read policy set');

await s3.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ALLOWED_ORIGINS,
          AllowedMethods: ['PUT', 'GET', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
const cors = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log('CORS origins:', cors.CORSRules?.[0]?.AllowedOrigins);
