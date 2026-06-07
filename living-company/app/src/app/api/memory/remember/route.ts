import { getTexConfig, remember } from '@/lib/server/tex';
import { publishMemory } from '@/lib/server/memoryBus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Thin HTTP wrapper over the server-only Tex `remember` client. Accepts the text
 * to store (also `note`, the alias the MCP tool sends) plus optional agent/project
 * scoping. Returns `{ ok }` — false when Tex isn't configured or the text is empty.
 *
 * When called with a `companyId` + `agentId`, a successful write is broadcast on
 * the memory bus so the live office SSE shows a 💾 save. Mock mode skips this —
 * it pushes events into its own queue directly.
 */
export async function POST(req: Request): Promise<Response> {
  const cfg = getTexConfig();
  if (!cfg) return Response.json({ ok: false });
  const body = await req.json().catch(() => ({}));
  const { text, note, agentId, projectId, companyId } = body as {
    text?: string;
    note?: string;
    agentId?: string;
    projectId?: string;
    companyId?: string;
  };
  const resolved = String(text ?? note ?? '').trim();
  if (!resolved) return Response.json({ ok: false });
  const ok = await remember(cfg, resolved, { agentId, projectId });
  if (ok && companyId && agentId) {
    publishMemory(companyId, { t: 'memory.wrote', agentId, snippet: resolved });
  }
  return Response.json({ ok });
}
