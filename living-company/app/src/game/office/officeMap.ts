import type { Desk, Room } from '@/lib/domain/types';
import { type LzObjectName, type SingleName } from '@/game/office/limezu';

/**
 * Open-plan office floor plan, in tile space — modelled on the Gather.town
 * office reference (docs/design/refs/gather-office-reference.jpeg): ONE big
 * floor inside the building's outer walls, with zones defined by furniture,
 * floor patches and a single enclosed glass conference room — not sealed rooms.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ art + plants + windows along the top wall      │
 *   │  CEO        LOUNGE (rug+sofa+tv)   ┌─CONFERENCE─┐
 *   │  desk                              │ (glass,    │
 *   │                                    │  checker)  │
 *   │  KITCHEN                       ┌────┘            │
 *   │  counter+stools               WAITING (chairs)  │
 *   │                                                 │
 *   │  ███ desk pods ███   ███ desk pods ███          │
 *   └─────────────── entrance ───────────────────────┘
 *
 * Zones stay as logical "rooms" (ceo/workspace/lounge/meeting) so Paperclip
 * events + growth still map onto the floor; only `meeting` is physically walled.
 */
export const OFFICE_W = 40;
export const OFFICE_H = 26;

/** Floor tile indices into floors.png (15-col tileset). */
const F_BASE = 46; // light grey grid — the open office floor
const F_CONF = 73; // grey checker — conference room (framed by glass walls)
const F_KITCHEN = 58; // sage/teal — kitchen + entry nook
const F_RUG = 142; // deep navy — lounge area rug (bordered inset)

type Side = 'top' | 'bottom' | 'left' | 'right';

export interface RoomDef extends Room {
  floor: number;
  /** Physical walls to draw. Empty for open-plan zones (most of them). */
  walls: { side: Side; door?: { at: number; span: number } }[];
  /** True when the zone is sealed (only the conference room) — pathing then
   *  routes through {@link RoomDef.door}; open zones are walked to directly. */
  enclosed?: boolean;
  /** Doorway waypoints for enclosed zones. */
  door?: { approach: TileXY; inside: TileXY };
}

interface TileXY {
  x: number;
  y: number;
}

/** A point on the open floor every cross-floor trip passes through (keeps walk
 *  paths from cutting across furniture clusters). */
export const CORRIDOR_HUB: TileXY = { x: 20, y: 12 };

/** The conference room occupies the top-right; it is the only sealed room. Its
 *  rect spans to the perimeter (top + right walls are the building's). */
const CONF = { x: 27, y: 0, w: 13, h: 10 };

export const ROOMS_DEF: RoomDef[] = [
  {
    id: 'ceo',
    kind: 'cabin',
    name: "CEO's Desk",
    rect: { x: 1, y: 1, w: 10, h: 7 },
    floor: F_BASE,
    walls: [],
  },
  {
    id: 'lounge',
    kind: 'common',
    name: 'Lounge',
    rect: { x: 14, y: 1, w: 11, h: 8 },
    floor: F_BASE,
    walls: [],
  },
  {
    id: 'meeting',
    kind: 'meeting',
    name: 'Conference Room',
    rect: CONF,
    floor: F_CONF,
    enclosed: true,
    // Left + bottom glass walls (top + right are the building perimeter).
    walls: [{ side: 'left' }, { side: 'bottom', door: { at: 31, span: 2 } }],
    door: { approach: { x: 31, y: 10 }, inside: { x: 31, y: 8 } },
  },
  {
    id: 'workspace',
    kind: 'common',
    name: 'Workspace',
    rect: { x: 8, y: 13, w: 31, h: 12 },
    floor: F_BASE,
    walls: [],
  },
];

export function getRoomDef(id: string): RoomDef | undefined {
  return ROOMS_DEF.find((r) => r.id === id);
}

/** Rooms surface (domain). */
export const ROOMS: Room[] = ROOMS_DEF.map(({ id, kind, name, rect }) => ({ id, kind, name, rect }));

/** Office entrance — a doorway in the bottom perimeter wall. */
export const ENTRANCE = { x: 19, y: OFFICE_H - 2 };

// ── Desks ────────────────────────────────────────────────────────────────
/** The CEO's desk sits in the exec corner (below the HUD overlay). */
const CEO_DESK: Desk = { id: 'desk-ceo', roomId: 'ceo', tileX: 11, tileY: 5 };

/**
 * Open-plan desk pods. Each pod is a 2×2 cluster of four seats; a workstation
 * is drawn one tile above each seat (see {@link buildFurniture}), so a pod
 * reads as four desks pushed together. Hires claim seats as they join; empty
 * desks just sit there, exactly like the reference.
 */
const POD_ORIGINS: [number, number][] = [
  [10, 16],
  [15, 16],
  [24, 17],
  [29, 17],
  [34, 17],
  [10, 21],
  [24, 22],
  [34, 22],
];

const WORKSPACE_DESKS: Desk[] = POD_ORIGINS.flatMap(([ox, oy], p) =>
  [
    [ox, oy],
    [ox + 1, oy],
    [ox, oy + 2],
    [ox + 1, oy + 2],
  ].map(([x, y], i) => ({ id: `desk-w${p}-${i}`, roomId: 'workspace', tileX: x, tileY: y })),
);

export const DESKS: Desk[] = [CEO_DESK, ...WORKSPACE_DESKS];

/** Seats around the conference table (centred ~x32,y4 inside the glass room). */
export const MEETING_SEATS: { tileX: number; tileY: number }[] = [
  { tileX: 30, tileY: 3 },
  { tileX: 34, tileY: 3 },
  { tileX: 30, tileY: 6 },
  { tileX: 34, tileY: 6 },
  { tileX: 29, tileY: 4 },
  { tileX: 35, tileY: 4 },
  { tileX: 32, tileY: 2 },
];

