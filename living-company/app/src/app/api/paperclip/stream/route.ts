import WebSocket from 'ws';
import type { OfficeEvent } from '@/lib/domain/types';
import {
  activeCompanyId,
  companyWsUrl,
  fetchAgents,
  getBoardConfig,
  resolveCompanyId,
} from '@/lib/server/paperclip';
import {
  type PcActivity,
  isHireActivity,
  mapActivity,
  mapAgent,
  mapPcStatus,
} from '@/lib/data/paperclipMapper';
import { publishMemory, subscribeMemory } from '@/lib/server/memoryBus';
import { getTexConfig, remember } from '@/lib/server/tex';
import { activityToMemory } from '@/lib/memory/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-Sent-Events bridge: opens the Paperclip company WebSocket (server-side,
 * with the API key) and forwards mapped {@link OfficeEvent}s to the browser. The
 * browser's PaperclipAdapter consumes this — it never sees the key or the WS.
 */
export async function GET(request: Request): Promise<Response> {
  const cfg = getBoardConfig(activeCompanyId(request));
  if (!cfg) return new Response('Paperclip not configured', { status: 503 });

  const companyId = await resolveCompanyId(cfg);
  let hireIndex = 0;
  const seenAgents = new Set<string>();

  const encoder = new TextEncoder();
  let ws: WebSocket | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      // Enqueueing onto a closed/errored controller throws; the WS and the 25s
      // ping can both fire after the client has gone, so guard every write.
      const enqueue = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true;
        }
      };
      const send = (event: OfficeEvent) => enqueue(`data: ${JSON.stringify(event)}\n\n`);
      const comment = (text: string) => enqueue(`: ${text}\n\n`);
      const closeController = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      comment('connected');

      // Memory events (recall/remember) are produced outside this request — by an
      // agent's MCP tool calls or the auto-ingester — so subscribe the bus and
      // forward them into the same office stream.
      const unsubMemory = subscribeMemory(companyId, send);

      ws = new WebSocket(companyWsUrl(cfg, companyId));

      ws.on('message', (raw: WebSocket.RawData) => {
        let msg: { type?: string; payload?: Record<string, unknown> };
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        void handleLiveEvent(msg, { cfg, companyId, send, seenAgents, nextIndex: () => hireIndex++ });
      });

      // Heartbeat comment so proxies don't drop the SSE connection.
      const ping = setInterval(() => comment('ping'), 25_000);

      ws.on('error', () => comment('ws error'));
      ws.on('close', () => {
        clearInterval(ping);
        unsubMemory();
        closeController();
      });

      request.signal.addEventListener('abort', () => {
        clearInterval(ping);
        unsubMemory();
        ws?.close();
        closeController();
      });
    },
    cancel() {
      ws?.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

interface Ctx {
  cfg: NonNullable<ReturnType<typeof getBoardConfig>>;
  companyId: string;
  send: (e: OfficeEvent) => void;
  seenAgents: Set<string>;
  nextIndex: () => number;
}

async function handleLiveEvent(
  msg: { type?: string; payload?: Record<string, unknown> },
  ctx: Ctx,
): Promise<void> {
  const { type, payload = {} } = msg;

  if (type === 'agent.status') {
    const agentId = String(payload.agentId ?? '');
    const status = String(payload.status ?? payload.outcome ?? '');
    if (agentId && status) ctx.send({ t: 'agent.statusChanged', agentId, status: mapPcStatus(status) });
    return;
  }

  if (type === 'activity.logged') {
    const a = payload as unknown as PcActivity;
    if (isHireActivity(a) && a.entityId && !ctx.seenAgents.has(a.entityId)) {
      ctx.seenAgents.add(a.entityId);
      // Fetch the new agent's details to emit a full agent.hired.
      try {
        const agents = await fetchAgents(ctx.companyId, ctx.cfg);
        const pc = agents.find((x) => x.id === a.entityId);
        if (pc) ctx.send({ t: 'agent.hired', agent: mapAgent(pc, ctx.nextIndex()) });
      } catch {
        /* skip if fetch fails */
      }
      return;
    }
    const event = mapActivity(a);
    if (event) ctx.send(event);

    // Auto-ingest safety-net: high-signal activity (a finished issue, a decision
    // comment) is written to Tex so org memory grows even when agents don't call
    // the `remember` tool themselves. Fire-and-forget — never blocks the stream.
    void ingestMemory(a, ctx);
  }
}

/** Passively persist finished work / decisions to Tex, then surface a 💾 save. */
async function ingestMemory(a: PcActivity, ctx: Ctx): Promise<void> {
  const write = activityToMemory(a);
  if (!write) return;
  const cfg = getTexConfig();
  if (!cfg) return;
  try {
    const ok = await remember(cfg, write.text, { agentId: write.agentId, projectId: write.projectId });
    if (ok && write.agentId) {
      publishMemory(ctx.companyId, { t: 'memory.wrote', agentId: write.agentId, snippet: write.text });
    }
  } catch {
    /* memory is best-effort — a Tex hiccup must never disturb the office stream */
  }
}
