'use client';

import { useEffect, useRef, useState } from 'react';
import { cameraState, SCREEN_RECT, worldRectToScreen } from '@/game/office/cameraBridge';
import { companyQuery } from '@/lib/data/activeCompany';

interface Dashboard {
  ok: boolean;
  name: string;
  vitals: {
    team: number;
    building: number;
    shipped: number;
    inProgress: number;
    blocked: number;
    backlog: number;
    workProducts: number;
  };
  milestones: { id: string; title: string; status: string }[];
  team: { name: string; role: string; status: string }[];
  ticker: string[];
}

const STAT = (label: string, value: number, color: string) => ({ label, value, color });

/** The big "screen" on the office wall: a live mission-control view of the
 *  company — vitals, milestones, and a think-out-loud ticker — anchored to the
 *  screen wall's world rect and styled like a glowing CRT monitor. */
export function CompanyDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Dashboard | null>(null);

  // Anchor the panel to the world-space screen wall, every frame.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el && cameraState.ready) {
        const b = worldRectToScreen(SCREEN_RECT);
        el.style.left = `${b.left}px`;
        el.style.top = `${b.top}px`;
        el.style.width = `${b.width}px`;
        el.style.height = `${b.height}px`;
        el.style.opacity = '1';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Poll live company data.
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/paperclip/dashboard${companyQuery()}`);
        const d = (await res.json()) as Dashboard;
        if (live && d.ok) setData(d);
      } catch {
        /* keep last */
      }
    };
    void load();
    const t = setInterval(load, 6000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  const v = data?.vitals;
  const stats = v
    ? [
        STAT('TEAM', v.team, '#46d9ff'),
        STAT('BUILDING', v.building, '#7CFC98'),
        STAT('SHIPPED', v.shipped, '#7CFC98'),
        STAT('ACTIVE', v.inProgress, '#ffd35c'),
        STAT('BLOCKED', v.blocked, '#ff6b5c'),
        STAT('ARTIFACTS', v.workProducts, '#c89bff'),
      ]
    : [];

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute flex flex-col overflow-hidden opacity-0"
      style={{
        left: -9999,
        top: -9999,
        background:
          'radial-gradient(120% 120% at 50% 0%, #0b2030 0%, #06121d 60%, #030a12 100%)',
        boxShadow: 'inset 0 0 24px rgba(0,0,0,0.8), inset 0 0 4px rgba(70,217,255,0.25)',
        fontFamily: 'var(--font-pixel-body)',
        color: '#cfeefc',
        // CRT scanlines
        backgroundBlendMode: 'screen',
      }}
    >
      {/* scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.18) 3px)',
        }}
      />

      {/* header */}
      <div className="flex items-center gap-2 px-3 pt-2" style={{ fontFamily: 'var(--font-pixel)' }}>
        <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: '#7CFC98' }} />
        <span className="text-[10px] tracking-widest text-[#7CFC98]">LIVE</span>
        <span className="truncate text-[11px] tracking-wide text-[#46d9ff]">
          {(data?.name ?? 'COMPANY').toUpperCase()} — MISSION CONTROL
        </span>
      </div>

      {/* vitals grid */}
      <div className="grid grid-cols-6 gap-1 px-3 pt-2">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center">
            <span
              className="text-[20px] leading-none"
              style={{ color: s.color, textShadow: `0 0 8px ${s.color}66`, fontFamily: 'var(--font-pixel)' }}
            >
              {s.value}
            </span>
            <span className="mt-0.5 text-[9px] tracking-wide text-[#5f86a0]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* milestones */}
      <div className="mt-2 px-3">
        <div className="text-[9px] tracking-widest text-[#5f86a0]">MILESTONES</div>
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {(data?.milestones ?? []).slice(0, 3).map((m) => (
            <li key={m.id} className="flex items-center gap-1 text-[12px] leading-tight">
              <span style={{ color: m.status === 'completed' ? '#7CFC98' : '#ffd35c' }}>
                {m.status === 'completed' ? '✔' : '▸'}
              </span>
              <span className="truncate text-[#bfe4f5]">{m.title}</span>
            </li>
          ))}
          {!data?.milestones?.length && (
            <li className="text-[12px] text-[#5f86a0]">Setting the founding plan…</li>
          )}
        </ul>
      </div>

      {/* think-out-loud ticker */}
      <div className="mt-auto border-t border-[#163243] px-3 py-1">
        <div className="text-[9px] tracking-widest text-[#5f86a0]">THINKING OUT LOUD</div>
        <ul className="flex flex-col gap-0.5 overflow-hidden" style={{ maxHeight: '34%' }}>
          {(data?.ticker ?? []).slice(0, 4).map((t, i) => (
            <li
              key={i}
              className="truncate text-[12px] leading-tight"
              style={{ color: i === 0 ? '#7CFC98' : '#9fc4d8', opacity: 1 - i * 0.18 }}
            >
              › {t}
            </li>
          ))}
          {!data?.ticker?.length && <li className="text-[12px] text-[#5f86a0]">Quiet — give them a project.</li>}
        </ul>
      </div>
    </div>
  );
}
