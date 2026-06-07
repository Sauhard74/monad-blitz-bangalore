import type { MouseEvent, ReactNode } from 'react';

/**
 * A cozy wood-and-parchment panel — the shared chrome for every HUD surface.
 * Sharp corners, a dark outline with an inner highlight bevel, and a hard pixel
 * drop shadow give it the hand-made Stardew menu feel.
 */
export function Panel({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={
        'pointer-events-auto bg-[#f4e3c1] text-[#3a2a1a] ' +
        'border-[3px] border-[#3d2b1c] ' +
        'shadow-[inset_0_0_0_2px_#e7cd9a,4px_4px_0_0_rgba(40,24,12,0.45)] ' +
        className
      }
    >
      {children}
    </div>
  );
}

/** Small all-caps pixel section label. */
export function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="px-2 pt-2 pb-1 text-[8px] uppercase tracking-[0.15em] text-[#8a5a2b]"
      style={{ fontFamily: 'var(--font-pixel)' }}
    >
      {children}
    </div>
  );
}
