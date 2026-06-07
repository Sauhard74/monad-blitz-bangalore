/**
 * Living Company office maps (Tiled JSON rendered straight into Phaser).
 *
 * `theoffice` is our own heavily-reworked floor plan: started from a Tiled
 * office base, then cropped (dropped the exterior parking), cleared the
 * restrooms and rebuilt them as a games lounge, and layered on our own
 * furniture overlays — a bespoke map. `gptw` is a larger campus kept as a
 * future option for big teams.
 */
export interface WaTileset {
  /** Tileset name exactly as in the map JSON (Phaser matches by name). */
  name: string;
  /** Phaser texture key we load the image under. */
  key: string;
  path: string;
}

export interface WaMapConfig {
  id: string;
  key: string;
  path: string;
  tile: number;
  cols: number;
  rows: number;
  tilesets: WaTileset[];
  /** Tile-layer names to skip (control/zone layers, not visuals). */
  skip: string[];
  /** Sprite overlays drawn on top of the map (our own furniture additions). */
  overlays?: WaOverlay[];
  /** Floating room labels. */
  labels?: { text: string; x: number; y: number }[];
}

export interface WaOverlay {
  key: string;
  path: string;
  /** Top-left position in tiles. */
  x: number;
  y: number;
  /** Render scale (LimeZu 16px singles use 2 on a 32px map; native-32 use 1). */
  scale: number;
}

export const WA_THEOFFICE: WaMapConfig = {
  id: "theoffice",
  key: "wamap-theoffice",
  path: "/assets/wa-theoffice/map.json",
  tile: 32, cols: 46, rows: 24,
  skip: ['collisions', 'start', 'floorLayer'],
  // Our additions: the old toilet room reborn as an open games lounge —
  // a TV-and-beanbag corner up top, two foosball tables, and a couch.
  overlays: [
    // TV-and-beanbag corner (TV mounted under the kitchen back-wall, top-left).
    { key: 'ov-tv', path: '/assets/wa-theoffice/overlays/tv.png', x: 23, y: 15, scale: 2 },
    { key: 'ov-cushion', path: '/assets/wa-theoffice/overlays/cushion.png', x: 22, y: 17, scale: 4 },
    { key: 'ov-cushion2', path: '/assets/wa-theoffice/overlays/cushion2.png', x: 25, y: 17, scale: 4 },
    // Two foosball tables stacked on the right.
    { key: 'ov-foosball', path: '/assets/wa-theoffice/overlays/foosball.png', x: 29, y: 15, scale: 1 },
    { key: 'ov-foosball', path: '/assets/wa-theoffice/overlays/foosball.png', x: 29, y: 19, scale: 1 },
    // Couch + greenery — the same grey loveseat used over in the workspace.
    { key: 'ov-wsofa', path: '/assets/wa-theoffice/overlays/workspace-sofa.png', x: 21, y: 20, scale: 2 },
    { key: 'ov-wsofa', path: '/assets/wa-theoffice/overlays/workspace-sofa.png', x: 24, y: 20, scale: 2 },
    { key: 'ov-plant-tall', path: '/assets/limezu/singles/plant_tall.png', x: 33, y: 15, scale: 2 },
    { key: 'ov-plant', path: '/assets/limezu/singles/plant.png', x: 26, y: 20, scale: 2 },
  ],
  labels: [
    { text: 'GAMES', x: 27, y: 18 },
    { text: 'KITCHEN', x: 23, y: 12 },
    { text: 'CEO CABIN', x: 7, y: 6 },
    { text: 'MEETING ROOM', x: 15, y: 3 },
    { text: 'WORKSPACE', x: 7, y: 17 },
    { text: 'LOUNGE', x: 40, y: 4 },
    { text: 'DESKS', x: 41, y: 19 },
  ],
  tilesets: [
    { name: "WA_Special_Zones", key: "wa-WA_Special_Zones", path: "/assets/wa-theoffice/tiles/WA_Special_Zones.png" },
    { name: "dunder mifflin BG", key: "wa-dunder mifflin BG", path: "/assets/wa-theoffice/tiles/dunder mifflin BG.png" },
    { name: "dunder mifflin FG", key: "wa-dunder mifflin FG", path: "/assets/wa-theoffice/tiles/dunder mifflin FG.png" },
    { name: "dunder mifflin outside", key: "wa-dunder mifflin outside", path: "/assets/wa-theoffice/tiles/dunder mifflin outside.png" },
    { name: "dunder mifflin interior", key: "wa-dunder mifflin interior", path: "/assets/wa-theoffice/tiles/dunder mifflin interior.png" },
  ],
};

