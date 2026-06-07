import type { PcActivity } from '@/lib/data/paperclipMapper';

/**
 * Pure mapping logic for the automatic memory ingester. Turns a raw Paperclip
 * activity record into a memory write for high-signal events (or null to skip),
 * and rolls a finished project up into a single memory turn.
 *
 * Side-effect-free so it can be unit-tested and run on either side of the wire.
 */

export interface MemoryWrite {
  agentId?: string;
  projectId?: string;
  text: string;
}

/** Markers that flag a comment as recording a decision worth remembering. */
const DECISION_MARKER = /decision|chose|decided|because|went with|trade-?off/i;

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Map a Paperclip activity to a memory write, or null when it carries no
 * lasting signal (in-progress updates, chit-chat comments, other actions).
 */
export function activityToMemory(a: PcActivity): MemoryWrite | null {
  const d = a.details ?? {};

  switch (a.action) {
    case 'issue.updated': {
      if (str(d.status) !== 'done') return null;
      return {
        agentId: a.agentId,
        projectId: a.entityId,
        text: 'Completed: ' + (str(d.title) ?? 'a task'),
      };
    }
    case 'issue.comment_added': {
      const body = str(d.body);
      if (!body || !DECISION_MARKER.test(body)) return null;
      return {
        agentId: a.actorId ?? a.agentId,
        projectId: a.entityId,
        text: body.trim().slice(0, 280),
      };
    }
    default:
      return null;
  }
}

/**
 * Roll a finished project up into a single deterministic memory turn:
 * the brief, the team that shipped it, and an optional outcome.
 */
export function projectRollup(brief: string, agentNames: string[], outcome?: string): string {
  const base = `Shipped "${brief.trim()}" — team: ${agentNames.join(', ')}.`;
  const tail = outcome?.trim();
  return tail ? `${base} Outcome: ${tail}` : base;
}
