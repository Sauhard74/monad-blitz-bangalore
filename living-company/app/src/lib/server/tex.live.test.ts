import { describe, expect, it } from 'vitest';
import { __resetTexToken, getTexConfig, recall, remember } from './tex';

/**
 * Gated live smoke test. Only runs when a real Tex config is present in the
 * environment (TEX_API_KEY + TEX_ORG_ID). Run with the env loaded:
 *
 *   set -a; . ./.env.local; set +a; npx vitest run src/lib/server/tex.live.test.ts
 *
 * This is the ONE file that makes real network calls — intentionally.
 */
const cfg = getTexConfig();

describe.runIf(cfg)('tex live', () => {
  it(
    'remembers then recalls',
    async () => {
      __resetTexToken();
      const ids = { agentId: 'smoke', projectId: 'live-' + Math.floor(Date.now() / 1000) };
      expect(await remember(cfg!, 'We deploy on Vercel with Fluid Compute.', ids)).toBe(true);
      await new Promise((r) => setTimeout(r, 1200));
      const r = await recall(cfg!, 'where do we deploy?', ids);
      expect(r.turns.length).toBeGreaterThan(0);
    },
    20000,
  );
});
