'use client';

import { useState } from 'react';
import { useOfficeStore } from '@/lib/state/officeStore';
import { getCompanySource } from '@/lib/data/source';
import { Panel } from '@/components/hud/Panel';

const SUGGESTIONS = ['a habit-tracking app', 'a launch campaign', 'an onboarding redesign'];

export function ProjectInput() {
  const running = useOfficeStore((s) => s.projectRunning);
  const [brief, setBrief] = useState('');

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || running) return;
    void getCompanySource().startProject(value);
    setBrief('');
  };

  return (
    <Panel className="mx-auto w-full max-w-xl p-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(brief);
        }}
        className="flex items-center gap-2"
      >
        <span className="pl-1 text-[20px] leading-none">📋</span>
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          disabled={running}
          placeholder={running ? 'The team is working…' : 'Give the company a project…'}
          className="flex-1 bg-transparent text-[19px] text-[#3a2a1a] placeholder:text-[#a98a5e] focus:outline-none disabled:opacity-60"
          style={{ fontFamily: 'var(--font-pixel-body)' }}
        />
        <button
          type="submit"
          disabled={running || brief.trim() === ''}
          className="border-2 border-[#9a5a16] bg-[#e0902e] px-3 py-1.5 text-[9px] leading-none text-[#3a2207] shadow-[2px_2px_0_0_rgba(40,24,12,0.4)] transition-transform active:translate-y-px disabled:opacity-40"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          {running ? 'WORKING' : 'START'}
        </button>
      </form>
      {!running && brief === '' && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="border-2 border-[#c9a86e] bg-[#fbf0d6] px-2 py-0.5 text-[15px] leading-none text-[#7a5226] hover:bg-[#f0dfb4]"
              style={{ fontFamily: 'var(--font-pixel-body)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
