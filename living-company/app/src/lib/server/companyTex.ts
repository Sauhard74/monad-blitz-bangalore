import 'server-only';
import { fetchAgents, getBoardConfig, pcFetch } from '@/lib/server/paperclip';
import type { TexConfig } from '@/lib/server/tex';

/**
 * Each provisioned company has its OWN Tex memory org (minted at provision time),
 * with the creds baked into every agent's `adapterConfig.extraArgs`. The office,
 * however, only knows the global env Tex org — so the Company Brain panel reads
 * the wrong org and looks empty. This resolves a company's real Tex creds by
 * reading them back out of one of its agents' configs (via the board key), so
 * recall/list happens against the same org the agents actually write to.
 */

interface AgentConfig {
  adapterConfig?: { extraArgs?: string[] };
}

const cache = new Map<string, TexConfig | null>();

function grab(joined: string, key: string): string | undefined {
  // extraArgs look like: -c  TEX_API_KEY="tex_live_..."
  const m = joined.match(new RegExp(`${key}="([^"]+)"`));
  return m?.[1];
}

/** Resolve a company's per-company Tex config, or null if not wired/derivable. */
export async function companyTex(companyId: string): Promise<TexConfig | null> {
  if (cache.has(companyId)) return cache.get(companyId) ?? null;

  const board = getBoardConfig(companyId);
  if (!board) {
    cache.set(companyId, null);
    return null;
  }

  let resolved: TexConfig | null = null;
  try {
    const agents = await fetchAgents(companyId, board);
    for (const a of agents) {
      const cfg = await pcFetch<AgentConfig>(`/agents/${a.id}/configuration`, {}, board).catch(() => null);
      const joined = (cfg?.adapterConfig?.extraArgs ?? []).join(' ');
      const apiKey = grab(joined, 'TEX_API_KEY');
      const orgId = grab(joined, 'TEX_ORG_ID');
      if (apiKey && orgId) {
        resolved = {
          apiUrl: (grab(joined, 'TEX_API_URL') || 'https://api.getmetacognition.com').replace(/\/$/, ''),
          apiKey,
          orgId,
        };
        break;
      }
    }
  } catch {
    resolved = null;
  }

  cache.set(companyId, resolved);
  return resolved;
}
