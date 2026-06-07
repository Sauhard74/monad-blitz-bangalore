import { NextResponse } from 'next/server';
import { azureChatJSON, getAzureConfig } from '@/lib/server/azure';
import type { AgentBrief, MeetingLine } from '@/lib/dialogue/dialogue';

export const runtime = 'nodejs';

const SYSTEM =
  'You write short, lively dialogue for a retro game-style virtual company where ' +
  'AI employees collaborate in an office. Each line is punchy, in-character, a ' +
  'little playful, and under 90 characters. Always respond with strict JSON.';

const INSTRUCTION =
  'Write the kickoff meeting as an ordered list of speech lines. Order: the CEO ' +
  'frames the project; the PM says how they will organize it; the Engineer how ' +
  'they will build it; the Designer how they will shape the experience; the ' +
  'Marketer how they will launch it; the CEO rallies the team to close. Return ' +
  'JSON of the form {"lines":[{"id":"<agent id>","text":"<line>"}]}. The "id" ' +
  'MUST be the exact lowercase agent id token (the part before " = "), e.g. ' +
  '"ceo" or "pm" — NEVER the person\'s name.';

/** Resolve a model-provided id to a real agent id (by id, name, or role). */
function resolveAgentId(raw: unknown, agents: AgentBrief[]): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  const match = agents.find(
    (a) =>
      a.id.toLowerCase() === key ||
      a.name.toLowerCase() === key ||
      a.role.toLowerCase() === key,
  );
  return match?.id ?? null;
}

export async function POST(request: Request): Promise<Response> {
  if (!getAzureConfig()) {
    return NextResponse.json({ ok: false, reason: 'azure-not-configured' }, { status: 503 });
  }

  let brief = '';
  let agents: AgentBrief[] = [];
  try {
    const body = (await request.json()) as { brief?: string; agents?: AgentBrief[] };
    brief = (body.brief ?? '').toString().slice(0, 280);
    agents = Array.isArray(body.agents) ? body.agents : [];
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad-request' }, { status: 400 });
  }

  const roster = agents.map((a) => `${a.id} = ${a.name}, ${a.role}`).join('\n');

  try {
    const out = await azureChatJSON<{ lines?: MeetingLine[] }>(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Project brief: "${brief}"\n\nTeam:\n${roster}\n\n${INSTRUCTION}` },
      ],
      { maxTokens: 400, temperature: 0.9 },
    );
    // Normalize ids the model may have returned as names/roles, drop unresolved.
    const lines = (out.lines ?? [])
      .map((l) => ({ id: resolveAgentId(l?.id, agents), text: l?.text }))
      .filter((l): l is MeetingLine => typeof l.id === 'string' && typeof l.text === 'string');
    return NextResponse.json({ lines });
  } catch (error) {
    console.error('[api/meeting] generation failed', error);
    return NextResponse.json({ ok: false, reason: 'generation-failed' }, { status: 502 });
  }
}
