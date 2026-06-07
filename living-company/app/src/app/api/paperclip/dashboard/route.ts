import {
  activeCompanyId,
  fetchAgents,
  getBoardConfig,
  pcFetch,
  resolveCompanyId,
} from '@/lib/server/paperclip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PcIssue {
  id: string;
  title?: string;
  status?: string;
  updatedAt?: string;
}
interface PcGoal {
  id: string;
  title?: string;
  status?: string;
}
interface PcActivity {
  action?: string;
  agentId?: string;
  actorId?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
}
interface PcCompany {
  id: string;
  name?: string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Mission-control snapshot for the office's big screen: vitals, milestones,
 *  team, throughput, and the live decision ticker — all from live Paperclip. */
export async function GET(req: Request): Promise<Response> {
  const cfg = getBoardConfig(activeCompanyId(req));
  if (!cfg) return Response.json({ ok: false });
  try {
    const companyId = await resolveCompanyId(cfg);
    const [company, agents, issues, goals, activity] = await Promise.all([
      pcFetch<PcCompany>(`/companies/${companyId}`, {}, cfg).catch(() => ({}) as PcCompany),
      fetchAgents(companyId, cfg),
      pcFetch<PcIssue[]>(`/companies/${companyId}/issues`, {}, cfg).catch(() => [] as PcIssue[]),
      pcFetch<PcGoal[]>(`/companies/${companyId}/goals`, {}, cfg).catch(() => [] as PcGoal[]),
      pcFetch<PcActivity[]>(`/companies/${companyId}/activity`, {}, cfg).catch(() => [] as PcActivity[]),
    ]);

    const byStatus: Record<string, number> = {};
    for (const i of issues) byStatus[i.status ?? 'unknown'] = (byStatus[i.status ?? 'unknown'] ?? 0) + 1;

    const nameOf = new Map(agents.map((a) => [a.id, a.name]));
    const workProducts = activity.filter((a) => a.action === 'issue.work_product_created').length;

    // A short "what's happening" ticker from the most recent salient activity.
    const ticker: string[] = [];
    for (const a of activity) {
      const who = nameOf.get(a.agentId ?? a.actorId ?? '') ?? '';
      const d = a.details ?? {};
      let line: string | null = null;
      if (a.action === 'issue.comment_added') {
        const body = (str(d.bodySnippet) || str(d.body)).replace(/\s+/g, ' ').trim();
        if (body) line = `${who}: ${body.slice(0, 70)}`;
      } else if (a.action === 'issue.work_product_created') line = `${who} shipped a work product`;
      else if (a.action === 'issue.created') line = `${who} opened “${str(d.title).slice(0, 50)}”`;
      else if (a.action === 'agent.hire_created') line = `${who} hired ${str(d.name)} (${str(d.role)})`;
      else if (a.action === 'issue.updated' && str(d.status) === 'done') line = `${who} completed a task`;
      if (line) ticker.push(line);
      if (ticker.length >= 12) break;
    }

    return Response.json({
      ok: true,
      name: company.name ?? 'Company',
      vitals: {
        team: agents.length,
        building: agents.filter((a) => a.status === 'running').length,
        shipped: byStatus['done'] ?? 0,
        inProgress: (byStatus['in_progress'] ?? 0) + (byStatus['in_review'] ?? 0),
        blocked: byStatus['blocked'] ?? 0,
        backlog: (byStatus['todo'] ?? 0) + (byStatus['backlog'] ?? 0),
        workProducts,
      },
      milestones: goals
        .slice(0, 5)
        .map((g) => ({ id: g.id, title: g.title ?? 'Goal', status: g.status ?? 'active' })),
      team: agents.slice(0, 24).map((a) => ({ name: a.name, role: a.role, status: a.status })),
      ticker,
    });
  } catch {
    return Response.json({ ok: false });
  }
}
