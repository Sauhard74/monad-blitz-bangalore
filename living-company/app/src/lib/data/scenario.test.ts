import { describe, it, expect } from 'vitest';
import { buildProjectScenario } from './scenario';
import { getSeedCompany } from './seed';

describe('buildProjectScenario', () => {
  const seed = getSeedCompany();
  const events = buildProjectScenario('proj-1', 'a mobile app', seed);

  it('opens with project.started and closes with project.completed', () => {
    expect(events[0].event).toMatchObject({ t: 'project.started', projectId: 'proj-1' });
    expect(events.at(-1)?.event).toMatchObject({ t: 'project.completed', projectId: 'proj-1' });
  });

  it('emits events in non-decreasing time order', () => {
    for (let i = 1; i < events.length; i++) {
      expect(events[i].at).toBeGreaterThanOrEqual(events[i - 1].at);
    }
  });

  it('starts and ends exactly one meeting', () => {
    const starts = events.filter((e) => e.event.t === 'meeting.started');
    const ends = events.filter((e) => e.event.t === 'meeting.ended');
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect(starts[0].at).toBeLessThan(ends[0].at);
  });

  it('assigns and completes the same set of tasks', () => {
    const assigned = events
      .filter((e) => e.event.t === 'task.assigned')
      .map((e) => (e.event as { taskId: string }).taskId)
      .sort();
    const completed = events
      .filter((e) => e.event.t === 'task.completed')
      .map((e) => (e.event as { taskId: string }).taskId)
      .sort();
    expect(assigned.length).toBeGreaterThan(0);
    expect(completed).toEqual(assigned);
  });

  it('weaves the brief into the opening line', () => {
    const speak = events.find((e) => e.event.t === 'agent.speak');
    expect((speak?.event as { text: string }).text).toContain('a mobile app');
  });
});
