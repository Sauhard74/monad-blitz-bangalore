import type { AgentStatus } from '@/lib/domain/types';

/** Status palette — readable on the warm parchment panels. */
export const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: '#b08a5a',
  working: '#e0902e',
  meeting: '#3f8fd0',
  thinking: '#9a5fc0',
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'Idle',
  working: 'Working',
  meeting: 'In meeting',
  thinking: 'Thinking',
};

/** Per-role accent colors (Paperclip role ids), used for the roster + detail card. */
export const DEPT_COLOR: Record<string, string> = {
  ceo: '#d99b2e',
  cto: '#3f7fd0',
  cmo: '#46a86a',
  cfo: '#5fa8a0',
  engineer: '#3f7fd0',
  designer: '#bd5fc8',
  marketer: '#46a86a',
  pm: '#e0762e',
  qa: '#c85f5f',
  devops: '#7a6fd0',
  researcher: '#5fa8a0',
  general: '#8a5a2b',
};

export function deptColor(role: string): string {
  return DEPT_COLOR[role] ?? '#8a5a2b';
}
