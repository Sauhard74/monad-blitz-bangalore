'use client';

import { useEffect, useRef, useState } from 'react';
import { getActiveCompany, setActiveCompany } from '@/lib/data/activeCompany';

interface Company {
  id: string;
  name: string;
}

/**
 * Dropdown to switch which provisioned company the office is showing. Selecting
 * one persists it client-side and reloads so every panel re-fetches against it.
 */
export function CompanySwitcher() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/paperclip/companies')
      .then((r) => r.json())
      .then((d: { companies?: Company[] }) => {
        setCompanies(d.companies ?? []);
        setActiveId(getActiveCompany());
      })
      .catch(() => setCompanies([]));
  }, []);

  // Close when clicking outside the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const active = companies.find((c) => c.id === activeId);
  // With nothing chosen yet the server falls back to its default company.
  const label = active?.name ?? companies[0]?.name ?? 'LIVING COMPANY';

  const pick = (id: string) => {
    if (id === activeId) return setOpen(false);
    setActiveCompany(id);
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[13px] leading-none text-[#3d2b1c] hover:text-[#6a3a12]"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        {label.toUpperCase()}
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-2 min-w-[180px] border-[3px] border-[#3d2b1c] bg-[#f4e3c1] shadow-[4px_4px_0_0_rgba(40,24,12,0.45)]"
        >
          {companies.length === 0 ? (
            <div
              className="px-3 py-2 text-[15px] text-[#8a6a42]"
              style={{ fontFamily: 'var(--font-pixel-body)' }}
            >
              No companies
            </div>
          ) : (
            companies.map((c) => {
              const isActive = c.id === activeId || (!activeId && c.id === companies[0]?.id);
              return (
                <button
                  key={c.id}
                  onClick={() => pick(c.id)}
                  className={`block w-full px-3 py-1.5 text-left text-[16px] leading-tight hover:bg-[#e8d3a6] ${
                    isActive ? 'bg-[#e0c489] text-[#3a2a1a]' : 'text-[#5a3d22]'
                  }`}
                  style={{ fontFamily: 'var(--font-pixel-body)' }}
                >
                  {isActive ? '› ' : ''}
                  {c.name}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
