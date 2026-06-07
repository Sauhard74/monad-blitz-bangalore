import { getBoardConfig, pcFetch } from '@/lib/server/paperclip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PcCompany {
  id: string;
  name?: string;
}

/** Every company the board key can see — for the office's company switcher. */
export async function GET(): Promise<Response> {
  const cfg = getBoardConfig();
  if (!cfg) return Response.json({ companies: [] });
  try {
    const list = await pcFetch<PcCompany[]>(`/companies`, {}, cfg);
    const companies = (Array.isArray(list) ? list : [])
      .filter((c) => c.id)
      // Hide archived companies (can't be hard-deleted via API): name marked "[x]".
      .filter((c) => !(c.name ?? '').startsWith('[x]'))
      .map((c) => ({ id: c.id, name: c.name ?? 'Untitled company' }));
    return Response.json({ companies });
  } catch {
    return Response.json({ companies: [] });
  }
}