export const WA_GPTW: WaMapConfig = {
  id: "gptw",
  key: "wamap-gptw",
  path: "/assets/wa-gptw/map.json",
  tile: 32, cols: 79, rows: 92,
  skip: ['collisions', 'start', 'floorLayer'],
  tilesets: [
    { name: "Special_Zones", key: "wa-Special_Zones", path: "/assets/wa-gptw/tiles/Special_Zones.png" },
    { name: "LimeZu_1_Generic_32x32", key: "wa-LimeZu_1_Generic_32x32", path: "/assets/wa-gptw/tiles/LimeZu_1_Generic_32x32.png" },
    { name: "LimeZu_2_LivingRoom_32x32", key: "wa-LimeZu_2_LivingRoom_32x32", path: "/assets/wa-gptw/tiles/LimeZu_2_LivingRoom_32x32.png" },
    { name: "LimeZu_3_Bathroom_32x32", key: "wa-LimeZu_3_Bathroom_32x32", path: "/assets/wa-gptw/tiles/LimeZu_3_Bathroom_32x32.png" },
    { name: "LimeZu_5_Classroom_and_library_32x32", key: "wa-LimeZu_5_Classroom_and_library_32x32", path: "/assets/wa-gptw/tiles/LimeZu_5_Classroom_and_library_32x32.png" },
    { name: "LimeZu_6_Music_and_sport_32x32", key: "wa-LimeZu_6_Music_and_sport_32x32", path: "/assets/wa-gptw/tiles/LimeZu_6_Music_and_sport_32x32.png" },
    { name: "LimeZu_12_Kitchen_32x32", key: "wa-LimeZu_12_Kitchen_32x32", path: "/assets/wa-gptw/tiles/LimeZu_12_Kitchen_32x32.png" },
    { name: "LimeZu_13_Conference_Hall_32x32", key: "wa-LimeZu_13_Conference_Hall_32x32", path: "/assets/wa-gptw/tiles/LimeZu_13_Conference_Hall_32x32.png" },
    { name: "LimeZu_16_Grocery_store_32x32", key: "wa-LimeZu_16_Grocery_store_32x32", path: "/assets/wa-gptw/tiles/LimeZu_16_Grocery_store_32x32.png" },
    { name: "LimeZu_14_Basement_32x32", key: "wa-LimeZu_14_Basement_32x32", path: "/assets/wa-gptw/tiles/LimeZu_14_Basement_32x32.png" },
    { name: "LimeZu_17_Visibile_Upstairs_System_32x32", key: "wa-LimeZu_17_Visibile_Upstairs_System_32x32", path: "/assets/wa-gptw/tiles/LimeZu_17_Visibile_Upstairs_System_32x32.png" },
    { name: "LimeZu_18_Jail_32x32", key: "wa-LimeZu_18_Jail_32x32", path: "/assets/wa-gptw/tiles/LimeZu_18_Jail_32x32.png" },
    { name: "LimeZu_19_Hospital_32x32", key: "wa-LimeZu_19_Hospital_32x32", path: "/assets/wa-gptw/tiles/LimeZu_19_Hospital_32x32.png" },
    { name: "LimeZu_20_Japanese_interiors_32x32", key: "wa-LimeZu_20_Japanese_interiors_32x32", path: "/assets/wa-gptw/tiles/LimeZu_20_Japanese_interiors_32x32.png" },
    { name: "LimeZu_22_Museum_32x32", key: "wa-LimeZu_22_Museum_32x32", path: "/assets/wa-gptw/tiles/LimeZu_22_Museum_32x32.png" },
    { name: "LimeZu_23_Room_Builder_32x32", key: "wa-LimeZu_23_Room_Builder_32x32", path: "/assets/wa-gptw/tiles/LimeZu_23_Room_Builder_32x32.png" },
    { name: "LimeZu_24_Office_32x32", key: "wa-LimeZu_24_Office_32x32", path: "/assets/wa-gptw/tiles/LimeZu_24_Office_32x32.png" },
    { name: "LimeZu_24_User_Interface_32x32", key: "wa-LimeZu_24_User_Interface_32x32", path: "/assets/wa-gptw/tiles/LimeZu_24_User_Interface_32x32.png" },
    { name: "Tv_Studio_Design_layer_2_32x32", key: "wa-Tv_Studio_Design_layer_2_32x32", path: "/assets/wa-gptw/tiles/Tv_Studio_Design_layer_2_32x32.png" },
    { name: "Modern_Office_Black_Shadow_32x32", key: "wa-Modern_Office_Black_Shadow_32x32", path: "/assets/wa-gptw/tiles/Modern_Office_Black_Shadow_32x32.png" },
    { name: "fantasy_1", key: "wa-fantasy_1", path: "/assets/wa-gptw/tiles/fantasy_1.png" },
    { name: "terrain", key: "wa-terrain", path: "/assets/wa-gptw/tiles/terrain.png" },
    { name: "8_Gym_Shadowless_32x32", key: "wa-8_Gym_Shadowless_32x32", path: "/assets/wa-gptw/tiles/8_Gym_Shadowless_32x32.png" },
    { name: "LPC-terrains-subimissions-outside", key: "wa-LPC-terrains-subimissions-outside", path: "/assets/wa-gptw/tiles/LPC-terrains-subimissions-outside.png" },
    { name: "Floor", key: "wa-Floor", path: "/assets/wa-gptw/tiles/Floor.png" },
    { name: "Water", key: "wa-Water", path: "/assets/wa-gptw/tiles/Water.png" },
    { name: "ANIMATIONS", key: "wa-ANIMATIONS", path: "/assets/wa-gptw/tiles/ANIMATIONS.png" },
    { name: "9_Fishing_32x32", key: "wa-9_Fishing_32x32", path: "/assets/wa-gptw/tiles/9_Fishing_32x32.png" },
    { name: "10_Birthday_party_32x32", key: "wa-10_Birthday_party_32x32", path: "/assets/wa-gptw/tiles/10_Birthday_party_32x32.png" },
    { name: "15_Christmas_32x32", key: "wa-15_Christmas_32x32", path: "/assets/wa-gptw/tiles/15_Christmas_32x32.png" },
    { name: "work_adventure_tilesets", key: "wa-work_adventure_tilesets", path: "/assets/wa-gptw/tiles/work_adventure_tilesets.png" },
    { name: "LimeZu_4_Bedroom_32x32", key: "wa-LimeZu_4_Bedroom_32x32", path: "/assets/wa-gptw/tiles/LimeZu_4_Bedroom_32x32.png" },
    { name: "ANIMATIONS2", key: "wa-ANIMATIONS2", path: "/assets/wa-gptw/tiles/ANIMATIONS2.png" },
    { name: "Light map", key: "wa-Light map", path: "/assets/wa-gptw/tiles/Light map.png" },
    { name: "Trees and flowers", key: "wa-Trees and flowers", path: "/assets/wa-gptw/tiles/Trees and flowers.png" },
    { name: "WA_User_Interface", key: "wa-WA_User_Interface", path: "/assets/wa-gptw/tiles/WA_User_Interface.png" },
  ],
};

