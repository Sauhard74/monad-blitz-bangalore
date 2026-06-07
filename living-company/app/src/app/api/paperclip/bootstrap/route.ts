import { NextResponse } from 'next/server';
import { activeCompanyId, fetchAgents, getBoardConfig, resolveCompanyId } from '@/lib/server/paperclip';
import { mapAgent } from '@/lib/data/paperclipMapper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Initial company snapshot: the current roster mapped to our domain agents. */
export async function GET(req: Request): Promise<Response> {
  const cfg = getBoardConfig(activeCompanyId(req));
  if (!cfg) return NextResponse.json({ ok: false, reason: 'not-configured' }, { status: 503 });
  try {
    const companyId = await resolveCompanyId(cfg);
    const pcAgents = await fetchAgents(companyId, cfg);
    const agents = pcAgents.map((a, i) => mapAgent(a, i));
    return NextResponse.json({ companyId, agents });
  } catch (error) {
    console.error('[api/paperclip/bootstrap]', error);
    return NextResponse.json({ ok: false, reason: 'fetch-failed' }, { status: 502 });
  }
}
