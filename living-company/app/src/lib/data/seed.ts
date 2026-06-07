import { type Agent, type AgentRole, type Desk, type Room, makeAgent } from '@/lib/domain/types';
import { DESKS, ROOMS } from '@/game/office/officeMap';

/**
 * The company starts as a one-person shop — just the CEO — and GROWS as they
 * hire (mirroring Paperclip's `agent-hires` flow). The hire plan is the sequence
 * of people the CEO brings on.
 */
export interface CompanySeed {
  agents: Agent[]; // who's present at t=0 (just the CEO)
  desks: Desk[];
  rooms: Room[];
}

/** Friendly labels for Paperclip role ids (used in the HUD). */
export const ROLE_LABEL: Record<string, string> = {
  ceo: 'CEO',
  cto: 'CTO',
  cmo: 'CMO',
  cfo: 'CFO',
  engineer: 'Engineer',
  designer: 'Designer',
  marketer: 'Marketer',
  pm: 'PM',
  qa: 'QA',
  devops: 'DevOps',
  researcher: 'Researcher',
  general: 'Generalist',
};

export function roleLabel(role: AgentRole): string {
  return ROLE_LABEL[role] ?? role;
}

interface PersonSpec {
  id: string;
  name: string;
  role: AgentRole;
  title: string;
  character: string; // LimeZu sheet name
}

/** The founder. */
const CEO: PersonSpec = {
  id: 'ceo',
  name: 'Ada',
  role: 'ceo',
  title: 'Founder & CEO',
  character: 'Amelia',
};

/** Who the CEO hires, in order, as the company grows. */
const HIRES: PersonSpec[] = [
  { id: 'eng', name: 'Linus', role: 'engineer', title: 'Engineer', character: 'Bob' },
  { id: 'des', name: 'Mira', role: 'designer', title: 'Designer', character: 'Lucy' },
  { id: 'mkt', name: 'Pablo', role: 'marketer', title: 'Marketer', character: 'Adam' },
  { id: 'pm', name: 'Ravi', role: 'pm', title: 'Product Manager', character: 'Alex' },
];

/** Every character sheet referenced (CEO + all hires) — preloaded up front. */
export const SEED_CHARACTERS = [CEO, ...HIRES].map((p) => p.character);

function toAgent(p: PersonSpec, reportsTo?: string): Agent {
  return makeAgent({
    id: p.id,
    name: p.name,
    role: p.role,
    title: p.title,
    spriteKey: p.character,
    reportsTo,
  });
}

/** Starting company: the CEO alone. */
export function getSeedCompany(): CompanySeed {
  return { agents: [toAgent(CEO)], desks: DESKS, rooms: ROOMS };
}

/** The ordered list of hires the CEO will make (all report to the CEO for now). */
export function getHirePlan(): Agent[] {
  return HIRES.map((p) => toAgent(p, CEO.id));
}
