import { describe, it, expect } from 'vitest';
import { useOfficeStore } from './officeStore';

describe('officeStore memory activity', () => {
  it('logs memory.recalled and memory.wrote', () => {
    const s = useOfficeStore.getState();
    s.setCompany([{ id: 'l', name: 'Linus', role: 'engineer', spriteKey: 'Bob', status: 'idle' }], []);
    s.applyEvent({ t: 'memory.recalled', agentId: 'l', snippet: 'we used Stripe' });
    s.applyEvent({ t: 'memory.wrote', agentId: 'l', snippet: 'chose Postgres' });
    const texts = useOfficeStore.getState().activity.map((a) => a.text);
    expect(texts.some((t) => t.includes('🧠') && t.includes('Stripe'))).toBe(true);
    expect(texts.some((t) => t.includes('💾') && t.includes('Postgres'))).toBe(true);
  });
});
