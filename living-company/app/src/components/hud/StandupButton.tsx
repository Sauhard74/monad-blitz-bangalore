'use client';

import { useState } from 'react';
import { useOfficeStore, type StandupReport } from '@/lib/state/officeStore';
import { companyQuery } from '@/lib/data/activeCompany';

/**
 * Calls everyone to the conference table for a stand-up: fetches each agent's
 * current focus live from Paperclip and hands it to the office to choreograph.
 */
export function StandupButton() {
  const runStandup = useOfficeStore((s) => s.runStandup);
  const active = useOfficeStore((s) => s.standup != null);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (active || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/paperclip/standup${companyQuery()}`);
      const data = (await res.json()) as { reports?: StandupReport[] };
      if (data.reports?.length) runStandup(data.reports);
    } catch {
      /* office stays as-is if the fetch fails */
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={start}
      disabled={active || loading}
      className="pointer-events-auto whitespace-nowrap border-2 border-[#9a5a16] bg-[#e0902e] px-3 py-2 text-[9px] leading-none text-[#3a2207] shadow-[2px_2px_0_0_rgba(40,24,12,0.4)] transition-transform active:translate-y-px disabled:opacity-50"
      style={{ fontFamily: 'var(--font-pixel)' }}
    >
      {loading ? 'GATHERING…' : active ? 'IN STAND-UP' : '📋 STAND-UP'}
    </button>
  );
}
