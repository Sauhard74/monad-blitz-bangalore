import { getTexConfig, recall } from '@/lib/server/tex';
import { publishMemory } from '@/lib/server/memoryBus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Thin HTTP wrapper over the server-only Tex `recall` client. Accepts a query
 * plus optional agent/project scoping and returns the safe `RecallResult`.
 * Never throws — when Tex isn't configured it returns an empty result.
 *
 * When called with a `companyId` + `agentId` (e.g. by an agent's MCP tool), a
 * hit is also broadcast on the memory bus so the live office SSE shows a 🧠
 * recall. Mock mode skips this — it pushes events into its own queue directly.
 */
export async function POST(req: Request): Promise<Response> {
  const cfg = getTexConfig();
  if (!cfg) return Response.json({ turns: [], observations: [], confidence: 0, topSnippet: null });
  const body = await req.json().catch(() => ({}));
  const { q, agentId, projectId, mode, companyId } = body as {
    q?: string;
    agentId?: string;
    projectId?: string;
    mode?: 'active' | 'deep';
    companyId?: string;
  };
  const result = await recall(cfg, String(q ?? ''), { agentId, projectId }, { mode });
  if (companyId && agentId && result.topSnippet) {
    publishMemory(companyId, { t: 'memory.recalled', agentId, snippet: result.topSnippet });
  }
  return Response.json(result);
}