/** The map the office currently renders. Switch this to compare. */
export const WA_SELECTED: WaMapConfig = WA_THEOFFICE;

// ── Org-aware seating (theoffice, 46×24 tiles) ──────────────────────────────
export type Facing = 'up' | 'down' | 'left' | 'right';
export interface SeatXY {
  /** The CHAIR tile (so the agent reads as sitting, not standing beside it). */
  x: number;
  y: number;
  /** Which way the agent faces — toward their monitor/desk. */
  face: Facing;
}

/**
 * Where each kind of agent sits, by zone — each is the chair tile + the way the
 * agent faces its desk:
 * - **CEO** in the exec cabin (chair above the desk → faces down).
 * - **CTO** in the walled office near the kitchen/games band (chair below the
 *   desk → faces up).
 * - **CFO/finance** at the printer desk behind the library.
 * - **Engineering + product** fill the WORKSPACE pods (chairs above monitors → down).
 * - **Marketing / GTM / sales** take the right DESKS (chairs below desks → up).
 */
export const WA_SEATING = {
  ceo: { x: 7, y: 3, face: 'down' } as SeatXY, // exec cabin, chair above desk
  cto: { x: 17, y: 21, face: 'up' } as SeatXY, // walled cabin near the games band
  cfo: { x: 3, y: 14, face: 'down' } as SeatXY, // printer desk behind the library
  // Engineering + product fill the workspace pods (centre-left/bottom).
  workspace: [
    { x: 14, y: 11, face: 'down' }, { x: 13, y: 13, face: 'left' },
    { x: 10, y: 13, face: 'left' }, { x: 7, y: 14, face: 'right' },
    { x: 16, y: 14, face: 'down' }, { x: 4, y: 19, face: 'down' },
    { x: 6, y: 20, face: 'left' }, { x: 9, y: 21, face: 'right' },
    { x: 4, y: 22, face: 'up' }, { x: 12, y: 22, face: 'up' },
  ] as SeatXY[],
  // Marketing / GTM / sales on the right DESKS.
  marketing: [
    { x: 43, y: 14, face: 'up' }, { x: 41, y: 15, face: 'left' },
    { x: 38, y: 17, face: 'right' }, { x: 43, y: 17, face: 'right' },
    { x: 43, y: 21, face: 'up' }, { x: 42, y: 22, face: 'up' },
  ] as SeatXY[],
};

