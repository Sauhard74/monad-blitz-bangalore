import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetTexToken,
  cleanSnippet,
  getAccessToken,
  getTexConfig,
  recall,
  remember,
  texScope,
  type TexConfig,
} from './tex';

const CFG: TexConfig = {
  apiUrl: 'https://tex.test',
  apiKey: 'secret-key',
  orgId: 'org-1',
};

describe('getTexConfig', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.TEX_API_URL;
    delete process.env.TEX_API_KEY;
    delete process.env.TEX_ORG_ID;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('returns null when TEX_API_KEY is unset', () => {
    process.env.TEX_ORG_ID = 'org-1';
    expect(getTexConfig()).toBeNull();
  });

  it('returns null when TEX_ORG_ID is unset', () => {
    process.env.TEX_API_KEY = 'key-1';
    expect(getTexConfig()).toBeNull();
  });

  it('reads url/key/org from env', () => {
    process.env.TEX_API_URL = 'https://example.com';
    process.env.TEX_API_KEY = 'key-1';
    process.env.TEX_ORG_ID = 'org-1';
    expect(getTexConfig()).toEqual({
      apiUrl: 'https://example.com',
      apiKey: 'key-1',
      orgId: 'org-1',
    });
  });

  it('defaults the url and trims a trailing slash', () => {
    process.env.TEX_API_URL = 'https://example.com/';
    process.env.TEX_API_KEY = 'key-1';
    process.env.TEX_ORG_ID = 'org-1';
    expect(getTexConfig()?.apiUrl).toBe('https://example.com');

    delete process.env.TEX_API_URL;
    expect(getTexConfig()?.apiUrl).toBe('https://api.getmetacognition.com');
  });
});

describe('texScope', () => {
  it('builds a full scope with agent + project ids', () => {
    expect(texScope('org-1', { agentId: 'a1', projectId: 'p1' })).toEqual({
      org_id: 'org-1',
      user_id: 'agent-a1',
      session_id: 'proj-p1',
    });
  });

  it('omits user_id / session_id when not given', () => {
    expect(texScope('org-1', {})).toEqual({ org_id: 'org-1' });
    expect(texScope('org-1', { agentId: 'a1' })).toEqual({
      org_id: 'org-1',
      user_id: 'agent-a1',
    });
    expect(texScope('org-1', { projectId: 'p1' })).toEqual({
      org_id: 'org-1',
      session_id: 'proj-p1',
    });
  });
});

