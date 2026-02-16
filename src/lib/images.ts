import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { config } from './config';
import { createHash } from 'crypto';

const s3 = new S3Client({
  endpoint: config.minio.endpoint,
  region: 'us-east-1', // required but unused by MinIO
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.minio.accessKey ?? '',
    secretAccessKey: config.minio.secretKey ?? '',
  },
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const IMAGE_TIMEOUT = 10_000;

let bucketEnsured = false;
let bucketFailed = false;

export async function ensureBucket(): Promise<void> {
  if (bucketEnsured || bucketFailed) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
    bucketEnsured = true;
  } catch (headErr: unknown) {
    // If it's a network error, mark as failed and stop retrying
    if (headErr instanceof Error && ('code' in headErr) && (headErr as NodeJS.ErrnoException).code === 'ENETUNREACH') {
      console.warn('[images] MinIO unreachable, disabling image downloads for this session');
      bucketFailed = true;
      return;
    }
    try {
      await s3.send(new CreateBucketCommand({ Bucket: config.minio.bucket }));
      // Set public-read policy
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${config.minio.bucket}/*`],
          },
        ],
      });
      // MinIO supports PutBucketPolicy via raw S3 API
      const policyRes = await fetch(
        `${config.minio.endpoint}/${config.minio.bucket}/?policy`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: policy,
        },
      );
      if (!policyRes.ok) {
        console.warn(`[images] Failed to set bucket policy: ${policyRes.status}`);
      }
      bucketEnsured = true;
      console.log(`[images] Created bucket: ${config.minio.bucket}`);
    } catch (err) {
      console.error('[images] Failed to create bucket:', err);
    }
  }
}

function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
  };
  return map[contentType] || 'jpg';
}

export async function downloadArticleImage(
  url: string,
  articleId: number,
): Promise<string | null> {
  if (bucketFailed) return null;
  try {
    await ensureBucket();

    const res = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Kaiwa/1.0)',
      },
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;

    const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
    if (contentLength > MAX_IMAGE_SIZE) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_IMAGE_SIZE) return null;

    const hash = createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const ext = getExtension(contentType);
    const key = `articles/${articleId}-${hash}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: config.minio.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return `${config.minio.publicUrl}/${key}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[images] Failed to download image for article ${articleId}: ${message}`);
    return null;
  }
}
