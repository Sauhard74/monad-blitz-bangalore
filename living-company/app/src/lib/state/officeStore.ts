import { create } from 'zustand';
import type { Agent, OfficeEvent, Room } from '@/lib/domain/types';

export interface ActivityEntry {
  id: number;
  text: string;
  kind: OfficeEvent['t'];
}

export interface MemoryEntry {
  id: number;
  kind: 'recalled' | 'wrote';
  agent: string;
  snippet: string;
}

/** A single agent's stand-up report (their current focus, from Paperclip). */
export interface StandupReport {
  agentId: string;
  name: string;
  role: string;
  status: Agent['status'];
  working: string | null;
  workingStatus: string | null;
  openCount: number;
}

export interface OfficeState {
  agents: Agent[];
  rooms: Room[];
  activity: ActivityEntry[];
  memory: MemoryEntry[];
  selectedAgentId: string | null;
  projectRunning: boolean;
  /** A running stand-up: bumped `seq` signals the scene to choreograph it. */
  standup: { seq: number; reports: StandupReport[] } | null;

  setCompany: (agents: Agent[], rooms: Room[]) => void;
  selectAgent: (id: string | null) => void;
  applyEvent: (event: OfficeEvent) => void;
  runStandup: (reports: StandupReport[]) => void;
  endStandup: () => void;
}

let activityId = 0;
let memoryId = 0;

function nameOf(agents: Agent[], id: string): string {
  return agents.find((a) => a.id === id)?.name ?? id;
}

function setStatus(agents: Agent[], id: string, status: Agent['status']): Agent[] {
  return agents.map((a) => (a.id === id ? { ...a, status } : a));
}

/** Human-readable activity line for an event, or null if it shouldn't be logged. */
function describe(event: OfficeEvent, agents: Agent[]): string | null {
  switch (event.t) {
    case 'agent.hired':
      return `🎉 Hired ${event.agent.name} as ${event.agent.role}`;
    case 'project.started':
      return `📋 New project: ${event.brief}`;
    case 'meeting.started':
      return '🤝 Team gathers in the War Room';
    case 'agent.speak':
      return `💬 ${nameOf(agents, event.agentId)}: ${event.text}`;
    case 'agent.think':
      return `💭 ${nameOf(agents, event.agentId)} is thinking…`;
    case 'task.assigned':
      return `📌 ${nameOf(agents, event.agentId)} took on “${event.title}”`;
    case 'task.completed':
      return `✅ ${nameOf(agents, event.agentId)} finished a task`;
    case 'memory.recalled':
      return `🧠 ${nameOf(agents, event.agentId)} recalls: ${event.snippet}`;
    case 'memory.wrote':
      return `💾 ${nameOf(agents, event.agentId)} saved to memory: ${event.snippet}`;
    case 'project.completed':
      return '🎉 Project shipped — knowledge saved to memory';
    default:
      return null;
  }
}

const MAX_ACTIVITY = 60;
const MAX_MEMORY = 30;

export const useOfficeStore = create<OfficeState>((set) => ({
  agents: [],
  rooms: [],
  activity: [],
  memory: [],
  selectedAgentId: null,
  projectRunning: false,
  standup: null,

  setCompany: (agents, rooms) => set({ agents, rooms }),

  runStandup: (reports) =>
    set((s) => ({ standup: { seq: (s.standup?.seq ?? 0) + 1, reports } })),
  endStandup: () => set({ standup: null }),

  selectAgent: (id) => set({ selectedAgentId: id }),

  applyEvent: (event) =>
    set((state) => {
      let agents = state.agents;
      let projectRunning = state.projectRunning;

      switch (event.t) {
        case 'agent.hired':
          // A new hire joins the roster (org grows).
          agents = agents.some((a) => a.id === event.agent.id)
            ? agents
            : [...agents, event.agent];
          break;
        case 'agent.statusChanged':
          agents = setStatus(agents, event.agentId, event.status);
          break;
        case 'project.started':
          projectRunning = true;
          break;
        case 'project.completed':
          projectRunning = false;
          agents = agents.map((a) => ({ ...a, status: 'idle' }));
          break;
        case 'meeting.started':
          agents = event.agentIds.reduce((acc, id) => setStatus(acc, id, 'meeting'), agents);
          break;
        case 'agent.think':
          agents = setStatus(agents, event.agentId, 'thinking');
          break;
        case 'task.assigned':
          agents = setStatus(agents, event.agentId, 'working');
          break;
        case 'task.completed':
          agents = setStatus(agents, event.agentId, 'idle');
          break;
        default:
          break;
      }

      const line = describe(event, state.agents);
      const activity = line
        ? [{ id: ++activityId, text: line, kind: event.t }, ...state.activity].slice(0, MAX_ACTIVITY)
        : state.activity;

      let memory = state.memory;
      if (event.t === 'memory.recalled' || event.t === 'memory.wrote') {
        const entry: MemoryEntry = {
          id: ++memoryId,
          kind: event.t === 'memory.recalled' ? 'recalled' : 'wrote',
          agent: nameOf(state.agents, event.agentId),
          snippet: event.snippet,
        };
        memory = [entry, ...state.memory].slice(0, MAX_MEMORY);
      }

      return { agents, projectRunning, activity, memory };
    }),
}));
