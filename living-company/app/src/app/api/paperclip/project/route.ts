import { NextResponse } from 'next/server';
import {
  activeCompanyId,
  createProject,
  fetchAgents,
  getBoardConfig,
  resolveCompanyId,
} from '@/lib/server/paperclip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Give the company a project: creates a Paperclip goal + a top-level issue
 *  assigned to the CEO (who then breaks it down / delegates). */
export async function POST(request: Request): Promise<Response> {
  const cfg = getBoardConfig(activeCompanyId(request));
  if (!cfg) return NextResponse.json({ ok: false, reason: 'not-configured' }, { status: 503 });
  try {
    const { brief } = (await request.json()) as { brief?: string };
    const companyId = await resolveCompanyId(cfg);
    const agents = await fetchAgents(companyId, cfg);
    const ceo = agents.find((a) => a.role === 'ceo') ?? agents[0];
    const { issueId } = await createProject(companyId, (brief ?? '').slice(0, 280), ceo?.id, cfg);
    return NextResponse.json({ projectId: issueId ?? `proj-${Date.now()}` });
  } catch (error) {
    console.error('[api/paperclip/project]', error);
    return NextResponse.json({ ok: false, reason: 'create-failed' }, { status: 502 });
  }
}
