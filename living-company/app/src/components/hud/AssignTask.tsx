'use client';

import { useState } from 'react';
import { Panel, PanelLabel } from '@/components/hud/Panel';
import { companyQuery } from '@/lib/data/activeCompany';

/** Hand a new task directly to one agent, then wake them to start on it. */
export function AssignTask({
  agentId,
  agentName,
  onClose,
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ identifier?: string; dispatched?: boolean } | null>(null);

  const submit = async () => {
    if (!title.trim() || state === 'sending') return;
    setState('sending');
    try {
      const q = companyQuery();
      const sep = q ? '&' : '?';
      const res = await fetch(`/api/paperclip/agent/assign${q}${sep}t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, title, description }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.reason ?? 'failed');
      setResult({ identifier: data.identifier, dispatched: data.dispatched });
      setState('done');
    } catch {
      setState('error');
    }
  };

  const body = 'var(--font-pixel-body)';

  return (
    <div
      onClick={onClose}
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <Panel className="flex w-full max-w-md flex-col p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <PanelLabel>Assign Task — {agentName}</PanelLabel>
          <button
            onClick={onClose}
            className="px-1 text-[16px] leading-none text-[#8a5a2b] hover:text-[#3a2a1a]"
            style={{ fontFamily: 'var(--font-pixel)' }}
            aria-label="Close"
          >
            x
          </button>
        </div>

        {state === 'done' ? (
          <div className="p-2" style={{ fontFamily: body }}>
            <p className="text-[17px] text-[#2f7d2f]">
              ✓ Assigned{result?.identifier ? ` (${result.identifier})` : ''} to {agentName}.
            </p>
            <p className="mt-1 text-[15px] text-[#6a4a28]">
              {result?.dispatched
                ? 'They were woken to start on it now.'
                : 'Queued — they’ll pick it up on the next cycle.'}
            </p>
            <button
              onClick={onClose}
              className="mt-3 w-full border-2 border-[#3d2b1c] bg-[#e8c878] py-1 text-[15px] text-[#3a2a1a] hover:bg-[#f0d488]"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              DONE
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-1" style={{ fontFamily: body }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              maxLength={200}
              className="border-2 border-[#caa86a] bg-[#fbf0d6] px-2 py-1.5 text-[16px] text-[#3a2a1a] outline-none focus:border-[#9a6a16]"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, acceptance criteria, context… (optional)"
              rows={4}
              maxLength={4000}
              className="resize-none border-2 border-[#caa86a] bg-[#fbf0d6] px-2 py-1.5 text-[16px] leading-tight text-[#3a2a1a] outline-none focus:border-[#9a6a16]"
            />
            {state === 'error' ? (
              <p className="text-[15px] text-[#a3331f]">Couldn’t assign — try again.</p>
            ) : null}
            <button
              onClick={submit}
              disabled={!title.trim() || state === 'sending'}
              className="w-full border-2 border-[#3d2b1c] bg-[#e0902e] py-1.5 text-[15px] text-[#3a2207] hover:bg-[#eaa040] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-pixel)' }}
            >
              {state === 'sending' ? 'ASSIGNING…' : 'ASSIGN & WAKE'}
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
