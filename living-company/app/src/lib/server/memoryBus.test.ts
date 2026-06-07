import { describe, it, expect } from 'vitest';
import { publishMemory, subscribeMemory } from './memoryBus';
import type { OfficeEvent } from '@/lib/domain/types';

describe('memoryBus', () => {
  it('delivers published events to current subscribers, scoped by company', () => {
    const got: OfficeEvent[] = [];
    const unsub = subscribeMemory('c1', (e) => got.push(e));
    publishMemory('c1', { t: 'memory.recalled', agentId: 'a', snippet: 's' });
    publishMemory('c2', { t: 'memory.recalled', agentId: 'b', snippet: 'other' }); // different company — not delivered
    unsub();
    publishMemory('c1', { t: 'memory.recalled', agentId: 'a', snippet: 'after' });  // after unsub — not delivered
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ snippet: 's' });
  });
});
