import { activeCompanyId, fetchAgents, getBoardConfig, pcFetch, resolveCompanyId } from '@/lib/server/paperclip';
import { isMonadConfigured, payForWork, paidWorkIds } from '@/lib/server/monad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PcActivity {
  action?: string;
  agentId?: string;
  actorId?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Settle the agent economy on Monad: for each work product the company has
 * shipped that hasn't been paid on-chain yet, pay the responsible agent in MON
 * through the AgentPayroll contract. Idempotent (reads WorkPaid events first).
 */
export async function POST(req: Request): Promise<Response> {
  if (!isMonadConfigured()) {
    return Response.json({ ok: false, reason: 'monad-not-configured', paid: [] });
  }
  const cfg = getBoardConfig(activeCompanyId(req));
  if (!cfg) return Response.json({ ok: false, reason: 'no-company', paid: [] });

  try {
    const companyId = await resolveCompanyId(cfg);
    const [agents, activity, alreadyPaid] = await Promise.all([
      fetchAgents(companyId, cfg),
      pcFetch<PcActivity[]>(`/companies/${companyId}/activity`, {}, cfg).catch(() => [] as PcActivity[]),
      paidWorkIds(),
    ]);
    const agentById = new Map(agents.map((a) => [a.id, a]));

    // Newest-last so payments land in the order work shipped.
    const shipments = activity
      .filter((a) => a.action === 'issue.work_product_created')
      .reverse();

    const paid: { workId: string; agent: string; tx: string }[] = [];
    for (const s of shipments) {
      const workId = str(s.details?.workProductId) || `${s.createdAt}`;
      if (alreadyPaid.has(workId)) continue;
      const agent = agentById.get(s.agentId ?? s.actorId ?? '');
      if (!agent) continue;
      try {
        const tx = await payForWork({
          agentId: agent.id,
          name: agent.name,
          role: agent.role,
          workId,
          note: 'shipped a work product',
        });
        paid.push({ workId, agent: agent.name, tx });
        alreadyPaid.add(workId);
      } catch (e) {
        console.error('[monad/payroll] pay failed', e);
        break; // likely out of gas/treasury — stop cleanly
      }
    }
    return Response.json({ ok: true, paid });
  } catch (e) {
    console.error('[monad/payroll]', e);
    return Response.json({ ok: false, reason: 'sync-failed', paid: [] }, { status: 502 });
  }
}