/** The conference table — 10 seats (two rows + two ends). */
export const WA_MEETING_SEATS: SeatXY[] = [
  { x: 14, y: 4, face: 'down' }, { x: 15, y: 4, face: 'down' },
  { x: 16, y: 4, face: 'down' }, { x: 17, y: 4, face: 'down' },
  { x: 13, y: 5, face: 'right' }, { x: 18, y: 5, face: 'left' },
  { x: 14, y: 6, face: 'up' }, { x: 15, y: 6, face: 'up' },
  { x: 16, y: 6, face: 'up' }, { x: 17, y: 6, face: 'up' },
];

/**
 * Social / recreation positions for the liveliness loop (Step 3): break spots
 * agents drift to when idle, and where meetings happen. Mapped from the live
 * office. Foosball is two pairs (players face their table).
 */
export const WA_SOCIAL = {
  foosball: [
    [{ x: 30, y: 14, face: 'down' }, { x: 30, y: 18, face: 'up' }],
    [{ x: 29, y: 18, face: 'down' }, { x: 30, y: 22, face: 'up' }],
  ] as SeatXY[][],
  tvBeanbags: [
    { x: 23, y: 18, face: 'up' }, { x: 25, y: 18, face: 'up' },
  ] as SeatXY[],
  lounge: [
    { x: 42, y: 6, face: 'down' }, { x: 43, y: 5, face: 'down' }, { x: 44, y: 6, face: 'down' },
  ] as SeatXY[],
  kitchen: [
    { x: 21, y: 12, face: 'up' }, { x: 23, y: 12, face: 'up' },
  ] as SeatXY[],
};

export type SeatZone = 'ceo' | 'cto' | 'cfo' | 'marketing' | 'workspace';

const MARKETING_ROLES = new Set([
  'cmo', 'marketer', 'marketing', 'sales', 'gtm', 'growth', 'bd',
  'cro', 'sdr', 'ae', 'pmm', 'revenue',
]);

/** Map a Paperclip role to its seating zone. */
export function seatZoneForRole(role: string): SeatZone {
  const r = (role || '').toLowerCase();
  if (r === 'ceo') return 'ceo';
  if (r === 'cto') return 'cto';
  if (r === 'cfo' || r === 'finance' || r === 'accountant') return 'cfo';
  if (MARKETING_ROLES.has(r)) return 'marketing';
  return 'workspace'; // engineering, design, product, and everything else
}
