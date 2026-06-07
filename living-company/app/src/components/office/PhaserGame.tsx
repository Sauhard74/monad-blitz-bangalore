'use client';

import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

/**
 * Mounts the Phaser office world into a div, fully client-side. Phaser (and the
 * scene) are dynamically imported inside the effect so none of it touches SSR —
 * Next 16 forbids `ssr:false` dynamic in Server Components, and Phaser reaches
 * for `window`/`document` on instantiation.
 */
export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const PhaserLib = (await import('phaser')).default;
      const { OfficeScene } = await import('@/game/scenes/OfficeScene');
      const { createGameConfig } = await import('@/game/config');

      if (cancelled || !containerRef.current) return;

      gameRef.current = new PhaserLib.Game(
        createGameConfig(PhaserLib, containerRef.current, [OfficeScene]),
      );
    })();

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" data-testid="office-canvas" />;
}
