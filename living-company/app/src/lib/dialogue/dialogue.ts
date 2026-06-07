import type { Agent } from '@/lib/domain/types';

/** One line of meeting dialogue, attributed to an agent id. */
export interface MeetingLine {
  id: string;
  text: string;
}

/** The minimal agent shape the dialogue layer needs. */
export interface AgentBrief {
  id: string;
  name: string;
  role: string;
}

export function toAgentBriefs(agents: Agent[]): AgentBrief[] {
  return agents.map((a) => ({ id: a.id, name: a.name, role: a.role }));
}

/** Deterministic, offline fallback dialogue keyed to the roles we ship. */
export function scriptedMeetingLines(brief: string, agents: AgentBrief[]): MeetingLine[] {
  const has = (id: string) => agents.some((a) => a.id === id);
  const lines: MeetingLine[] = [];
  if (has('ceo')) lines.push({ id: 'ceo', text: `Team — new project: ${brief}` });
  if (has('pm')) lines.push({ id: 'pm', text: "I'll break this into tasks." });
  if (has('eng')) lines.push({ id: 'eng', text: 'I can build the core of that.' });
  if (has('des')) lines.push({ id: 'des', text: "I'll design how it feels." });
  if (has('mkt')) lines.push({ id: 'mkt', text: "And I'll plan the launch." });
  if (has('ceo')) lines.push({ id: 'ceo', text: "Let's make it memorable. Go!" });
  return lines;
}

/** Keep only well-formed lines that reference a real agent. */
function sanitize(lines: unknown, agents: AgentBrief[]): MeetingLine[] | null {
  if (!Array.isArray(lines)) return null;
  const ids = new Set(agents.map((a) => a.id));
  const clean = lines
    .filter(
      (l): l is MeetingLine =>
        !!l &&
        typeof (l as MeetingLine).id === 'string' &&
        typeof (l as MeetingLine).text === 'string' &&
        ids.has((l as MeetingLine).id) &&
        (l as MeetingLine).text.trim().length > 0,
    )
    .map((l) => ({ id: l.id, text: l.text.trim().slice(0, 120) }));
  return clean.length > 0 ? clean : null;
}

const TIMEOUT_MS = 9000;

/**
 * Generate the kickoff meeting dialogue for a brief. Tries the server LLM route;
 * on any failure (no key, timeout, bad shape) falls back to scripted lines so
 * the office always has something to say. Never throws.
 */
export async function generateMeetingLines(
  brief: string,
  agents: AgentBrief[],
  fetchImpl: typeof fetch = fetch,
): Promise<MeetingLine[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl('/api/meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief, agents }),
      signal: controller.signal,
    });
    if (!res.ok) return scriptedMeetingLines(brief, agents);
    const data = (await res.json()) as { lines?: unknown };
    return sanitize(data.lines, agents) ?? scriptedMeetingLines(brief, agents);
  } catch {
    return scriptedMeetingLines(brief, agents);
  } finally {
    clearTimeout(timer);
  }
}
