/**
 * LimeZu Modern Interiors asset spec (https://limezu.itch.io/).
 *
 * We carve named furniture pieces as pixel rects out of the source sheets, since
 * most objects span several tiles. Coordinates are in source pixels.
 */
export const LZ_TEX = {
  floors: 'lz-floors',
  generic: 'lz-generic',
  conference: 'lz-conf',
  // Office region cropped from the master sheet (the full master is too tall to
  // upload as a GPU texture). Same coords as the master's top rows.
  office: 'lz-office',
} as const;

export const LZ_FLOORS_PATH = '/assets/limezu/tiles/floors.png';
export const LZ_GENERIC_PATH = '/assets/limezu/tiles/generic.png';
export const LZ_CONF_PATH = '/assets/limezu/tiles/conference.png';
export const LZ_OFFICE_PATH = '/assets/limezu/tiles/office.png';
export const LZ_RB_PATH = '/assets/limezu/tiles/roombuilder.png';
export const LZ_RB_TEX = 'lz-rb';

/**
 * White wall autotile pieces (dark-outlined) from the Room Builder, used to draw
 * a clean enclosed room border. Coords are source pixels into roombuilder.png.
 */
export const WALL = {
  tl: { x: 176, y: 96 },
  t: { x: 192, y: 96 },
  tr: { x: 208, y: 96 },
  l: { x: 176, y: 112 },
  r: { x: 208, y: 112 },
  bl: { x: 176, y: 128 },
  b: { x: 192, y: 128 },
  br: { x: 208, y: 128 },
} as const;
export type WallPiece = keyof typeof WALL;

/** Floors.png is a 15-column tileset. Clean cream office tile (col 5, row 3). */
export const LZ_FLOORS_COLS = 15;
export const LZ_FLOOR_WOOD = 3 * LZ_FLOORS_COLS + 5; // = 50
export const LZ_FLOOR_TILE_PX = 16;

/**
 * Individual furniture object PNGs (LimeZu "Black Shadow Singles") — consistent
 * shadows, placed directly (no error-prone rect carving). Sizes in tiles.
 */
export const LZ_SINGLES_DIR = '/assets/limezu/singles/';
/**
 * Curated LimeZu "Black Shadow Singles" — individual PNGs with a consistent
 * drop shadow, re-sourced from the Conference Hall + Living Room sets and named
 * for what they actually are. Sizes are in tiles (w × h), used for placement
 * and depth-sorting. Anchored by their top-left tile.
 */
export const LZ_SINGLES = {
  // Conference Hall (office furniture)
  workstation: { w: 1, h: 2 }, // desk + blue monitor (front)
  workstation2: { w: 1, h: 2 }, // desk + monitor + keyboard
  chair: { w: 1, h: 2 }, // office chair (front)
  chair_back: { w: 1, h: 2 }, // office chair (back, tucks under a desk)
  reception: { w: 1, h: 2 }, // low wood counter / credenza
  meetingseat: { w: 1, h: 1 }, // cushioned meeting seat
  fire_ext: { w: 1, h: 2 }, // fire extinguisher
  portrait: { w: 1, h: 2 }, // framed wall portrait
  // Living Room (greenery + soft furniture)
  plant: { w: 2, h: 2 }, // palm in a pot
  plant_tall: { w: 2, h: 3 }, // tall leafy plant
  plant_sm: { w: 1, h: 2 }, // small potted plant
  sofa: { w: 2, h: 2 }, // two-seat sofa
  armchair: { w: 2, h: 3 }, // wingback armchair
  bookshelf: { w: 2, h: 3 }, // glass-front bookshelf
  cabinet: { w: 2, h: 3 }, // tall storage cabinet
  lamp: { w: 1, h: 2 }, // table lamp
} as const;
export type SingleName = keyof typeof LZ_SINGLES;
export function singleTexKey(name: SingleName): string {
  return `single-${name}`;
}

type Sheet = keyof typeof LZ_TEX;

export interface LzObject {
  sheet: Sheet;
  x: number;
  y: number;
  w: number;
  h: number;
}

const px = (col: number, row: number) => ({ x: col * 16, y: row * 16 });

/** Named furniture pieces carved from the Conference Hall + Generic sheets. */
export const LZ_OBJECTS = {
  // Conference Hall sheet (basically an office set). Coords verified by overlay.
  desk: { sheet: 'conference', x: 128, y: 48, w: 16, h: 26 }, // wood counter w/ coffee (8,3)
  monitor: { sheet: 'office', x: 49, y: 66, w: 15, h: 18 }, // just the grey monitor (master 3,4)
  officeChair: { sheet: 'conference', x: 176, y: 112, w: 16, h: 24 }, // (11,7)
  confTable: { sheet: 'conference', x: 0, y: 32, w: 80, h: 40 }, // big wood table (0–4, 2–3)
  whiteboard: { sheet: 'conference', x: 160, y: 16, w: 48, h: 38 }, // boards (10–12, 1–2)
  waterCooler: { sheet: 'conference', x: 224, y: 144, w: 16, h: 32 }, // (14,9)
  plant: { sheet: 'conference', x: 48, y: 10, w: 16, h: 22 }, // bush (3,1)
  framedPic: { sheet: 'conference', x: 208, y: 48, w: 16, h: 16 }, // (13,3)
  exitSign: { sheet: 'conference', x: 80, y: 32, w: 16, h: 32 }, // (5,2)
  coffee: { sheet: 'conference', x: 144, y: 80, w: 64, h: 24 }, // long coffee table (9–12,5)
  // Generic sheet.
  sofa: { sheet: 'generic', ...px(6, 11), w: 48, h: 34 },
  rugRed: { sheet: 'generic', ...px(7, 4), w: 64, h: 64 },
  rugBlue: { sheet: 'generic', ...px(9, 7), w: 64, h: 48 },
  // Office region (cropped from master) — a monitor on a desk + a server rack.
  computerDesk: { sheet: 'office', x: 48, y: 58, w: 16, h: 46 }, // col 3, rows 4–6
  serverRack: { sheet: 'office', x: 64, y: 32, w: 16, h: 32 }, // col 4, rows 2–3
} satisfies Record<string, LzObject>;

export type LzObjectName = keyof typeof LZ_OBJECTS;

export function texKeyFor(sheet: Sheet): string {
  return LZ_TEX[sheet];
}