export function roomCenter(room: Room): { tileX: number; tileY: number } {
  return {
    tileX: Math.floor(room.rect.x + room.rect.w / 2),
    tileY: Math.floor(room.rect.y + room.rect.h / 2),
  };
}

export function getRoom(id: string): Room | undefined {
  return ROOMS.find((r) => r.id === id);
}

// ── Floor ──────────────────────────────────────────────────────────────────
/** Rectangular floor-tile patch (zone accents + the lounge rug). */
interface FloorPatch {
  rect: { x: number; y: number; w: number; h: number };
  tile: number;
}

const FLOOR_PATCHES: FloorPatch[] = [
  { rect: { x: 28, y: 1, w: 11, h: 8 }, tile: F_CONF }, // conference checker
  { rect: { x: 1, y: 15, w: 7, h: 6 }, tile: F_KITCHEN }, // kitchen / entry nook
  { rect: { x: 16, y: 2, w: 7, h: 5 }, tile: F_RUG }, // lounge area rug
];

/** Build the floor layer: open grey floor everywhere, then the zone patches. */
export function buildGround(): number[][] {
  const g: number[][] = [];
  for (let y = 0; y < OFFICE_H; y++) g.push(new Array<number>(OFFICE_W).fill(F_BASE));
  const paint = (rx: number, ry: number, tile: number) => {
    if (ry >= 0 && ry < OFFICE_H && rx >= 0 && rx < OFFICE_W) g[ry][rx] = tile;
  };
  for (const p of FLOOR_PATCHES)
    for (let ry = p.rect.y; ry < p.rect.y + p.rect.h; ry++)
      for (let rx = p.rect.x; rx < p.rect.x + p.rect.w; rx++) paint(rx, ry, p.tile);
  return g;
}

// ── Furniture ────────────────────────────────────────────────────────────
export interface FurniturePlacement {
  tileX: number;
  tileY: number;
  single?: SingleName;
  object?: LzObjectName;
}

/**
 * Furniture — dense, reference-matching clusters across the open floor:
 * desk pods, a central lounge, the glass conference room, a kitchen counter and
 * a waiting row. Decorative greenery/accessories come in {@link buildAccessories}.
 */
export function buildFurniture(): FurniturePlacement[] {
  const items: FurniturePlacement[] = [];
  const s = (single: SingleName, tileX: number, tileY: number) =>
    items.push({ single, tileX, tileY });
  const o = (object: LzObjectName, tileX: number, tileY: number) =>
    items.push({ object, tileX, tileY });

  // ── Desk pods (open plan) — a workstation above each seat + a tucked chair ─
  for (const d of WORKSPACE_DESKS) {
    s('workstation', d.tileX, d.tileY - 1);
    s('chair_back', d.tileX, d.tileY);
  }

  // ── CEO exec desk + left-wall storage (clear of the HUD overlay) ─────────
  s('workstation2', 11, 4);
  s('bookshelf', 1, 5);
  s('cabinet', 1, 8);

  // ── Lounge (centre) — area rug with a sofa run + coffee table + armchair ──
  s('sofa', 16, 2);
  s('sofa', 19, 2);
  o('coffee', 17, 5);
  s('armchair', 21, 3);
  s('lamp', 15, 5);

  // ── Conference room (glass, top-right) ───────────────────────────────────
  o('confTable', 31, 3);
  for (const seat of MEETING_SEATS) s('chair', seat.tileX, seat.tileY);

  // ── Kitchen counter (left) ───────────────────────────────────────────────
  s('reception', 2, 15);
  s('reception', 3, 15);
  s('reception', 4, 15);

  // ── Waiting row (right wall) ─────────────────────────────────────────────
  s('meetingseat', 37, 12);
  s('meetingseat', 37, 14);
  s('meetingseat', 37, 16);

  return items;
}

/**
 * Accessories & decorations — top-wall art, greenery filling the floor, lamps,
 * fire safety. The "every wall has something against it" pass.
 */
export function buildAccessories(): FurniturePlacement[] {
  const items: FurniturePlacement[] = [];
  const s = (single: SingleName, tileX: number, tileY: number) =>
    items.push({ single, tileX, tileY });

  // Top-wall gallery — framed art alternating with plants on the back wall.
  s('portrait', 12, 0);
  s('portrait', 16, 0);
  s('portrait', 22, 0);
  s('plant', 14, 1);
  s('plant', 24, 1);

  // Greenery scattered across the open floor (reference is full of plants).
  s('plant_tall', 13, 9);
  s('plant', 1, 9);
  s('plant_tall', 25, 10);
  s('plant', 1, 22);
  s('plant_tall', 8, 13);
  s('plant', 38, 9);
  s('plant_sm', 22, 16);
  s('plant_sm', 33, 16);
  s('plant', 6, 11);
  s('plant_tall', 20, 12);
  s('plant', 30, 13);
  s('plant_sm', 18, 20);
  s('plant', 5, 24);
  s('plant_tall', 38, 16);
  // A plant-topped divider screening the kitchen nook (reference's green wall).
  s('plant_sm', 1, 14);
  s('plant_sm', 3, 14);
  s('plant_sm', 5, 14);

  // Kitchen stools + a plant.
  s('chair', 2, 17);
  s('chair', 4, 17);
  s('plant_sm', 6, 15);

  // Misc accents.
  s('lamp', 9, 1);
  s('fire_ext', 38, 24);
  s('fire_ext', 1, 13);

  return items;
}
