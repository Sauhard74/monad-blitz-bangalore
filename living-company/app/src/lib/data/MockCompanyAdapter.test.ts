import { describe, it, expect } from 'vitest';
import { MockCompanyAdapter } from './MockCompanyAdapter';
import type { OfficeEvent } from '@/lib/domain/types';

describe('MockCompanyAdapter', () => {
  it('exposes the seed roster and rooms', async () => {
    const a = new MockCompanyAdapter();
    const agents = await a.getAgents();
    const rooms = await a.getRooms();
    expect(agents.map((x) => x.id)).toContain('ceo');
    expect(rooms.map((r) => r.id)).toContain('meeting');
    a.dispose();
  });

  it('delivers emitted events through the events() stream', async () => {
    const a = new MockCompanyAdapter();
    const received: OfficeEvent[] = [];
    const done = (async () => {
      for await (const e of a.events()) {
        received.push(e);
        if (received.length === 2) break;
      }
    })();
    a.emit({ t: 'agent.speak', agentId: 'ceo', text: 'hi' });
    a.emit({ t: 'agent.think', agentId: 'eng', text: 'hmm' });
    await done;
    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ t: 'agent.speak', agentId: 'ceo' });
    a.dispose();
  });

  it('startProject returns an id and schedules a project.started event', async () => {
    const a = new MockCompanyAdapter();
    const firstEvent = (async () => {
      for await (const e of a.events()) return e;
    })();
    const { projectId } = await a.startProject('a game');
    expect(projectId).toMatch(/^proj-/);
    expect(await firstEvent).toMatchObject({ t: 'project.started' });
    a.dispose();
  });
});
