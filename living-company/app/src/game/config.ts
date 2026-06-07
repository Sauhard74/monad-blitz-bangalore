import type Phaser from 'phaser';

/** Logical tile size for the office (retro 16px grid, scaled up for crisp pixels). */
export const TILE = 16;
export const TILE_SCALE = 3;

/**
 * The active office is the WorkAdventure map — native 32px tiles. Agents live on
 * that grid: positioned at 32px steps, with the 16×32 LimeZu sprites drawn at
 * scale 2 (→ 32×64px: one tile wide, two tall, the usual character footprint).
 */
export const OFFICE_TILE_PX = 32;
export const AGENT_SCALE = 2;

/**
 * Build the Phaser game config. We pass the Phaser library in (rather than
 * importing it at module top) because this module is only ever loaded inside a
 * client-side dynamic import, alongside the Phaser bundle itself.
 */
export function createGameConfig(
  PhaserLib: typeof Phaser,
  parent: HTMLElement,
  scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: PhaserLib.AUTO,
    parent,
    // LimeZu's own backdrop navy — makes the space around the room read as
    // intentional (and it's where new rooms grow as the company hires).
    backgroundColor: '#3c4a5e',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: PhaserLib.Scale.RESIZE,
      autoCenter: PhaserLib.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    scene: scenes,
  };
}
