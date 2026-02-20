import { config } from '../config';

const LANGUAGE_NAMES: Record<string, string> = {
  ja: 'Japanese',
  zh: 'Traditional Chinese',
  tl: 'Filipino',
  ko: 'Korean',
  es: 'Spanish',
};

function buildSystemPrompt(sourceLanguage: string): string {
  const langName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage;
  return (
    `You are a professional ${langName}-to-English translator specializing in news, legal, and economic texts. ` +
    `Translate the following ${langName} text to English. Preserve technical terminology accurately. ` +
    `Preserve all HTML tags and their attributes (like <img>, <a>, <div>, etc.) exactly. ` +
    'Do not summarize or interpret — provide a faithful translation only. ' +
    'Respond with ONLY the translated text, no explanations or preamble.'
  );
}

interface TranslationResult {
  text: string;
}

export async function translate(
  text: string,
  sourceLanguage: string = 'ja',
): Promise<TranslationResult> {
  const res = await fetch(`${config.openrouter.url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openrouter.apiKey}`,
    },
    body: JSON.stringify({
      model: config.openrouter.model,
      messages: [
        { role: 'system', content: buildSystemPrompt(sourceLanguage) },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LLM translate failed: ${res.status} ${detail}`);
  }

  const data = await res.json();
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) {
    throw new Error('LLM translate returned empty response');
  }
  return { text: translated };
}
