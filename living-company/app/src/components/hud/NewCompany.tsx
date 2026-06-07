'use client';

import { useState } from 'react';
import { Panel, PanelLabel } from '@/components/hud/Panel';
import { setActiveCompany } from '@/lib/data/activeCompany';

/**
 * In-UI onboarding: name + idea → the gated Provisioner stands up a fully-wired,
 * isolated company (own brain + own Tex memory) → the office switches to it.
 */
export function NewCompany() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || !name.trim() || !idea.trim() || !secret.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-provision-secret': secret },
        body: JSON.stringify({ name, idea }),
      });
      const data = (await res.json()) as { companyId?: string; error?: string };
      if (!res.ok || !data.companyId) throw new Error(data.error ?? `failed (${res.status})`);
      setActiveCompany(data.companyId);
      window.location.reload(); // re-boot the office onto the new company
    } catch (e) {
      setError(e instanceof Error ? e.message : 'provisioning failed');
      setBusy(false);
    }
  };

  const field =
    'w-full border-2 border-[#c9a86e] bg-[#fbf0d6] px-2 py-1.5 text-[16px] text-[#3a2a1a] placeholder:text-[#a98a5e] focus:outline-none';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto whitespace-nowrap border-2 border-[#3d6a2b] bg-[#5a9b3e] px-3 py-2 text-[9px] leading-none text-[#0f2a07] shadow-[2px_2px_0_0_rgba(40,24,12,0.4)] transition-transform active:translate-y-px"
        style={{ fontFamily: 'var(--font-pixel)' }}
      >
        ✦ NEW COMPANY
      </button>

      {open && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Panel className="w-full max-w-md p-4">
            <PanelLabel>Start a New Company</PanelLabel>
            <div
              className="flex flex-col gap-2 p-2 pt-1"
              style={{ fontFamily: 'var(--font-pixel-body)' }}
            >
              <input
                className={field}
                placeholder="Company name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <textarea
                className={`${field} h-28 resize-none`}
                placeholder="The idea — what should this company build?"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
              />
              <input
                className={field}
                type="password"
                placeholder="Provisioning secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              {error && <p className="text-[14px] text-[#a3331f]">⚠ {error}</p>}
              <div className="mt-1 flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="border-2 border-[#c9a86e] bg-[#fbf0d6] px-3 py-1.5 text-[9px] text-[#7a5226] disabled:opacity-40"
                  style={{ fontFamily: 'var(--font-pixel)' }}
                >
                  CANCEL
                </button>
                <button
                  onClick={submit}
                  disabled={busy || !name.trim() || !idea.trim() || !secret.trim()}
                  className="border-2 border-[#3d6a2b] bg-[#5a9b3e] px-3 py-1.5 text-[9px] text-[#0f2a07] disabled:opacity-40"
                  style={{ fontFamily: 'var(--font-pixel)' }}
                >
                  {busy ? 'BUILDING…' : 'LAUNCH'}
                </button>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
