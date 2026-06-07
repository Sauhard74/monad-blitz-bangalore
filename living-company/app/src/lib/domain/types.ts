/**
 * Core domain model for Living Company.
 *
 * Everything the office world shows is described by these types. The world is
 * driven by a stream of typed `OfficeEvent`s (see design doc §5); a GameDirector
 * consumes that stream and drives both the Phaser scene and the React HUD.
 */

/** Paperclip agent roles (lower-case ids), mapped to friendly labels in the UI. */
export type AgentRole =
  | 'ceo'
  | 'cto'
  | 'cmo'
  | 'cfo'
  | 'engineer'
  | 'designer'
  | 'marketer'
  | 'pm'
  | 'qa'
  | 'devops'
  | 'researcher'
  | 'general'
  | (string & {});

/** Office-facing status (Paperclip `running` maps to `working`). */
export type AgentStatus = 'idle' | 'working' | 'meeting' | 'thinking';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  /** Human title, e.g. "Chief Executive". */
  title?: string;
  /** Sprite-sheet key used by Phaser for this agent's walk cycles. */
  spriteKey: string;
  /** Desk the agent is assigned (undefined until they've claimed one). */
  homeDeskId?: string;
  /** Org-chart edge: the manager this agent reports to (CEO reports to no one). */
  reportsTo?: string;
  status: AgentStatus;
}

/** A tile-space rectangle, measured in tiles (not pixels). */
export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RoomKind = 'cabin' | 'meeting' | 'common';

export interface Room {
  id: string;
  kind: RoomKind;
  /** Human-friendly label, e.g. "CEO's Office" or "War Room". */
  name: string;
  rect: TileRect;
}

/**
 * A desk/workstation inside a room. Agents path to their desk when idle/working.
 */
export interface Desk {
  id: string;
  roomId: string;
  /** Tile coordinate the agent stands at. */
  tileX: number;
  tileY: number;
}

/**
 * The single event vocabulary that flows from any `CompanyDataSource` through
 * the `GameDirector` into the world + HUD. Discriminated on `t`.
 */
export type OfficeEvent =
  // Org growth (Paperclip `agent-hires` / `agent.created`): a new hire arrives.
  | { t: 'agent.hired'; agent: Agent }
  // Live status (Paperclip `agent.status`).
  | { t: 'agent.statusChanged'; agentId: string; status: AgentStatus }
  | { t: 'agent.move'; agentId: string; toRoomId: string }
  | { t: 'agent.speak'; agentId: string; text: string }
  | { t: 'agent.think'; agentId: string; text: string }
  | { t: 'task.assigned'; agentId: string; taskId: string; title: string }
  | { t: 'task.completed'; agentId: string; taskId: string }
  | { t: 'meeting.started'; roomId: string; agentIds: string[] }
  | { t: 'meeting.ended'; roomId: string }
  | { t: 'memory.recalled'; agentId: string; snippet: string }
  | { t: 'memory.wrote'; agentId: string; snippet: string }
  | { t: 'project.started'; projectId: string; brief: string }
  | { t: 'project.completed'; projectId: string };

export type OfficeEventType = OfficeEvent['t'];

const OFFICE_EVENT_TYPES: ReadonlySet<string> = new Set<OfficeEventType>([
  'agent.hired',
  'agent.statusChanged',
  'agent.move',
  'agent.speak',
  'agent.think',
  'task.assigned',
  'task.completed',
  'meeting.started',
  'meeting.ended',
  'memory.recalled',
  'memory.wrote',
  'project.started',
  'project.completed',
]);

/**
 * Runtime guard for `OfficeEvent`. Used when consuming external event streams
 * (e.g. the Paperclip adapter) where we can't trust the shape at compile time.
 */
export function isOfficeEvent(value: unknown): value is OfficeEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    't' in value &&
    typeof (value as { t: unknown }).t === 'string' &&
    OFFICE_EVENT_TYPES.has((value as { t: string }).t)
  );
}

/**
 * Construct an `Agent` with sensible defaults. New agents start `idle`.
 */
export function makeAgent(
  init: Omit<Agent, 'status'> & Partial<Pick<Agent, 'status'>>,
): Agent {
  return { status: 'idle', ...init };
}
