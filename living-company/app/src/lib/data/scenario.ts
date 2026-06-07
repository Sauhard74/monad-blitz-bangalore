import type { OfficeEvent } from '@/lib/domain/types';
import type { CompanySeed } from '@/lib/data/seed';
import { type MeetingLine, scriptedMeetingLines, toAgentBriefs } from '@/lib/dialogue/dialogue';

/** An office event scheduled to fire `at` milliseconds after a project starts. */
export interface TimedEvent {
  at: number;
  event: OfficeEvent;
}

export interface ScenarioOptions {
  /** Pre-generated meeting dialogue (e.g. from the LLM). Falls back to scripted. */
  lines?: MeetingLine[];
  /** Skip the opening `project.started` event (when it was already emitted). */
  skipStart?: boolean;
}

const MEETING_ROOM = 'meeting';

const TASKS: { id: string; title: string }[] = [
  { id: 'eng', title: 'Build core feature' },
  { id: 'des', title: 'Design the experience' },
  { id: 'mkt', title: 'Plan the launch' },
  { id: 'pm', title: 'Coordinate delivery' },
];

/**
 * Build the deterministic event sequence for a project: the team gathers in the
 * War Room, discusses, takes on tasks, disperses to their desks, ships, and
 * wraps. Pure and timing-explicit so it's trivial to test and to replay.
 */
export function buildProjectScenario(
  projectId: string,
  brief: string,
  seed: CompanySeed,
  opts: ScenarioOptions = {},
): TimedEvent[] {
  const out: TimedEvent[] = [];
  const ids = seed.agents.map((a) => a.id);
  const lines = opts.lines ?? scriptedMeetingLines(brief, toAgentBriefs(seed.agents));
  let t = 0;

  if (!opts.skipStart) {
    out.push({ at: t, event: { t: 'project.started', projectId, brief } });
  }

  // Everyone heads to the War Room (staggered).
  t += 400;
  ids.forEach((id, i) => {
    out.push({ at: t + i * 250, event: { t: 'agent.move', agentId: id, toRoomId: MEETING_ROOM } });
  });

  // Meeting begins once they've had time to arrive.
  t += ids.length * 250 + 2600;
  out.push({ at: t, event: { t: 'meeting.started', roomId: MEETING_ROOM, agentIds: ids } });

  // Discussion round.
  t += 600;
  for (const line of lines) {
    out.push({ at: t, event: { t: 'agent.speak', agentId: line.id, text: line.text } });
    t += 1900;
  }

  // Tasks assigned, meeting ends.
  for (const task of TASKS) {
    out.push({
      at: t,
      event: { t: 'task.assigned', agentId: task.id, taskId: `${projectId}-${task.id}`, title: task.title },
    });
    t += 250;
  }
  t += 400;
  out.push({ at: t, event: { t: 'meeting.ended', roomId: MEETING_ROOM } });

  // Everyone returns to their cabin to work.
  t += 300;
  seed.agents.forEach((a, i) => {
    const desk = seed.desks.find((d) => d.id === a.homeDeskId);
    if (desk) {
      out.push({ at: t + i * 200, event: { t: 'agent.move', agentId: a.id, toRoomId: desk.roomId } });
    }
  });

  // Work gets done.
  t += ids.length * 200 + 3200;
  for (const task of TASKS) {
    out.push({
      at: t,
      event: { t: 'task.completed', agentId: task.id, taskId: `${projectId}-${task.id}` },
    });
    t += 500;
  }

  t += 600;
  out.push({ at: t, event: { t: 'project.completed', projectId } });

  return out;
}
