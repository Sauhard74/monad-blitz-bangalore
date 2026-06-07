'use client';

import { useEffect, useState } from 'react';
import { useOfficeStore } from '@/lib/state/officeStore';
import { Panel } from '@/components/hud/Panel';
import { CompanySwitcher } from '@/components/hud/CompanySwitcher';

/** A stylized office clock that starts at 9:00 and ticks through the workday. */
function useOfficeClock(): string {
  const [minutes, setMinutes] = useState(9 * 60);
  useEffect(() => {
    const id = setInterval(() => setMinutes((m) => (m + 5) % (24 * 60)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function TopBar() {
  const running = useOfficeStore((s) => s.projectRunning);
  const clock = useOfficeClock();

  return (
    <Panel className="flex items-center gap-3 px-3 py-2">
      <CompanySwitcher />
      <span
        className={`border-2 px-2 py-1 text-[8px] leading-none ${
          running
            ? 'border-[#9a5a16] bg-[#e0902e] text-[#3a2207]'
            : 'border-[#7a5a36] bg-[#e7cd9a] text-[#6a4a26]'
        }`}
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        {running ? 'WORKING' : 'IDLE'}
      </span>
      <span
        className="ml-1 text-[20px] leading-none text-[#6a4a26]"
        style={{ fontFamily: 'var(--font-pixel-body)' }}
      >
        🕘 {clock}
      </span>
    </Panel>
  );
}
