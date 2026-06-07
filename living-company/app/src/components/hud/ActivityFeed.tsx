'use client';

import { useEffect, useState } from 'react';
import { Collapsible } from '@/components/hud/Collapsible';
import { companyQuery } from '@/lib/data/activeCompany';

interface ActivityLine {
  id: string;
  text: string;
  at?: string;
}

export function ActivityFeed() {
  const [activity, setActivity] = useState<ActivityLine[]>([]);

  // Poll real Paperclip activity for the active company so the feed always
  // reflects what the team is actually doing — not only live socket events.
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/paperclip/activity${companyQuery()}`);
        const data = (await res.json()) as { activity?: ActivityLine[] };
        if (live && data.activity) setActivity(data.activity);
      } catch {
        /* keep last */
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  return (
    <Collapsible label="Activity" count={activity.length} className="max-h-[40vh] w-72">
      {activity.length === 0 ? (
        <p
          className="px-3 pb-3 text-[17px] leading-tight text-[#8a6a42]"
          style={{ fontFamily: 'var(--font-pixel-body)' }}
        >
          Quiet so far. Give the company a project and watch the team get to work.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto p-2 pt-0">
          {activity.map((entry) => (
            <li
              key={entry.id}
              className="border-2 border-[#d8bd8a] bg-[#fbf0d6] px-2 py-1 text-[16px] leading-tight text-[#3a2a1a]"
              style={{ fontFamily: 'var(--font-pixel-body)' }}
            >
              {entry.text}
            </li>
          ))}
        </ul>
      )}
    </Collapsible>
  );
}
