import { activeCompanyId, getBoardConfig, pcFetch, resolveCompanyId } from '@/lib/server/paperclip';
import { resolveFrontend, listSource } from '@/lib/server/preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tells the office whether the active company has a previewable frontend.
 * The Atlas company ships a polished, hand-finished frontend as its product —
 * that is its real preview. Every other company shows only what its agents have
 * actually built (a served frontend if present, else the real source files), so
 * we never imply a company built something it didn't.
 */
export async function GET(req: Request): Promise<Response> {
  const company = activeCompanyId(req);
  if (!company) return Response.json({ available: false, files: [] });

  // Atlas → its finished product frontend.
  const cfg = getBoardConfig(company);
  if (cfg) {
    try {
      const id = await resolveCompanyId(cfg);
      const c = await pcFetch<{ name?: string }>(`/companies/${id}`, {}, cfg);
      if (/\batlas\b/i.test(c.name ?? '')) {
        return Response.json({ available: true, indexUrl: '/atlas/index.html' });
      }
    } catch {
      /* fall through to the agents' own build */
    }
  }

  // Everyone else → only the agents' real output.
  const hit = await resolveFrontend(company);
  if (hit) return Response.json({ available: true, indexUrl: `/api/preview/${company}/index.html` });
  const files = await listSource(company).catch(() => [] as string[]);
  return Response.json({ available: false, files });
}
