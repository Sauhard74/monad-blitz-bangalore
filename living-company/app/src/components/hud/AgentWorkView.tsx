'use client';

import { useEffect, useState } from 'react';
import { Panel, PanelLabel } from '@/components/hud/Panel';
import { companyQuery } from '@/lib/data/activeCompany';

interface AgentWork {
  issues: { id: string; identifier?: string; title: string; status: string }[];
  activity: { text: string; at?: string }[];
}

const STATUS_TINT: Record<string, string> = {
  in_progress: '#2f7d2f',
  in_review: '#9a6a16',
  blocked: '#a3331f',
  todo: '#5a3d22',
};

/** Live "what is this agent doing" — its active Paperclip issues + recent actions. */
export function AgentWorkView({
  agentId,
  agentName,
  onClose,
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
}) {
  const [work, setWork] = useState<AgentWork | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const q = companyQuery();
        const sep = q ? '&' : '?';
        const res = await fetch(`/api/paperclip/agent${q}${sep}id=${encodeURIComponent(agentId)}`);
        const data = (await res.json()) as AgentWork;
        if (live) setWork(data);
      } catch {
        if (live) setWork({ issues: [], activity: [] });
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    const t = setInterval(load, 8000); // keep it live while open
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [agentId]);

  const body = 'var(--font-pixel-body)';

  return (
    <div
      onClick={onClose}
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <Panel
        className="flex max-h-[80vh] w-full max-w-lg flex-col p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <PanelLabel>{agentName} — Live Work</PanelLabel>
          <button
            onClick={onClose}
            className="px-1 text-[16px] leading-none text-[#8a5a2b] hover:text-[#3a2a1a]"
            style={{ fontFamily: 'var(--font-pixel)' }}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="overflow-y-auto p-1" style={{ fontFamily: body }}>
          {loading && !work ? (
            <p className="px-1 py-2 text-[16px] text-[#8a6a42]">Checking Paperclip…</p>
          ) : (
            <>
              <div className="mt-1 text-[13px] uppercase tracking-wide text-[#8a5a2b]">Working on</div>
              {work && work.issues.length ? (
                <ul className="mt-1 flex flex-col gap-1">
                  {work.issues.map((i) => (
                    <li
                      key={i.id}
                      className="border-2 border-[#d8bd8a] bg-[#fbf0d6] px-2 py-1 text-[16px] leading-tight text-[#3a2a1a]"
                    >
                      <span
                        className="mr-1 font-bold uppercase"
                        style={{ color: STATUS_TINT[i.status] ?? '#5a3d22' }}
                      >
                        [{i.status.replace('_', ' ')}]
                      </span>
                      {i.identifier ? <span className="text-[#8a6a42]">{i.identifier} </span> : null}
                      {i.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 px-1 text-[16px] text-[#8a6a42]">No active tasks — between work.</p>
              )}

              <div className="mt-3 text-[13px] uppercase tracking-wide text-[#8a5a2b]">Recent activity</div>
              {work && work.activity.length ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {work.activity.map((a, idx) => (
                    <li key={idx} className="px-1 text-[15px] leading-tight text-[#5a3d22]">
                      • {a.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 px-1 text-[16px] text-[#8a6a42]">Nothing yet.</p>
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
