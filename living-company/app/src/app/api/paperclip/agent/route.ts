import { activeCompanyId, getBoardConfig, pcFetch, resolveCompanyId } from '@/lib/server/paperclip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PcIssue {
  id: string;
  identifier?: string;
  title?: string;
  status?: string;
  assigneeAgentId?: string | null;
}
interface PcActivity {
  action?: string;
  entityType?: string;
  agentId?: string;
  actorId?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
}

const ACTIVE = ['in_progress', 'in_review', 'blocked', 'todo'];

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Turn one activity-log row into a short human line. */
function describe(a: PcActivity): string | null {
  const d = a.details ?? {};
  switch (a.action) {
    case 'issue.created':
      return `created task “${str(d.title).slice(0, 60)}”`;
    case 'issue.checked_out':
      return 'started working on a task';
    case 'issue.updated': {
      const s = str(d.status);
      return s ? `moved a task to ${s.replace('_', ' ')}` : null;
    }
    case 'issue.comment_added': {
      const body = (str(d.bodySnippet) || str(d.body)).replace(/\s+/g, ' ').trim();
      return body ? `commented: “${body.slice(0, 90)}”` : 'added a comment';
    }
    case 'issue.work_product_created':
      return 'delivered a work product';
    case 'issue.blockers_updated':
      return 'updated task blockers';
    case 'environment.lease_acquired':
      return 'opened a workspace';
    case 'environment.lease_released':
      return 'wrapped up in the workspace';
    case 'agent.hire_created':
      return `hired ${str(d.name) || 'a new teammate'}`;
    case 'agent.updated':
      return null; // low-signal housekeeping
    default:
      return null;
  }
}

/** What a single agent is doing now: active assigned issues + recent actions. */
export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id');
  const cfg = getBoardConfig(activeCompanyId(req));
  if (!cfg || !id) return Response.json({ issues: [], activity: [] });

  const companyId = await resolveCompanyId(cfg);
  const [issues, activity] = await Promise.all([
    pcFetch<PcIssue[]>(`/companies/${companyId}/issues`, {}, cfg).catch(() => [] as PcIssue[]),
    pcFetch<PcActivity[]>(`/companies/${companyId}/activity`, {}, cfg).catch(() => [] as PcActivity[]),
  ]);

  const mine = issues
    .filter((i) => i.assigneeAgentId === id && ACTIVE.includes(i.status ?? ''))
    .sort((a, b) => ACTIVE.indexOf(a.status ?? '') - ACTIVE.indexOf(b.status ?? ''))
    .slice(0, 8)
    .map((i) => ({ id: i.id, identifier: i.identifier, title: i.title ?? '', status: i.status ?? '' }));

  const recent: { text: string; at?: string }[] = [];
  for (const a of activity) {
    if (a.agentId !== id && a.actorId !== id) continue;
    const text = describe(a);
    if (text) recent.push({ text, at: a.createdAt });
    if (recent.length >= 10) break;
  }

  return Response.json({ issues: mine, activity: recent });
}
