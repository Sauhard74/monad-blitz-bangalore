import type { Agent, AgentStatus, OfficeEvent } from '@/lib/domain/types';

/**
 * Pure mapping from Paperclip's model to our office events. Kept client-safe and
 * side-effect-free so it can be unit-tested and run on either side of the wire.
 * See docs/plans/2026-06-06-paperclip-model.md.
 */

/** The LimeZu character sheets the scene preloads. */
const CHARACTERS = ['Amelia', 'Bob', 'Lucy', 'Adam', 'Alex'];

const ROLE_CHARACTER: Record<string, string> = {
  ceo: 'Amelia',
  cto: 'Bob',
  engineer: 'Bob',
  devops: 'Bob',
  designer: 'Lucy',
  cmo: 'Adam',
  marketer: 'Adam',
  pm: 'Alex',
  cfo: 'Alex',
};

/** Pick a character sheet for an agent by role (stable), else round-robin. */
export function characterForAgent(role: string, index: number): string {
  return ROLE_CHARACTER[role] ?? CHARACTERS[index % CHARACTERS.length];
}

/** Map a Paperclip agent status to our office status (`running` → working). */
export function mapPcStatus(status: string): AgentStatus {
  switch (status) {
    case 'running':
      return 'working';
    default:
      // active/idle/paused/error/pending_approval/terminated all sit/idle visually
      return 'idle';
  }
}

export interface PcAgentLike {
  id: string;
  name: string;
  role?: string;
  title?: string;
  reportsTo?: string | null;
  status?: string;
}

/** Map a raw Paperclip agent to our domain Agent. */
export function mapAgent(pc: PcAgentLike, index: number): Agent {
  const role = pc.role || 'general';
  return {
    id: pc.id,
    name: pc.name,
    role,
    title: pc.title,
    spriteKey: characterForAgent(role, index),
    reportsTo: pc.reportsTo ?? undefined,
    status: mapPcStatus(pc.status ?? 'idle'),
  };
}

/** A Paperclip activity-log record (subset of fields we use). */
export interface PcActivity {
  action: string;
  entityType?: string;
  entityId?: string;
  agentId?: string;
  actorType?: string;
  actorId?: string;
  details?: Record<string, unknown> | null;
}

function actorAgentId(a: PcActivity): string | undefined {
  if (a.agentId) return a.agentId;
  if (a.actorType === 'agent' && a.actorId) return a.actorId;
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Map a Paperclip `activity.logged` record to an office event (or null to skip).
 * Agent hires are handled separately (they need an agent fetch for full detail).
 */
export function mapActivity(a: PcActivity): OfficeEvent | null {
  const d = a.details ?? {};
  const agentId = actorAgentId(a);
  const taskId = a.entityId ?? str(d.issueId) ?? 'task';

  switch (a.action) {
    case 'issue.created':
    case 'issue.child_created': {
      const assignee = str(d.assigneeAgentId) ?? agentId;
      if (!assignee) return null;
      return { t: 'task.assigned', agentId: assignee, taskId, title: str(d.title) ?? 'a task' };
    }
    case 'issue.checked_out':
      return agentId ? { t: 'agent.move', agentId, toRoomId: 'workspace' } : null;
    case 'issue.updated': {
      const status = str(d.status);
      if (status === 'in_progress' && agentId) return { t: 'agent.move', agentId, toRoomId: 'workspace' };
      if (status === 'done' && agentId) return { t: 'task.completed', agentId, taskId };
      return null;
    }
    case 'issue.comment_added': {
      const body = str(d.body) ?? str(d.comment);
      if (!agentId || !body) return null;
      return { t: 'agent.speak', agentId, text: body.slice(0, 90) };
    }
    default:
      return null;
  }
}

/** Actions that mean "a new agent joined" — the adapter fetches + emits agent.hired. */
export const HIRE_ACTIONS = new Set(['agent.created', 'agent.approved', 'agent.hire_created']);

export function isHireActivity(a: PcActivity): boolean {
  return a.entityType === 'agent' && HIRE_ACTIONS.has(a.action);
}
