'use client';

import { useState } from 'react';
import { useOfficeStore } from '@/lib/state/officeStore';
import { Panel } from '@/components/hud/Panel';
import { AgentWorkView } from '@/components/hud/AgentWorkView';
import { AssignTask } from '@/components/hud/AssignTask';
import { STATUS_COLOR, STATUS_LABEL, deptColor } from '@/components/hud/statusColor';
import { roleLabel } from '@/lib/data/seed';

/** Short flavor blurb per role — a hint of personality in the detail card. */
const ROLE_BLURB: Record<string, string> = {
  ceo: 'Sets the vision, rallies the team, and hires.',
  cto: 'Owns the tech and leads engineering.',
  engineer: 'Builds the product and makes it real.',
  designer: 'Shapes how everything looks and feels.',
  marketer: 'Takes the work to the world.',
  pm: 'Keeps delivery on track end to end.',
};

export function AgentDetailCard() {
  const selectedId = useOfficeStore((s) => s.selectedAgentId);
  const agent = useOfficeStore((s) => s.agents.find((a) => a.id === s.selectedAgentId));
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const [viewing, setViewing] = useState(false);
  const [assigning, setAssigning] = useState(false);

  if (!selectedId || !agent) return null;

  return (
    <Panel className="w-60 p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-5 w-5 border-2 border-[#3d2b1c]"
            style={{ backgroundColor: deptColor(agent.role) }}
          />
          <div className="leading-none">
            <div
              className="text-[22px] text-[#3a2a1a]"
              style={{ fontFamily: 'var(--font-pixel-body)' }}
            >
              {agent.name}
            </div>
            <div
              className="text-[15px] text-[#8a5a2b]"
              style={{ fontFamily: 'var(--font-pixel-body)' }}
            >
              {roleLabel(agent.role)}
            </div>
          </div>
        </div>
        <button
          onClick={() => selectAgent(null)}
          className="px-1 text-[14px] leading-none text-[#8a5a2b] hover:text-[#3a2a1a]"
          style={{ fontFamily: 'var(--font-pixel)' }}
          aria-label="Close"
        >
          x
        </button>
      </div>
      <div
        className="mt-2 flex items-center gap-2 text-[16px] text-[#5a3d22]"
        style={{ fontFamily: 'var(--font-pixel-body)' }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: STATUS_COLOR[agent.status] }}
        />
        {STATUS_LABEL[agent.status]}
      </div>
      <p
        className="mt-1.5 text-[16px] leading-tight text-[#6a4a28]"
        style={{ fontFamily: 'var(--font-pixel-body)' }}
      >
        {ROLE_BLURB[agent.role] ?? 'A valued member of the company.'}
      </p>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => setViewing(true)}
          className="flex-1 border-2 border-[#3d2b1c] bg-[#e8c878] py-1 text-[14px] text-[#3a2a1a] hover:bg-[#f0d488]"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          VIEW WORK
        </button>
        <button
          onClick={() => setAssigning(true)}
          className="flex-1 border-2 border-[#3d2b1c] bg-[#e0902e] py-1 text-[14px] text-[#3a2207] hover:bg-[#eaa040]"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          ASSIGN TASK
        </button>
      </div>

      {viewing ? (
        <AgentWorkView agentId={agent.id} agentName={agent.name} onClose={() => setViewing(false)} />
      ) : null}
      {assigning ? (
        <AssignTask agentId={agent.id} agentName={agent.name} onClose={() => setAssigning(false)} />
      ) : null}
    </Panel>
  );
}
