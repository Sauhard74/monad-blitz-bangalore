import 'server-only';

/**
 * Server-only Tex memory client. Reads credentials from env and talks to the
 * Tex (getmetacognition) memory service. The API key never leaves the server.
 *
 * See docs/plans for the Tex memory harness design. All network functions take
 * an injectable `fetchImpl` (and clock, where noted) so unit tests run offline.
 */
export interface TexConfig {
  apiUrl: string;
  apiKey: string;
  orgId: string;
}

export interface TexScope {
  org_id: string;
  user_id?: string;
  session_id?: string;
}

const DEFAULT_API_URL = 'https://api.getmetacognition.com';

export function getTexConfig(): TexConfig | null {
  const apiKey = process.env.TEX_API_KEY;
  const orgId = process.env.TEX_ORG_ID;
  if (!apiKey || !orgId) return null;
  return {
    apiUrl: (process.env.TEX_API_URL || DEFAULT_API_URL).replace(/\/$/, ''),
    apiKey,
    orgId,
  };
}

// --- Token exchange ---------------------------------------------------------

/** Safety margin (ms) so we refresh just before the token actually expires. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

let cachedToken: {
  token: string;
  expiresAtMs: number;
  apiKey: string;
  apiUrl: string;
} | null = null;

/** In-flight token exchange, shared by concurrent callers (single-flight). */
let tokenInflight: Promise<string> | null = null;

/** Clear the module-level token cache (test helper). */
export function __resetTexToken(): void {
  cachedToken = null;
  tokenInflight = null;
}

/**
 * Exchange the API key for a short-lived bearer token, caching it until just
 * before expiry. Throws if the exchange fails.
 *
 * Concurrent callers on a cold/expired cache share a single in-flight exchange.
 * The cache is keyed to the credentials, so a changed apiKey/apiUrl is a miss.
 */
export async function getAccessToken(
  cfg: TexConfig,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<string> {
  if (
    cachedToken &&
    cachedToken.apiKey === cfg.apiKey &&
    cachedToken.apiUrl === cfg.apiUrl &&
    now() < cachedToken.expiresAtMs - TOKEN_SAFETY_MARGIN_MS
  ) {
    return cachedToken.token;
  }
  // A concurrent caller is already exchanging — await its result.
  if (tokenInflight) return tokenInflight;

  tokenInflight = (async () => {
    const res = await fetchImpl(`${cfg.apiUrl}/auth/token-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: cfg.apiKey }),
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Tex token-exchange -> ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token || !Number.isFinite(data.expires_in)) {
      throw new Error('Tex token-exchange returned a malformed token response');
    }
    cachedToken = {
      token: data.access_token,
      expiresAtMs: now() + (data.expires_in as number) * 1000,
      apiKey: cfg.apiKey,
      apiUrl: cfg.apiUrl,
    };
    return cachedToken.token;
  })().finally(() => {
    tokenInflight = null;
  });

  return tokenInflight;
}

/** Map our agent/project ids onto Tex's scope (user_id / session_id). */
export function texScope(
  orgId: string,
  opts: { agentId?: string; projectId?: string },
): TexScope {
  const scope: TexScope = { org_id: orgId };
  if (opts.agentId) scope.user_id = `agent-${opts.agentId}`;
  if (opts.projectId) scope.session_id = `proj-${opts.projectId}`;
  return scope;
}

// --- Recall -----------------------------------------------------------------

export interface RecallTurn {
  id: string;
  text: string;
  score: number;
  kind: string;
  timestamp: string;
}

export interface RecallResult {
  turns: RecallTurn[];
  observations: unknown[];
  confidence: number;
  /** First turn's text with the `[Date: …] [role]` prefix stripped, or null. */
  topSnippet: string | null;
}

const EMPTY_RECALL: RecallResult = {
  turns: [],
  observations: [],
  confidence: 0,
  topSnippet: null,
};

/** Strip one-or-more leading `[...]` bracket groups (and whitespace). */
export function cleanSnippet(text: string): string {
  if (!text) return '';
  return text.replace(/^(?:\s*\[[^\]]*\])+\s*/, '');
}

/**
 * Query Tex memory. Always resolves to a `RecallResult` — on any failure
 * (thrown fetch or non-ok response) it returns the safe empty result so callers
 * never have to handle errors.
 */
export async function recall(
  cfg: TexConfig,
  q: string,
  ids: { agentId?: string; projectId?: string },
  opts: {
    mode?: 'active' | 'deep';
    topK?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<RecallResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const token = await getAccessToken(cfg, fetchImpl);
    const res = await fetchImpl(`${cfg.apiUrl}/recall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        scope: texScope(cfg.orgId, ids),
        q,
        mode: opts.mode ?? 'active',
        top_k: opts.topK ?? 8,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return EMPTY_RECALL;

    const data = (await res.json()) as {
      hits?: { turns?: RecallTurn[]; observations?: unknown[] };
      confidence?: number;
    };
    const turns = data.hits?.turns ?? [];
    const observations = data.hits?.observations ?? [];
    const topSnippet = turns.length ? cleanSnippet(turns[0].text) : null;
    return {
      turns,
      observations,
      confidence: data.confidence ?? 0,
      topSnippet,
    };
  } catch (err) {
    console.warn('[tex] recall failed', err);
    return EMPTY_RECALL;
  }
}

// --- Remember ---------------------------------------------------------------

/**
 * Write a single turn into Tex memory. Always resolves to a boolean — true when
 * the ingest was accepted (2xx), false on any failure (thrown fetch or non-ok).
 * Never throws, so callers can fire-and-forget.
 */
export async function remember(
  cfg: TexConfig,
  text: string,
  ids: { agentId?: string; projectId?: string },
  opts: {
    role?: 'user' | 'assistant';
    fetchImpl?: typeof fetch;
    nowIso?: () => string;
  } = {},
): Promise<boolean> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const nowIso = opts.nowIso ?? (() => new Date().toISOString());
  try {
    const token = await getAccessToken(cfg, fetchImpl);
    const res = await fetchImpl(`${cfg.apiUrl}/ingestion/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        scope: texScope(cfg.orgId, ids),
        turns: [{ role: opts.role ?? 'assistant', text, timestamp: nowIso() }],
        options: { write_active: true, write_passive: true },
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[tex] remember failed', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[tex] remember failed', err);
    return false;
  }
}
