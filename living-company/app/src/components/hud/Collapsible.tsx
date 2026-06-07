'use client';

import { useState, type ReactNode } from 'react';
import { Panel } from '@/components/hud/Panel';

/**
 * A Panel whose body collapses to just its header — so the stacked HUD panels
 * (Employees, Activity, Company Brain) never overrun each other. Click the
 * header to toggle; a caret shows the state.
 */
export function Collapsible({
  label,
  count,
  defaultOpen = true,
  className = '',
  children,
}: {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Panel className={`flex min-h-0 flex-col ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex shrink-0 items-center justify-between px-2 pt-2 pb-1"
      >
        <span
          className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.15em] text-[#8a5a2b]"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          {label}
          {typeof count === 'number' ? (
            <span className="rounded-sm bg-[#e0c489] px-1 text-[#6a4a26]">{count}</span>
          ) : null}
        </span>
        <span className="text-[10px] text-[#8a5a2b]">{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div className="flex min-h-0 flex-col overflow-y-auto">{children}</div> : null}
    </Panel>
  );
}
