'use client';

import { useOfficeStore, type StandupReport } from '@/lib/state/officeStore';
import { Panel, PanelLabel } from '@/components/hud/Panel';

/** Build a clean, readable plain-text stand-up report for download. */
function buildStandupText(reports: StandupReport[]): string {
  const date = new Date().toLocaleString();
  const lines: string[] = [
    'DAILY STAND-UP',
    '='.repeat(40),
    `${reports.length} people · ${date}`,
    '',
  ];
  for (const r of reports) {
    lines.push(`${r.name}  (${r.role})`);
    if (r.working) {
      lines.push(`  Working on: "${r.working}" [${r.workingStatus ?? 'active'}]`);
      if (r.openCount > 1) lines.push(`  Open tasks: ${r.openCount}`);
    } else {
      lines.push('  Free — between tasks');
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** The stand-up roundup: a readable summary + a one-click text download (the
 *  cramped on-screen list is hard to read, so the file is the real deliverable). */
export function StandupPanel() {
  const standup = useOfficeStore((s) => s.standup);
  const endStandup = useOfficeStore((s) => s.endStandup);
  if (!standup) return null;

  const download = () => {
    const blob = new Blob([buildStandupText(standup.reports)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `standup-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const busy = standup.reports.filter((r) => r.working).length;

  return (
    <Panel className="flex max-h-full w-80 flex-col">
      <div className="flex items-center justify-between">
        <PanelLabel>Daily Stand-up</PanelLabel>
        <button
          onClick={endStandup}
          className="px-2 text-[14px] leading-none text-[#8a5a2b] hover:text-[#3a2a1a]"
          style={{ fontFamily: 'var(--font-pixel)' }}
          aria-label="Close"
        >
          x
        </button>
      </div>

      <div className="px-2 pb-2" style={{ fontFamily: 'var(--font-pixel-body)' }}>
        <p className="text-[15px] text-[#5a3d22]">
          <span className="font-bold">{standup.reports.length}</span> people ·{' '}
          <span className="font-bold text-[#2f7d2f]">{busy}</span> heads-down ·{' '}
          {standup.reports.length - busy} free
        </p>
        <button
          onClick={download}
          className="mt-2 w-full border-2 border-[#3d2b1c] bg-[#e8c878] py-1.5 text-[14px] text-[#3a2a1a] hover:bg-[#f0d488]"
          style={{ fontFamily: 'var(--font-pixel)' }}
        >
          ⬇ DOWNLOAD STAND-UP (.txt)
        </button>
        <p className="mt-1 text-[13px] text-[#8a6a42]">
          Full readable report saved to your downloads.
        </p>
      </div>
    </Panel>
  );
}
