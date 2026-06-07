import { activeCompanyId } from '@/lib/server/paperclip';
import { companyTex } from '@/lib/server/companyTex';
import { recall, getTexConfig, cleanSnippet } from '@/lib/server/tex';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The Company Brain panel: recent memories for the ACTIVE company, read from
 * that company's OWN Tex org (resolved from its agents' config) — not the global
 * env org. This is what the agents actually write to via the tex-memory MCP, so
 * the panel finally reflects the real organizational memory.
 */
export async function GET(req: Request): Promise<Response> {
  const companyId = activeCompanyId(req);
  // Per-company org when we can resolve it; else fall back to the global env org.
  const cfg = (companyId ? await companyTex(companyId) : null) ?? getTexConfig();
  if (!cfg) return Response.json({ memories: [] });

  // Broad evergreen query → the most salient recent organizational memories.
  const result = await recall(cfg, 'company decisions plans progress and what was built', {}, { topK: 12 });
  const memories = result.turns
    .map((t) => ({ id: t.id, text: cleanSnippet(t.text).slice(0, 160), kind: t.kind, at: t.timestamp }))
    .filter((m) => m.text);

  return Response.json({ memories });
}
