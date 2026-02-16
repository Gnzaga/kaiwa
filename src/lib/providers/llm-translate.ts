import { config } from '../config';

const SYSTEM_PROMPT =
  'You are a professional Japanese-to-English translator specializing in legal and economic texts. ' +
  'Translate the following Japanese text to English. Preserve technical terminology accurately. ' +
  'Do not summarize or interpret — provide a faithful translation only. ' +
  'Respond with ONLY the translated text, no explanations or preamble.';

interface TranslationResult {
  text: string;
}

export async function translate(text: string): Promise<TranslationResult> {
  const res = await fetch(`${config.openwebui.url}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openwebui.apiKey}`,
    },
    body: JSON.stringify({
      model: config.openwebui.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
