/**
 * Index helpers for the Kenney "RPG Urban Pack" packed atlas.
 *
 * The atlas (`/assets/tiles/urban.png`) is a 27×18 grid of 16px tiles with no
 * margin or spacing. Frame index is row-major: `index = row * COLS + col`.
 * The same texture supplies office tiles AND the 6 character sprite sheets.
 */
export const ATLAS_COLS = 27;
export const ATLAS_ROWS = 18;
export const TILE_PX = 16;

/** Floor tiles (plain centers). */
export const FLOOR = {
  wood: 109,
  gray: 37,
  green: 28,
  blue: 198,
} as const;

/** A brick tile used as a 1-thick perimeter/partition wall. */
export const WALL_BRICK = 152;

/** Furniture frames (placed as images on top of the floor). */
export const FURNITURE = {
  desk: 300, // wooden desk with drawers
  workstation: 274, // desk with a chair tucked in
  monitor: 306, // blue computer screen
  cabinet: 273, // tall drawers / filing cabinet
  locker: 327,
  bookshelf: 303,
  chairRed: 278,
  chairBlue: 305,
  benchGray: 297,
  sofaGrayLeft: 270,
  sofaGrayRight: 271,
  sofaGreen: 328,
  plant: 287,
  crateRed: 301,
  trash: 279,
  window: 359,
} as const;

export type Direction = 'down' | 'up' | 'left' | 'right';

/**
 * Characters use LimeZu's legacy "run" sheets: a single row of 24 frames sized
 * 16×32, six per direction. (Modern Interiors, https://limezu.itch.io/)
 */
export const CHARACTER_FRAME_W = 16;
export const CHARACTER_FRAME_H = 32;

export const RUN_FRAMES: Record<Direction, number[]> = {
  down: [0, 1, 2, 3, 4, 5],
  up: [6, 7, 8, 9, 10, 11],
  left: [12, 13, 14, 15, 16, 17],
  right: [18, 19, 20, 21, 22, 23],
};

/** The standing frame for a direction (first frame of its run cycle). */
export function idleFrame(dir: Direction): number {
  return RUN_FRAMES[dir][0];
}

/** Phaser texture key for a character sheet. */
export function charTextureKey(name: string): string {
  return `char-${name}`;
}
