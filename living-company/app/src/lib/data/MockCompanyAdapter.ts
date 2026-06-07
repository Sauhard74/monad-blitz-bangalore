import type { Agent, OfficeEvent, Room } from '@/lib/domain/types';
import type { CompanyDataSource } from '@/lib/data/CompanyDataSource';
import { AsyncEventQueue } from '@/lib/data/eventQueue';
import { type CompanySeed, getHirePlan, getSeedCompany } from '@/lib/data/seed';
import { type TimedEvent, buildProjectScenario } from '@/lib/data/scenario';
import { generateMeetingLines, toAgentBriefs } from '@/lib/dialogue/dialogue';

let projectCounter = 0;

/** First hire arrives after this, then one every interval — the company grows. */
const FIRST_HIRE_MS = 4500;
const HIRE_INTERVAL_MS = 6000;

/**
 * A self-contained data source that simulates Paperclip's model: the company
 * starts as a one-person shop (the CEO) and GROWS as the CEO hires — mirroring
 * `POST /agent-hires`. Swappable for a real `PaperclipAdapter` (M6) that maps the
 * live WebSocket `activity.logged` + `agent.status` stream to the same events.
 */
export class MockCompanyAdapter implements CompanyDataSource {
  private readonly seed: CompanySeed;
  /** The current roster — starts with the CEO, grows as hires land. */
  private roster: Agent[];
  private readonly queue = new AsyncEventQueue<OfficeEvent>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(seed: CompanySeed = getSeedCompany()) {
    this.seed = seed;
    this.roster = [...seed.agents];
    this.scheduleHiring();
  }

  getAgents(): Promise<Agent[]> {
    return Promise.resolve(this.roster);
  }

  getRooms(): Promise<Room[]> {
    return Promise.resolve(this.seed.rooms);
  }

  events(): AsyncIterable<OfficeEvent> {
    return this.queue;
  }

  async startProject(brief: string): Promise<{ projectId: string }> {
    const counter = ++projectCounter;
    const projectId = `proj-${counter}`;
    // The bare id for Tex scoping — `texScope` adds the `proj-` prefix itself, so
    // pass the raw counter to avoid a doubled `proj-proj-N` session id.
    const scopeProjectId = String(counter);
    // The CEO is the org root (reportsTo null) — used to scope every memory call.
    const ceoId = this.ceoId();
    // Flip the UI to "working" immediately, then generate dialogue (LLM or
    // scripted fallback) before scheduling the rest of the choreography.
    this.queue.push({ t: 'project.started', projectId, brief });

    // Recall up front (REAL): ask Tex whether we've shipped anything like this
    // before. Only surface a 🧠 bubble when there's an honest hit — first run
    // (empty memory) shows nothing. Degrades silently if Tex/network is down.
    const snippet = await this.recallMemory(ceoId, scopeProjectId, brief);
    if (snippet) {
      this.queue.push({ t: 'memory.recalled', agentId: ceoId, snippet });
    }

    const team: CompanySeed = { ...this.seed, agents: this.roster };
    const lines = await generateMeetingLines(brief, toAgentBriefs(this.roster));
    const scenario = buildProjectScenario(projectId, brief, team, { lines, skipStart: true });
    this.schedule(scenario);

    // Remember on completion (REAL): just after the project wraps, write what we
    // shipped back to Tex so future related projects can recall it.
    const endAt = Math.max(...scenario.map((s) => s.at));
    this.timers.push(
      setTimeout(() => {
        void this.saveMemory(ceoId, scopeProjectId, brief);
      }, endAt + 400),
    );

    return { projectId };
  }

  /** The org root — the agent that reports to no one (the CEO). */
  private ceoId(): string {
    const root = this.roster.find((a) => a.reportsTo == null) ?? this.roster.find((a) => a.role === 'ceo');
    return root?.id ?? this.roster[0]?.id ?? 'ceo';
  }

  /**
   * Ask Tex (via the same-origin HTTP route) what we recall about `q`. Guarded:
   * any network/Tex failure degrades to `null` so the mock never throws.
   */
  private async recallMemory(agentId: string, projectId: string, q: string): Promise<string | null> {
    try {
      const res = await fetch('/api/memory/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, agentId, projectId }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { topSnippet?: string | null };
      const snippet = j.topSnippet ?? null;
      return snippet && snippet.trim() !== '' ? snippet : null;
    } catch (err) {
      console.warn('[mock] recall failed (ignored):', err);
      return null;
    }
  }

  /**
   * Persist "we shipped this" back to Tex (via the same-origin HTTP route) and,
   * on success, surface a 💾 entry in the Company Brain. Guarded: a Tex/network
   * failure swallows silently so the mock never throws.
   */
  private async saveMemory(agentId: string, projectId: string, brief: string): Promise<void> {
    try {
      const res = await fetch('/api/memory/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Shipped project: ${brief}.`, agentId, projectId }),
      });
      if (!res.ok) return;
      const j = (await res.json()) as { ok?: boolean };
      if (j.ok) {
        this.queue.push({ t: 'memory.wrote', agentId, snippet: `Shipped: ${brief}` });
      }
    } catch (err) {
      console.warn('[mock] remember failed (ignored):', err);
    }
  }

  /** Push a single event immediately (used by in-scene idle behaviors/tests). */
  emit(event: OfficeEvent): void {
    this.queue.push(event);
  }

  /** Bring the team on, one hire at a time, so the office visibly grows. */
  private scheduleHiring(): void {
    getHirePlan().forEach((agent, i) => {
      const at = FIRST_HIRE_MS + i * HIRE_INTERVAL_MS;
      this.timers.push(
        setTimeout(() => {
          this.roster = [...this.roster, agent];
          this.queue.push({ t: 'agent.hired', agent });
        }, at),
      );
    });
  }

  private schedule(events: TimedEvent[]): void {
    for (const { at, event } of events) {
      this.timers.push(setTimeout(() => this.queue.push(event), at));
    }
  }

  dispose(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.queue.close();
  }
}
