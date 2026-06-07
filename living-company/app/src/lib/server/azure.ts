import 'server-only';

/**
 * Server-only Azure AI Foundry (Azure AI Inference) client. Reads credentials
 * from env; never imported into client bundles (`server-only` enforces it).
 */
export interface AzureConfig {
  endpoint: string;
  key: string;
  model: string;
  apiVersion: string;
}

export function getAzureConfig(): AzureConfig | null {
  const endpoint = process.env.AZURE_AI_ENDPOINT;
  const key = process.env.AZURE_AI_KEY;
  if (!endpoint || !key) return null;
  return {
    endpoint: endpoint.replace(/\/$/, ''),
    key,
    model: process.env.AZURE_AI_MODEL ?? 'gpt-5.5',
    apiVersion: process.env.AZURE_AI_API_VERSION ?? '2024-05-01-preview',
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Call the chat-completions endpoint requesting a JSON object, and return the
 * parsed result. Throws if Azure is unconfigured, the call fails, or the model
 * returns non-JSON — callers are expected to catch and fall back.
 */
export async function azureChatJSON<T = unknown>(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<T> {
  const cfg = getAzureConfig();
  if (!cfg) throw new Error('Azure AI is not configured');

  const url = `${cfg.endpoint}/models/chat/completions?api-version=${cfg.apiVersion}`;
  // gpt-5.x are reasoning models: they take `max_completion_tokens` (not
  // `max_tokens`), reject non-default `temperature`, and spend part of the
  // budget on hidden reasoning tokens — so the ceiling must be generous.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': cfg.key },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_completion_tokens: opts.maxTokens ?? 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Azure chat failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(content) as T;
}
