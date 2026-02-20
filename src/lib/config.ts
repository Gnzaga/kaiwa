import { readFileSync } from 'fs';

function loadVaultSecrets(): Record<string, string> {
  try {
    const content = readFileSync('/vault/secrets/config', 'utf-8');
    const secrets: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^export\s+(\w+)=(.+)$/);
      if (match) {
        secrets[match[1]] = match[2];
      }
    }
    return secrets;
  } catch {
    // Not running in K8s with Vault — fall back to env vars
    return {};
  }
}

const vaultSecrets = loadVaultSecrets();

function env(key: string, fallback?: string): string {
  const value = vaultSecrets[key] || process.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing required config: ${key}`);
  }
  return value;
}

function envOptional(key: string, fallback?: string): string | undefined {
  return vaultSecrets[key] || process.env[key] || fallback;
}

export const config = {
  // Miniflux
  miniflux: {
    url: env('MINIFLUX_API_URL', 'http://localhost:8080'),
    apiKey: env('MINIFLUX_API_KEY', 'dev-key'),
  },

  // LibreTranslate
  libretranslate: {
    url: env('LIBRETRANSLATE_URL', 'http://localhost:5000'),
    apiKey: envOptional('LIBRETRANSLATE_API_KEY'),
    timeoutMs: parseInt(env('LIBRETRANSLATE_TIMEOUT_MS', '30000'), 10),
  },

  // OpenRouter
  openrouter: {
    url: 'https://openrouter.ai/api/v1',
    apiKey: env('OPENROUTER_API_KEY', 'dev-key'),
    model: env('OPENROUTER_MODEL', 'qwen/qwen3-14b'),
  },

  // Database
  database: {
    url: env('DATABASE_URL', 'postgresql://kaiwa:kaiwa@localhost:5433/kaiwa'),
  },

  // Auth
  auth: {
    secret: env('NEXTAUTH_SECRET', 'dev-secret-change-in-production'),
    authentik: {
      issuer: envOptional('AUTHENTIK_ISSUER'),
      clientId: envOptional('AUTHENTIK_CLIENT_ID'),
      clientSecret: envOptional('AUTHENTIK_CLIENT_SECRET'),
    },
  },

  // Scraping
  scrape: {
    enabled: env('SCRAPE_ENABLED', 'true') === 'true',
    timeoutMs: parseInt(env('SCRAPE_TIMEOUT_MS', '15000'), 10),
    userAgent: env(
      'SCRAPE_USER_AGENT',
      'Mozilla/5.0 (compatible; Kaiwa/1.0; +https://github.com/Gnzaga/kaiwa)',
    ),
    minContentLength: parseInt(env('SCRAPE_MIN_CONTENT_LENGTH', '200'), 10),
  },

  // MinIO (S3-compatible image storage)
  minio: {
    endpoint: env('MINIO_ENDPOINT', 'http://10.100.0.228:9000'),
    accessKey: envOptional('MINIO_ACCESS_KEY', ''),
    secretKey: envOptional('MINIO_SECRET_KEY', ''),
    bucket: env('MINIO_BUCKET', 'kaiwa-images'),
    publicUrl: env('MINIO_PUBLIC_URL', 'http://10.100.0.228:9000/kaiwa-images'),
  },

  // Embedder
  embedder: {
    url: env('EMBEDDER_URL', 'http://localhost:8000'),
  },

  // Worker
  worker: {
    pollIntervalMinutes: parseInt(env('POLL_INTERVAL_MINUTES', '15'), 10),
    translationConcurrency: parseInt(env('TRANSLATION_CONCURRENCY', '3'), 10),
    summarizationConcurrency: parseInt(env('SUMMARIZATION_CONCURRENCY', '2'), 10),
    scrapeConcurrency: parseInt(env('SCRAPE_CONCURRENCY', '2'), 10),
  },
} as const;
