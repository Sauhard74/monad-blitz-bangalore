import { describe, it, expect } from 'vitest';
import { characterForAgent, isHireActivity, mapActivity, mapAgent, mapPcStatus } from './paperclipMapper';

describe('paperclip mapper', () => {
  it('maps a Paperclip agent to our domain agent', () => {
    const a = mapAgent({ id: 'a1', name: 'Ada', role: 'ceo', reportsTo: null, status: 'running' }, 0);
    expect(a).toMatchObject({ id: 'a1', name: 'Ada', role: 'ceo', status: 'working' });
    expect(a.spriteKey).toBe('Amelia'); // ceo → Amelia
    expect(a.reportsTo).toBeUndefined();
  });

  it('round-robins characters for unknown roles', () => {
    expect(characterForAgent('analyst', 0)).toBe('Amelia');
    expect(characterForAgent('analyst', 1)).toBe('Bob');
  });

  it('maps statuses (running → working, else idle)', () => {
    expect(mapPcStatus('running')).toBe('working');
    expect(mapPcStatus('idle')).toBe('idle');
    expect(mapPcStatus('paused')).toBe('idle');
  });

  it('detects hire activities', () => {
    expect(isHireActivity({ action: 'agent.created', entityType: 'agent', entityId: 'a2' })).toBe(true);
    expect(isHireActivity({ action: 'issue.created', entityType: 'issue' })).toBe(false);
  });

  it('maps a completed issue to task.completed', () => {
    const e = mapActivity({
      action: 'issue.updated',
      entityType: 'issue',
      entityId: 'i1',
      agentId: 'a1',
      details: { status: 'done' },
    });
    expect(e).toEqual({ t: 'task.completed', agentId: 'a1', taskId: 'i1' });
  });

  it('maps a comment to a speech bubble (truncated)', () => {
    const e = mapActivity({
      action: 'issue.comment_added',
      actorType: 'agent',
      actorId: 'a1',
      details: { body: 'x'.repeat(200) },
    });
    expect(e?.t).toBe('agent.speak');
    expect((e as { text: string }).text.length).toBe(90);
  });

  it('skips actions it does not handle', () => {
    expect(mapActivity({ action: 'budget.changed', entityType: 'agent' })).toBeNull();
  });
});