describe('getAccessToken', () => {
  beforeEach(() => __resetTexToken());

  it('exchanges the api key once and caches the token until expiry', async () => {
    let calls = 0;
    let body: unknown;
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls += 1;
      body = init?.body ? JSON.parse(init.body as string) : undefined;
      expect(String(url)).toBe('https://tex.test/auth/token-exchange');
      return new Response(
        JSON.stringify({ access_token: 'tok-1', refresh_token: 'r', expires_in: 86400 }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const now = () => 1_000_000;
    expect(await getAccessToken(CFG, fakeFetch, now)).toBe('tok-1');
    expect(await getAccessToken(CFG, fakeFetch, now)).toBe('tok-1');
    expect(calls).toBe(1);
    expect(body).toEqual({ api_key: 'secret-key' });
  });

  it('re-exchanges after the clock jumps past expiry (minus safety margin)', async () => {
    let calls = 0;
    const tokens = ['tok-1', 'tok-2'];
    const fakeFetch = (async () => {
      const access_token = tokens[calls];
      calls += 1;
      return new Response(
        JSON.stringify({ access_token, refresh_token: 'r', expires_in: 86400 }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    let t = 0;
    const now = () => t;
    expect(await getAccessToken(CFG, fakeFetch, now)).toBe('tok-1');
    // Still within the cached window.
    t = 86400_000 - 61_000;
    expect(await getAccessToken(CFG, fakeFetch, now)).toBe('tok-1');
    expect(calls).toBe(1);
    // Now inside the 60s safety margin before expiry — must refresh.
    t = 86400_000 - 59_000;
    expect(await getAccessToken(CFG, fakeFetch, now)).toBe('tok-2');
    expect(calls).toBe(2);
  });

  it('throws on a non-ok token-exchange', async () => {
    const fakeFetch = (async () =>
      new Response('nope', { status: 401 })) as unknown as typeof fetch;
    await expect(getAccessToken(CFG, fakeFetch, () => 0)).rejects.toThrow();
  });

  it('single-flights concurrent callers into ONE token-exchange', async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      // Defer so both callers are awaiting the same in-flight promise.
      await Promise.resolve();
      return new Response(
        JSON.stringify({ access_token: 'tok-1', refresh_token: 'r', expires_in: 86400 }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const now = () => 1_000_000;
    const [a, b] = await Promise.all([
      getAccessToken(CFG, fakeFetch, now),
      getAccessToken(CFG, fakeFetch, now),
    ]);
    expect(a).toBe('tok-1');
    expect(b).toBe('tok-1');
    expect(calls).toBe(1);
  });

  it('busts the cache when the credentials change', async () => {
    let calls = 0;
    const tokens = ['tok-A', 'tok-B'];
    const fakeFetch = (async () => {
      const access_token = tokens[calls];
      calls += 1;
      return new Response(
        JSON.stringify({ access_token, refresh_token: 'r', expires_in: 86400 }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const now = () => 1_000_000;
    const cfgA: TexConfig = { ...CFG, apiKey: 'key-A' };
    const cfgB: TexConfig = { ...CFG, apiKey: 'key-B' };
    expect(await getAccessToken(cfgA, fakeFetch, now)).toBe('tok-A');
    // Different apiKey — must re-exchange rather than serve the cached token.
    expect(await getAccessToken(cfgB, fakeFetch, now)).toBe('tok-B');
    expect(calls).toBe(2);
  });

  it('throws on a malformed token-exchange response (missing access_token)', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    await expect(getAccessToken(CFG, fakeFetch, () => 0)).rejects.toThrow();
  });

  it('throws when expires_in is not a finite number', async () => {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({ access_token: 'tok-1' }),
        { status: 200 },
      )) as unknown as typeof fetch;
    await expect(getAccessToken(CFG, fakeFetch, () => 0)).rejects.toThrow();
  });
});

/**
 * Build a fake fetch that answers the token-exchange, then delegates `/recall`
 * (and `/ingestion/memory`) to the supplied responder.
 */
function fakeApi(
  responder: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/auth/token-exchange')) {
      return new Response(
        JSON.stringify({ access_token: 'tok-1', refresh_token: 'r', expires_in: 86400 }),
        { status: 200 },
      );
    }
    return responder(u, init);
  }) as unknown as typeof fetch;
}

describe('cleanSnippet', () => {
  it('strips one or more leading bracket groups and whitespace', () => {
    expect(cleanSnippet('[Date: 2026] [assistant] hello world')).toBe('hello world');
    expect(cleanSnippet('[assistant]   spaced')).toBe('spaced');
    expect(cleanSnippet('no brackets here')).toBe('no brackets here');
    expect(cleanSnippet('[a][b] trailing [c] kept')).toBe('trailing [c] kept');
  });

  it('handles empty / nullish input safely', () => {
    expect(cleanSnippet('')).toBe('');
    expect(cleanSnippet(undefined as unknown as string)).toBe('');
  });
});

describe('recall', () => {
  beforeEach(() => __resetTexToken());

  it('normalizes hits and sets topSnippet to the first cleaned turn', async () => {
    let recallBody: unknown;
    const fetchImpl = fakeApi((url, init) => {
      expect(url).toBe('https://tex.test/recall');
      recallBody = JSON.parse(init!.body as string);
      return new Response(
        JSON.stringify({
          hits: {
            turns: [
              {
                id: 't1',
                text: '[Date: 2026] [assistant] We deploy on Vercel.',
                score: 0.9,
                kind: 'turn',
                timestamp: '2026-06-06T00:00:00Z',
              },
              { id: 't2', text: '[user] second', score: 0.5, kind: 'turn', timestamp: 'x' },
            ],
            observations: [{ id: 'o1' }],
            entities: [{ id: 'e1' }],
          },
          confidence: 0.77,
          timeline: [],
          mode: 'active',
          usage: {},
        }),
        { status: 200 },
      );
    });

    const r = await recall(CFG, 'where do we deploy?', { agentId: 'a1', projectId: 'p1' }, {
      fetchImpl,
    });

    expect(r.turns).toHaveLength(2);
    expect(r.turns[0]).toMatchObject({ id: 't1', score: 0.9 });
    expect(r.observations).toHaveLength(1);
    expect(r.confidence).toBe(0.77);
    expect(r.topSnippet).toBe('We deploy on Vercel.');

    // Request shape: scope + defaults (mode active, top_k 8).
    expect(recallBody).toEqual({
      scope: { org_id: 'org-1', user_id: 'agent-a1', session_id: 'proj-p1' },
      q: 'where do we deploy?',
      mode: 'active',
      top_k: 8,
    });
  });

  it('passes through mode + topK overrides', async () => {
    let recallBody: { mode?: string; top_k?: number } = {};
    const fetchImpl = fakeApi((_url, init) => {
      recallBody = JSON.parse(init!.body as string);
      return new Response(
        JSON.stringify({ hits: { turns: [], observations: [], entities: [] }, confidence: 0 }),
        { status: 200 },
      );
    });
    await recall(CFG, 'q', {}, { fetchImpl, mode: 'deep', topK: 3 });
    expect(recallBody.mode).toBe('deep');
    expect(recallBody.top_k).toBe(3);
  });

  it('returns the empty result with null topSnippet when there are no turns', async () => {
    const fetchImpl = fakeApi(() =>
      new Response(
        JSON.stringify({ hits: { turns: [], observations: [], entities: [] }, confidence: 0.1 }),
        { status: 200 },
      ),
    );
    const r = await recall(CFG, 'q', {}, { fetchImpl });
    expect(r.turns).toEqual([]);
    expect(r.topSnippet).toBeNull();
    expect(r.confidence).toBe(0.1);
  });

  it('falls back to the safe empty result on a non-ok response (never throws)', async () => {
    const fetchImpl = fakeApi(() => new Response('boom', { status: 500 }));
    const r = await recall(CFG, 'q', { agentId: 'a1' }, { fetchImpl });
    expect(r).toEqual({ turns: [], observations: [], confidence: 0, topSnippet: null });
  });

  it('falls back to the safe empty result on a thrown fetch (never throws)', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const r = await recall(CFG, 'q', {}, { fetchImpl });
    expect(r).toEqual({ turns: [], observations: [], confidence: 0, topSnippet: null });
  });
});

describe('remember', () => {
  beforeEach(() => __resetTexToken());

  it('posts a turn and returns true on 202', async () => {
    let body: unknown;
    const fetchImpl = fakeApi((url, init) => {
      expect(url).toBe('https://tex.test/ingestion/memory');
      body = JSON.parse(init!.body as string);
      return new Response(JSON.stringify({ job_id: 'j1' }), { status: 202 });
    });

    const ok = await remember(CFG, 'We deploy on Vercel.', { agentId: 'a1', projectId: 'p1' }, {
      fetchImpl,
      nowIso: () => '2026-06-06T12:00:00.000Z',
    });

    expect(ok).toBe(true);
    expect(body).toEqual({
      scope: { org_id: 'org-1', user_id: 'agent-a1', session_id: 'proj-p1' },
      turns: [
        { role: 'assistant', text: 'We deploy on Vercel.', timestamp: '2026-06-06T12:00:00.000Z' },
      ],
      options: { write_active: true, write_passive: true },
    });
  });

  it('honours a role override', async () => {
    let body: { turns?: { role?: string }[] } = {};
    const fetchImpl = fakeApi((_url, init) => {
      body = JSON.parse(init!.body as string);
      return new Response('{}', { status: 200 });
    });
    const ok = await remember(CFG, 'hi', {}, { fetchImpl, role: 'user' });
    expect(ok).toBe(true);
    expect(body.turns?.[0].role).toBe('user');
  });

  it('returns false on a non-ok response (never throws)', async () => {
    const fetchImpl = fakeApi(() => new Response('boom', { status: 500 }));
    expect(await remember(CFG, 'x', { agentId: 'a1' }, { fetchImpl })).toBe(false);
  });

  it('returns false on a thrown fetch (never throws)', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await remember(CFG, 'x', {}, { fetchImpl })).toBe(false);
  });
});
