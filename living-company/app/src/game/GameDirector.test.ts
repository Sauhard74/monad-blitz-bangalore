import { describe, it, expect, vi } from 'vitest';
import { GameDirector, type OfficeWorld } from './GameDirector';
import type { OfficeEvent } from '@/lib/domain/types';

function makeWorld(): OfficeWorld {
  return {
    spawnAgent: vi.fn(),
    moveAgentToRoom: vi.fn(),
    speak: vi.fn(),
    think: vi.fn(),
    gather: vi.fn(),
    endMeeting: vi.fn(),
  };
}

describe('GameDirector.handle', () => {
  it('always forwards the event to the store', () => {
    const world = makeWorld();
    const applyEvent = vi.fn();
    const d = new GameDirector(world, applyEvent);
    const event: OfficeEvent = { t: 'project.started', projectId: 'p1', brief: 'x' };
    d.handle(event);
    expect(applyEvent).toHaveBeenCalledWith(event);
  });

  it('routes each world-affecting event to the right call', () => {
    const world = makeWorld();
    const d = new GameDirector(world, vi.fn());

    d.handle({ t: 'agent.move', agentId: 'ceo', toRoomId: 'meeting' });
    expect(world.moveAgentToRoom).toHaveBeenCalledWith('ceo', 'meeting');

    d.handle({ t: 'agent.speak', agentId: 'ceo', text: 'hi' });
    expect(world.speak).toHaveBeenCalledWith('ceo', 'hi');

    d.handle({ t: 'agent.think', agentId: 'eng', text: 'hmm' });
    expect(world.think).toHaveBeenCalledWith('eng', 'hmm');

    d.handle({ t: 'memory.recalled', agentId: 'des', snippet: 'last time…' });
    expect(world.think).toHaveBeenCalledWith('des', 'last time…');

    d.handle({ t: 'meeting.started', roomId: 'meeting', agentIds: ['ceo', 'eng'] });
    expect(world.gather).toHaveBeenCalledWith('meeting', ['ceo', 'eng']);

    d.handle({ t: 'meeting.ended', roomId: 'meeting' });
    expect(world.endMeeting).toHaveBeenCalledWith('meeting');
  });

  it('does not touch the world for store-only events', () => {
    const world = makeWorld();
    const d = new GameDirector(world, vi.fn());
    d.handle({ t: 'task.assigned', agentId: 'eng', taskId: 't1', title: 'Build' });
    d.handle({ t: 'project.completed', projectId: 'p1' });
    expect(world.moveAgentToRoom).not.toHaveBeenCalled();
    expect(world.speak).not.toHaveBeenCalled();
    expect(world.gather).not.toHaveBeenCalled();
  });
});
