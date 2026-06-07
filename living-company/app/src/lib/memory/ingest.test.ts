import { describe, it, expect } from 'vitest';
import { activityToMemory, projectRollup } from './ingest';

describe('activityToMemory', () => {
  it('captures a completed issue', () => {
    expect(activityToMemory({ action: 'issue.updated', entityType: 'issue', entityId: 'i1', agentId: 'a1', details: { status: 'done', title: 'Auth service' } }))
      .toEqual({ agentId: 'a1', projectId: 'i1', text: 'Completed: Auth service' });
  });
  it('captures a decision comment (body, capped)', () => {
    const m = activityToMemory({ action: 'issue.comment_added', actorType: 'agent', actorId: 'a1', entityId: 'i2', details: { body: 'We chose Postgres over Mongo because of relational needs.' } });
    expect(m?.text).toContain('Postgres');
    expect(m?.agentId).toBe('a1');
    expect(m?.projectId).toBe('i2');
  });
  it('ignores non-salient activity', () => {
    expect(activityToMemory({ action: 'issue.updated', entityType: 'issue', details: { status: 'in_progress' } })).toBeNull();
    expect(activityToMemory({ action: 'issue.comment_added', details: { body: 'looks good, merging' } })).toBeNull();
    expect(activityToMemory({ action: 'budget.changed', entityType: 'agent' })).toBeNull();
  });
});

describe('projectRollup', () => {
  it('summarizes brief + team', () => {
    expect(projectRollup('a billing system', ['Ada', 'Linus'])).toBe('Shipped "a billing system" — team: Ada, Linus.');
  });
  it('appends outcome when given', () => {
    expect(projectRollup('x', ['Ada'], 'launched on time')).toContain('Outcome: launched on time');
  });
});
