import { activeCompanyId, fetchAgents, getBoardConfig, pcFetch, resolveCompanyId } from '@/lib/server/paperclip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PcActivity {
  id?: string;
  action?: string;
  agentId?: string;
  actorId?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** One activity row → a short human line (company-wide, with the actor named). */
function describe(a: PcActivity, name: string): string | null {
  const d = a.details ?? {};
  const who = name || 'Someone';
  switch (a.action) {
    case 'issue.created':
      return `${who} created “${str(d.title).slice(0, 56)}”`;
    case 'issue.checked_out':
      return `${who} started a task`;
    case 'issue.updated': {
      const s = str(d.status);
      return s ? `${who} moved a task to ${s.replace('_', ' ')}` : null;
    }
    case 'issue.comment_added': {
      const body = (str(d.bodySnippet) || str(d.body)).replace(/\s+/g, ' ').trim();
      return body ? `${who}: “${body.slice(0, 80)}”` : `${who} commented`;
    }
    case 'issue.work_product_created':
      return `${who} delivered a work product`;
    case 'project.created':
      return `${who} started project “${str(d.name).slice(0, 40)}”`;
    case 'agent.hire_created':
      return `${who} is hiring ${str(d.name) || 'a teammate'} (${str(d.role)})`;
    case 'environment.lease_acquired':
      return `${who} opened a workspace`;
    default:
      return null;
  }
}

/** Recent company activity, mapped to readable lines — so the office's Activity
 *  panel shows real history immediately, not only live websocket events. */
export async function GET(req: Request): Promise<Response> {
  const cfg = getBoardConfig(activeCompanyId(req));
  if (!cfg) return Response.json({ activity: [] });
  try {
    const companyId = await resolveCompanyId(cfg);
    const [agents, activity] = await Promise.all([
      fetchAgents(companyId, cfg),
      pcFetch<PcActivity[]>(`/companies/${companyId}/activity`, {}, cfg).catch(() => [] as PcActivity[]),
    ]);
    const nameOf = new Map(agents.map((a) => [a.id, a.name]));

    const lines: { id: string; text: string; at?: string }[] = [];
    for (const a of activity) {
      const text = describe(a, nameOf.get(a.agentId ?? a.actorId ?? '') ?? '');
      if (text) lines.push({ id: a.id ?? `${a.createdAt}-${lines.length}`, text, at: a.createdAt });
      if (lines.length >= 40) break;
    }
    return Response.json({ activity: lines });
  } catch {
    return Response.json({ activity: [] });
  }
}
