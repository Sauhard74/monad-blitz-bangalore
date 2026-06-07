'use client';

import { useOfficeStore } from '@/lib/state/officeStore';
import { Collapsible } from '@/components/hud/Collapsible';
import { STATUS_COLOR, STATUS_LABEL, deptColor } from '@/components/hud/statusColor';
import { roleLabel } from '@/lib/data/seed';

export function AgentRoster() {
  const agents = useOfficeStore((s) => s.agents);
  const selectedId = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent = useOfficeStore((s) => s.selectAgent);

  return (
    <Collapsible label="Employees" count={agents.length} className="max-h-[42vh] w-60">
      <ul className="flex flex-col gap-0.5 p-1.5 pt-0">
        {agents.map((a) => {
          const selected = a.id === selectedId;
          return (
            <li key={a.id}>
              <button
                onClick={() => selectAgent(selected ? null : a.id)}
                className={`flex w-full items-center gap-2 border-2 px-2 py-1 text-left transition-colors ${
                  selected
                    ? 'border-[#3d2b1c] bg-[#e9cd96]'
                    : 'border-transparent hover:bg-[#ecd9af]'
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 border border-[#3d2b1c]"
                  style={{ backgroundColor: deptColor(a.role) }}
                />
                <span className="flex-1 leading-none">
                  <span
                    className="text-[18px] text-[#3a2a1a]"
                    style={{ fontFamily: 'var(--font-pixel-body)' }}
                  >
                    {a.name}
                  </span>
                  <span
                    className="ml-1.5 text-[15px] text-[#8a5a2b]"
                    style={{ fontFamily: 'var(--font-pixel-body)' }}
                  >
                    {roleLabel(a.role)}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLOR[a.status] }}
                  />
                  <span
                    className="text-[13px] leading-none text-[#9a7a52]"
                    style={{ fontFamily: 'var(--font-pixel-body)' }}
                  >
                    {STATUS_LABEL[a.status]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Collapsible>
  );
}
