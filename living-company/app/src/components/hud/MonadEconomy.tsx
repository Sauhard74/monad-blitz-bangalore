'use client';

import { useEffect, useState } from 'react';
import { Collapsible } from '@/components/hud/Collapsible';
import { companyQuery } from '@/lib/data/activeCompany';

interface Economy {
  configured: boolean;
  treasury?: string;
  totalPaid?: string;
  totalJobs?: number;
  address?: string;
  explorer?: string;
  agents?: { address: string; name: string; role: string; earned: string; jobs: number }[];
}

const fmt = (s?: string) => (s ? Number(s).toFixed(3) : '0.000');

export function MonadEconomy() {
  const [eco, setEco] = useState<Economy | null>(null);
  const [running, setRunning] = useState(false);
  const [lastPaid, setLastPaid] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch('/api/monad/economy');
        const data = (await res.json()) as Economy;
        if (live) setEco(data);
      } catch {
        /* keep last */
      }
    };
    void load();
    const t = setInterval(load, 8000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  const refresh = async () => {
    try {
      const res = await fetch('/api/monad/economy');
      setEco((await res.json()) as Economy);
    } catch {
      /* keep last */
    }
  };

  const runPayroll = async () => {
    if (running) return;
    setRunning(true);
    try {
      const q = companyQuery();
      const sep = q ? '&' : '?';
      const res = await fetch(`/api/monad/payroll${q}${sep}t=${Date.now()}`, { method: 'POST' });
      const data = (await res.json()) as { paid?: unknown[] };
      setLastPaid(data.paid?.length ?? 0);
      await refresh();
    } catch {
      setLastPaid(0);
    } finally {
      setRunning(false);
    }
  };

  // Hidden entirely until Monad is wired (keeps the office clean pre-deploy).
  if (eco && !eco.configured) return null;

  const exp = eco?.explorer ?? 'https://testnet.monadexplorer.com';
  const body = 'var(--font-pixel-body)';

  return (
    <Collapsible label="On-Chain Economy · Monad" count={eco?.totalJobs} className="w-72">
      <div className="p-2 pt-0" style={{ fontFamily: body }}>
        {/* treasury + totals */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1 border-2 border-[#c9b6ef] bg-[#f3eeff] px-2 py-1">
            <div className="text-[11px] uppercase tracking-wide text-[#7a5bbf]">Treasury</div>
            <div className="text-[19px] leading-tight text-[#3a2a1a]">
              {fmt(eco?.treasury)} <span className="text-[12px] text-[#8a6a42]">MON</span>
            </div>
          </div>
          <div className="flex-1 border-2 border-[#c9b6ef] bg-[#f3eeff] px-2 py-1">
            <div className="text-[11px] uppercase tracking-wide text-[#7a5bbf]">Paid out</div>
            <div className="text-[19px] leading-tight text-[#3a2a1a]">
              {fmt(eco?.totalPaid)} <span className="text-[12px] text-[#8a6a42]">MON</span>
            </div>
          </div>
        </div>

        {/* earnings leaderboard */}
        <ul className="mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto">
          {(eco?.agents ?? []).map((a) => (
            <li
              key={a.address}
              className="flex items-center justify-between border-2 border-[#e0d3b0] bg-[#fbf0d6] px-2 py-1 text-[15px] text-[#3a2a1a]"
            >
              <span className="truncate">
                <a
                  href={`${exp}/address/${a.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted hover:text-[#7a5bbf]"
                >
                  {a.name}
                </a>
                <span className="ml-1 text-[12px] text-[#8a6a42]">{a.role}</span>
              </span>
              <span className="shrink-0 font-bold text-[#7a5bbf]">
                {Number(a.earned).toFixed(2)} <span className="text-[11px] text-[#8a6a42]">MON</span>
              </span>
            </li>
          ))}
          {!eco?.agents?.length && (
            <li className="px-1 py-1 text-[14px] text-[#8a6a42]">
              No payouts yet — ship work, then run payroll.
            </li>
          )}
        </ul>

        {/* run payroll */}
        <button
          onClick={runPayroll}
          disabled={running}
          className="mt-2 w-full border-2 border-[#5b3fa0] bg-[#7a5bbf] py-1.5 text-[14px] text-[#fdfbff] hover:bg-[#8a6bd0] disabled:opacity-50"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          {running ? 'SETTLING ON MONAD…' : '⛓ RUN PAYROLL'}
        </button>
        {lastPaid != null ? (
          <p className="mt-1 text-[13px] text-[#6a4a28]">
            {lastPaid > 0 ? `Paid ${lastPaid} agent(s) on Monad ✓` : 'Nothing new to settle.'}
          </p>
        ) : null}
        {eco?.address ? (
          <a
            href={`${exp}/address/${eco.address}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-[12px] text-[#7a5bbf] underline decoration-dotted"
          >
            View contract on Monad explorer ↗
          </a>
        ) : null}
      </div>
    </Collapsible>
  );
}
