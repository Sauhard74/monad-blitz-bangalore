import { describe, it, expect, vi } from 'vitest';
import { generateMeetingLines, scriptedMeetingLines } from './dialogue';
import type { AgentBrief } from './dialogue';

const AGENTS: AgentBrief[] = [
  { id: 'ceo', name: 'Ada', role: 'CEO' },
  { id: 'eng', name: 'Linus', role: 'Engineer' },
];

const okResponse = (body: unknown) =>
  ({ ok: true, json: () => Promise.resolve(body) }) as Response;

describe('generateMeetingLines', () => {
  it('returns the model lines when the route responds well', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ lines: [{ id: 'ceo', text: 'Big idea incoming.' }] }),
    );
    const lines = await generateMeetingLines('a game', AGENTS, fetchImpl as unknown as typeof fetch);
    expect(lines).toEqual([{ id: 'ceo', text: 'Big idea incoming.' }]);
  });

  it('falls back to scripted lines when the fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const lines = await generateMeetingLines('a game', AGENTS, fetchImpl as unknown as typeof fetch);
    expect(lines).toEqual(scriptedMeetingLines('a game', AGENTS));
    expect(lines[0].text).toContain('a game');
  });

  it('falls back when the route returns a non-ok status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false } as Response);
    const lines = await generateMeetingLines('x', AGENTS, fetchImpl as unknown as typeof fetch);
    expect(lines).toEqual(scriptedMeetingLines('x', AGENTS));
  });

  it('falls back when the model returns lines for unknown agents', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      okResponse({ lines: [{ id: 'ghost', text: 'boo' }] }),
    );
    const lines = await generateMeetingLines('x', AGENTS, fetchImpl as unknown as typeof fetch);
    expect(lines).toEqual(scriptedMeetingLines('x', AGENTS));
  });
});
