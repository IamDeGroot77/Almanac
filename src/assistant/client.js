import { isWeb } from '../platform';
import { SYSTEM } from './prompt';
import { TOOLS } from './tools';

// One round trip to the Messages API: the line, the snapshot, the tools.
// Returns the model's text and its tool calls; the caller applies them.
// Docs: https://docs.claude.com/en/api/messages

export const MODELS = {
  quick: { id: 'claude-haiku-4-5-20251001', name: 'Quick (Haiku 4.5)' },
  careful: { id: 'claude-sonnet-5', name: 'Careful (Sonnet 5)' },
};

const URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 30000;

export async function askClaude({ apiKey, model = MODELS.quick.id, snapshot, text, history = [] }) {
  if (!apiKey) throw new Error('No API key');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const messages = [
      ...history,
      { role: 'user', content: `Snapshot:\n${JSON.stringify(snapshot)}\n\nLine:\n${text}` },
    ];
    const res = await fetch(URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(isWeb ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
      },
      body: JSON.stringify({ model, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      const err = new Error(res.status === 401 ? 'The API key was refused. Check it in Settings.' : res.status === 429 ? 'Rate limited; try again in a moment.' : msg);
      err.status = res.status;
      throw err;
    }
    const content = Array.isArray(body.content) ? body.content : [];
    return {
      text: content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(),
      calls: content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, input: b.input || {} })),
      usage: body.usage || null,
      raw: body,
    };
  } finally {
    clearTimeout(timer);
  }
}

// A cheap round trip to prove the key works.
export async function testKey(apiKey) {
  const r = await askClaude({ apiKey, snapshot: { now: 'test' }, text: 'Reply with the single word ok. Use no tools.' });
  return r.text || 'ok';
}
