'use client';

import { useEffect, useState } from 'react';
import { Collapsible } from '@/components/hud/Collapsible';
import { companyQuery } from '@/lib/data/activeCompany';

interface Memory {
  id: string;
  text: string;
  kind?: string;
  at?: string;
}

export function MemoryPanel() {
  const [memory, setMemory] = useState<Memory[]>([]);

  // Poll the ACTIVE company's own Tex org for real organizational memories.
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/memory/list${companyQuery()}`);
        const data = (await res.json()) as { memories?: Memory[] };
        if (live && data.memories) setMemory(data.memories);
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

  return (
    <Collapsible label="Company Brain" count={memory.length} className="max-h-[40vh] w-72">
      {memory.length === 0 ? (
        <p
          className="px-3 pb-3 text-[17px] leading-tight text-[#8a6a42]"
          style={{ fontFamily: 'var(--font-pixel-body)' }}
        >
          No memories yet — the team will recall and save as they work.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto p-2 pt-0">
          {memory.map((entry) => (
            <li
              key={entry.id}
              className="border-2 border-[#d8bd8a] bg-[#fbf0d6] px-2 py-1 text-[16px] leading-tight text-[#3a2a1a]"
              style={{ fontFamily: 'var(--font-pixel-body)' }}
            >
              🧠 {entry.text}
            </li>
          ))}
        </ul>
      )}
    </Collapsible>
  );
}
