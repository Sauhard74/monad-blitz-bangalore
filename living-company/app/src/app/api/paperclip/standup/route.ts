import {
  activeCompanyId,
  fetchAgents,
  getBoardConfig,
  pcFetch,
  resolveCompanyId,
} from '@/lib/server/paperclip';
import { mapPcStatus } from '@/lib/data/paperclipMapper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PcIssue {
  id: string;
  title?: string;
  status?: string;
  assigneeAgentId?: string | null;
  updatedAt?: string;
}

/** Priority of issue statuses for "what are you working on right now". */
const ACTIVE_ORDER = ['in_progress', 'in_review', 'blocked', 'todo'];

/**
 * Stand-up: for each agent, their current focus — pulled live from Paperclip
 * (their highest-priority active issue) plus their status. The agent key stays
 * server-side; the browser just gets the summarized reports.
 */
export async function GET(req: Request): Promise<Response> {
  const cfg = getBoardConfig(activeCompanyId(req));
  if (!cfg) return Response.json({ reports: [] });

  const companyId = await resolveCompanyId(cfg);
  const [agents, issues] = await Promise.all([
    fetchAgents(companyId, cfg),
    pcFetch<PcIssue[]>(`/companies/${companyId}/issues`, {}, cfg).catch(() => [] as PcIssue[]),
  ]);

  // Group active issues by assignee, most relevant first.
  const byAgent = new Map<string, PcIssue[]>();
  for (const i of issues) {
    if (!i.assigneeAgentId || !ACTIVE_ORDER.includes(i.status ?? '')) continue;
    const list = byAgent.get(i.assigneeAgentId) ?? [];
    list.push(i);
    byAgent.set(i.assigneeAgentId, list);
  }

  const reports = agents.map((a) => {
    const mine = (byAgent.get(a.id) ?? []).sort(
      (x, y) => ACTIVE_ORDER.indexOf(x.status ?? '') - ACTIVE_ORDER.indexOf(y.status ?? ''),
    );
    const top = mine[0];
    return {
      agentId: a.id,
      name: a.name,
      role: a.role,
      status: mapPcStatus(a.status),
      working: top?.title ?? null,
      workingStatus: top?.status ?? null,
      openCount: mine.length,
    };
  });

  return Response.json({ reports });
}
