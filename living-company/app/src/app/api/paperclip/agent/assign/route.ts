import { activeCompanyId, getBoardConfig, pcFetch, resolveCompanyId } from '@/lib/server/paperclip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Assign a brand-new task to a specific agent and wake them to start on it.
 * The office is board-authenticated, so the human can hand work directly to any
 * agent (not just the CEO). Heartbeats are wake-on-demand, so after creating the
 * issue we nudge the agent — reusing its session to avoid a cold start.
 */
export async function POST(req: Request): Promise<Response> {
  const cfg = getBoardConfig(activeCompanyId(req));
  if (!cfg) return Response.json({ ok: false, reason: 'not-configured' }, { status: 503 });

  const { agentId, title, description } = (await req.json()) as {
    agentId?: string;
    title?: string;
    description?: string;
  };
  if (!agentId || !title?.trim()) {
    return Response.json({ ok: false, reason: 'agentId-and-title-required' }, { status: 400 });
  }

  try {
    const companyId = await resolveCompanyId(cfg);
    const issue = await pcFetch<{ id: string; identifier?: string }>(
      `/companies/${companyId}/issues`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim().slice(0, 200),
          description: (description ?? '').trim().slice(0, 4000),
          status: 'todo',
          priority: 'high',
          assigneeAgentId: agentId,
        }),
      },
      cfg,
    );

    // Best-effort wake so the agent acts now rather than on the next reconcile.
    let dispatched = false;
    try {
      await pcFetch(
        `/agents/${agentId}/wakeup`,
        {
          method: 'POST',
          body: JSON.stringify({
            source: 'on_demand',
            reason: 'Task assigned from the office',
            forceFreshSession: false,
          }),
        },
        cfg,
      );
      dispatched = true;
    } catch {
      /* the periodic reconciler will still pick the assignment up */
    }

    return Response.json({ ok: true, issueId: issue.id, identifier: issue.identifier, dispatched });
  } catch (error) {
    console.error('[api/paperclip/agent/assign]', error);
    return Response.json({ ok: false, reason: 'assign-failed' }, { status: 502 });
  }
}
