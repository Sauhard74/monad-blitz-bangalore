import type { Agent, OfficeEvent, Room } from '@/lib/domain/types';
import { isOfficeEvent } from '@/lib/domain/types';
import type { CompanyDataSource } from '@/lib/data/CompanyDataSource';
import { AsyncEventQueue } from '@/lib/data/eventQueue';
import { companyQuery } from '@/lib/data/activeCompany';
import { ROOMS } from '@/game/office/officeMap';

/**
 * Real data source backed by a self-hosted Paperclip company. Talks to our own
 * server routes (which hold the API key): `/api/paperclip/bootstrap` for the
 * initial roster, `/api/paperclip/stream` (SSE) for live events mapped from the
 * Paperclip WebSocket, and `/api/paperclip/project` to kick off work.
 *
 * Drop-in for `MockCompanyAdapter` — same `OfficeEvent` vocabulary, so the
 * office renders real Paperclip activity with no UI changes.
 */
export class PaperclipAdapter implements CompanyDataSource {
  private readonly queue = new AsyncEventQueue<OfficeEvent>();
  private source?: EventSource;

  constructor() {
    this.connect();
  }

  private connect(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    this.source = new EventSource(`/api/paperclip/stream${companyQuery()}`);
    this.source.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as unknown;
        if (isOfficeEvent(ev)) this.queue.push(ev);
      } catch {
        /* ignore malformed frame */
      }
    };
    // EventSource auto-reconnects on error; nothing to do.
  }

  async getAgents(): Promise<Agent[]> {
    try {
      const res = await fetch(`/api/paperclip/bootstrap${companyQuery()}`, { cache: 'no-store' });
      if (!res.ok) return [];
      const data = (await res.json()) as { agents?: Agent[] };
      return data.agents ?? [];
    } catch {
      return [];
    }
  }

  getRooms(): Promise<Room[]> {
    return Promise.resolve(ROOMS);
  }

  events(): AsyncIterable<OfficeEvent> {
    return this.queue;
  }

  async startProject(brief: string): Promise<{ projectId: string }> {
    try {
      const res = await fetch(`/api/paperclip/project${companyQuery()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      const data = (await res.json()) as { projectId?: string };
      return { projectId: data.projectId ?? `proj-${Date.now()}` };
    } catch {
      return { projectId: `proj-${Date.now()}` };
    }
  }

  dispose(): void {
    this.source?.close();
    this.queue.close();
  }
}
