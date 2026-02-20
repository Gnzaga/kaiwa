import { config } from '../config';

interface TranslationResult {
  text: string;
}

export async function translate(
  text: string,
  sourceLanguage: string = 'ja',
  targetLanguage: string = 'en',
): Promise<TranslationResult> {
  const body: Record<string, string> = {
    q: text,
    source: sourceLanguage,
    target: targetLanguage,
  };
  if (config.libretranslate.apiKey) {
    body.api_key = config.libretranslate.apiKey;
  }

  const res = await fetch(`${config.libretranslate.url}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.libretranslate.timeoutMs),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LibreTranslate failed: ${res.status} ${detail}`);
  }

  const data = await res.json();
  return { text: data.translatedText };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${config.libretranslate.url}/languages`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
