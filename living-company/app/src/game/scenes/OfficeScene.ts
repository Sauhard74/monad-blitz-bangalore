import Phaser from 'phaser';
import { TILE_SCALE } from '@/game/config';
import {
  CHARACTER_FRAME_H,
  CHARACTER_FRAME_W,
  TILE_PX,
  charTextureKey,
} from '@/game/office/atlas';
import { AgentSprite } from '@/game/objects/AgentSprite';
import { SpeechCloud } from '@/game/objects/SpeechCloud';
import type { TileXY } from '@/game/objects/pathing';
import {
  CORRIDOR_HUB,
  DESKS,
  ENTRANCE,
  MEETING_SEATS,
  OFFICE_H,
  OFFICE_W,
  ROOMS,
  ROOMS_DEF,
  buildAccessories,
  buildFurniture,
  buildGround,
  getRoom,
  getRoomDef,
  roomCenter,
} from '@/game/office/officeMap';
import { GameDirector, type OfficeWorld } from '@/game/GameDirector';
import {
  LZ_CONF_PATH,
  LZ_FLOORS_PATH,
  LZ_FLOOR_TILE_PX,
  LZ_GENERIC_PATH,
  LZ_OFFICE_PATH,
  LZ_OBJECTS,
  LZ_RB_PATH,
  LZ_RB_TEX,
  LZ_SINGLES,
  LZ_SINGLES_DIR,
  LZ_TEX,
  WALL,
  singleTexKey,
  type LzObjectName,
  type SingleName,
  type WallPiece,
  texKeyFor,
} from '@/game/office/limezu';
import {
  WA_MEETING_SEATS,
  WA_SEATING,
  WA_SELECTED,
  WA_SOCIAL,
  seatZoneForRole,
  type SeatXY,
} from '@/game/office/waMap';
import { getCompanySource } from '@/lib/data/source';
import { publishCamera } from '@/game/office/cameraBridge';
import { SEED_CHARACTERS } from '@/lib/data/seed';
import { useOfficeStore, type StandupReport } from '@/lib/state/officeStore';
import type { Agent, Desk } from '@/lib/domain/types';

/**
 * The office world. Renders the tilemap + furniture, spawns the cast at their
 * desks, implements the {@link OfficeWorld} surface the {@link GameDirector}
 * drives, and runs light idle behaviors so the office feels alive at rest.
 */
export class OfficeScene extends Phaser.Scene implements OfficeWorld {
  static readonly KEY = 'OfficeScene';

  private agents = new Map<string, AgentSprite>();
  private deskTileByAgent = new Map<string, TileXY>();
  private seatByAgent = new Map<string, TileXY>();
  /** The direction each agent faces when seated at their own desk. */
  private faceByAgent = new Map<string, 'up' | 'down' | 'left' | 'right'>();
  /** Agents currently away from their desk on a break, and their return timers. */
  private onBreak = new Set<string>();
  private breakTimers = new Map<string, Phaser.Time.TimerEvent>();
  /** Earliest time (ms) each agent is allowed to take another break. */
  private breakCooldown = new Map<string, number>();
  /** Last stand-up sequence the scene has already choreographed. */
  private lastStandupSeq = 0;
  /** Which room an agent's desk is in, and which room they're currently in. */
  private homeRoomByAgent = new Map<string, string>();
  private currentRoomByAgent = new Map<string, string>();
  private director?: GameDirector;

  constructor() {
    super(OfficeScene.KEY);
  }

  preload(): void {
    // LimeZu interior sheets (loaded as plain images so we can carve furniture
    // rects of arbitrary size from them).
    this.load.image(LZ_TEX.floors, LZ_FLOORS_PATH);
    this.load.image(LZ_TEX.generic, LZ_GENERIC_PATH);
    this.load.image(LZ_TEX.conference, LZ_CONF_PATH);
    this.load.image(LZ_TEX.office, LZ_OFFICE_PATH);
    this.load.image(LZ_RB_TEX, LZ_RB_PATH);
    // Curated furniture singles (individual PNGs with consistent shadows).
    for (const name of Object.keys(LZ_SINGLES) as SingleName[]) {
      this.load.image(singleTexKey(name), `${LZ_SINGLES_DIR}${name}.png`);
    }
    // LimeZu character run sheets (16×32, one row of 24 frames).
    for (const name of new Set(SEED_CHARACTERS)) {
      this.load.spritesheet(charTextureKey(name), `/assets/limezu/characters/${name}.png`, {
        frameWidth: CHARACTER_FRAME_W,
        frameHeight: CHARACTER_FRAME_H,
      });
    }
    // WorkAdventure imported map (Tiled) + its tilesets.
    this.load.tilemapTiledJSON(WA_SELECTED.key, WA_SELECTED.path);
    for (const ts of WA_SELECTED.tilesets) this.load.image(ts.key, ts.path);
    for (const ov of WA_SELECTED.overlays ?? []) {
      if (!this.textures.exists(ov.key)) this.load.image(ov.key, ov.path);
    }
  }

  create(): void {
    this.renderWaMap();
    void this.boot();
    this.startLifeLoop();
    this.subscribeStandup();
    console.log('[OfficeScene] ready');
  }

  /** Render the imported WorkAdventure Tiled map: every tileset, every visible
   *  layer, with the overhead layers drawn above the cast. */
  private renderWaMap(): void {
    const cfg = WA_SELECTED;
    const map = this.make.tilemap({ key: cfg.key });
    const tilesets = cfg.tilesets
      .map((t) => map.addTilesetImage(t.name, t.key))
      .filter((t): t is Phaser.Tilemaps.Tileset => Boolean(t));
    // Render every tile layer (groups are flattened by Phaser) in order, by
    // index — names repeat across groups, so index is the unambiguous handle.
    let depth = 0;
    map.layers.forEach((ld, i) => {
      if (cfg.skip.includes(ld.name)) return;
      map.createLayer(i, tilesets, 0, 0)?.setDepth(depth++);
    });

    // Our own furniture overlays + room labels on top of the imported map.
    for (const ov of cfg.overlays ?? []) {
      this.add
        .image(ov.x * cfg.tile, ov.y * cfg.tile, ov.key)
        .setOrigin(0, 0)
        .setScale(ov.scale)
        .setDepth(800);
    }
    for (const lb of cfg.labels ?? []) {
      this.add
        .text(lb.x * cfg.tile, lb.y * cfg.tile, lb.text, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#2b2b2b',
          backgroundColor: '#f4e3b8',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5, 0.5)
        .setDepth(860);
    }

    const worldW = cfg.cols * cfg.tile;
    const worldH = cfg.rows * cfg.tile;
    this.worldBounds = { x: 0, y: 0, w: worldW, h: worldH };
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.fitCamera());
  }

  /** Seat the initial roster, then start consuming the live event stream. */
  private async boot(): Promise<void> {
    await this.spawnCompany();
    this.startDirector();
    this.startRosterSync();
  }

  private rosterTimer?: ReturnType<typeof setInterval>;

  /** Keep the office in sync with the live org: as the company hires (or if the
   *  page opened before hires landed), pull the full roster, seat any newcomers,
   *  and refresh the Employees panel — so the team always matches Paperclip. */
  private startRosterSync(): void {
    const source = getCompanySource();
    const sync = async (): Promise<void> => {
      let agents: Agent[];
      try {
        agents = await source.getAgents();
      } catch {
        return;
      }
      if (!agents.length) return;
      for (const a of agents) {
        if (!this.agents.has(a.id)) this.seatAgent(a, { walkIn: true });
      }
      useOfficeStore.getState().setCompany(agents, ROOMS);
    };
    this.rosterTimer = setInterval(() => void sync(), 12000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.rosterTimer) clearInterval(this.rosterTimer);
    });
  }

  // --- rendering -----------------------------------------------------------

  private renderOffice(tile: number): void {
    // Wood floor from the LimeZu floors tileset.
    const map = this.make.tilemap({
      data: buildGround(),
      tileWidth: LZ_FLOOR_TILE_PX,
      tileHeight: LZ_FLOOR_TILE_PX,
    });
    const tileset = map.addTilesetImage(
      LZ_TEX.floors,
      LZ_TEX.floors,
      LZ_FLOOR_TILE_PX,
      LZ_FLOOR_TILE_PX,
      0,
      0,
    );
    const worldW = OFFICE_W * tile;
    const worldH = OFFICE_H * tile;
    // Sky + mountains above the building and a grass strip below — the
    // reference's outdoor backdrop. Drawn behind the floor (negative depth).
    const sky = 7 * tile;
    const grass = 2 * tile;
    this.drawBuildingShell(worldW, worldH, tile, sky, grass);

    if (tileset) map.createLayer(0, tileset, 0, 0)?.setScale(TILE_SCALE);

    this.renderRooms();
    for (const item of [...buildFurniture(), ...buildAccessories()]) {
      if (item.single) this.drawSingle(item.single, item.tileX, item.tileY);
      else if (item.object) this.drawObject(item.object, item.tileX, item.tileY);
    }

    this.worldBounds = { x: 0, y: -sky, w: worldW, h: sky + worldH + grass };
    const b = this.worldBounds;
    this.cameras.main.setBounds(b.x, b.y, b.w, b.h);
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.fitCamera());
  }

  private worldBounds = { x: 0, y: 0, w: 0, h: 0 };

  /** Sky gradient, two mountain ranges, and a grass strip framing the building. */
  private drawBuildingShell(
    worldW: number,
    worldH: number,
    tile: number,
    sky: number,
    grass: number,
  ): void {
    const g = this.add.graphics().setDepth(-100);
    // Sky (top lighter, bottom hazier).
    g.fillStyle(0xbfe3f2, 1);
    g.fillRect(0, -sky, worldW, sky);
    g.fillStyle(0xd6eef7, 1);
    g.fillRect(0, -sky, worldW, sky * 0.4);
    // Far range, then nearer forested range.
    g.fillStyle(0x8f9bbd, 1);
    this.mountainRange(g, worldW, -tile * 1.2, tile * 2.6, 9, 13);
    g.fillStyle(0x5a6a86, 1);
    this.mountainRange(g, worldW, -tile * 0.2, tile * 1.8, 14, 29);
    // Grass strip below the building.
    g.fillStyle(0x73b35a, 1);
    g.fillRect(0, worldH, worldW, grass);
    g.fillStyle(0x5f9c48, 1);
    g.fillRect(0, worldH, worldW, Math.max(3, tile * 0.18));
  }

  /** Draw a jagged mountain silhouette across `width`, peaks varied by a cheap
   *  deterministic hash (Math.random is unavailable in this runtime). */
  private mountainRange(
    g: Phaser.GameObjects.Graphics,
    width: number,
    baseY: number,
    height: number,
    count: number,
    seed: number,
  ): void {
    const step = width / count;
    for (let i = 0; i <= count; i++) {
      const cx = i * step;
      const h = height * (0.55 + 0.45 * (((i * seed) % 7) / 7));
      g.fillTriangle(cx - step * 0.85, baseY, cx, baseY - h, cx + step * 0.85, baseY);
    }
  }

  /** Place a single white wall piece at a tile. */
  private wallPiece(name: WallPiece, tileX: number, tileY: number): void {
    const tile = LZ_FLOOR_TILE_PX * TILE_SCALE;
    const tex = this.textures.get(LZ_RB_TEX);
    const frameName = `wall-${name}`;
    const p = WALL[name];
    if (!tex.has(frameName)) tex.add(frameName, 0, p.x, p.y, LZ_FLOOR_TILE_PX, LZ_FLOOR_TILE_PX);
    this.add
      .image(tileX * tile, tileY * tile, LZ_RB_TEX, frameName)
      .setOrigin(0, 0)
      .setScale(TILE_SCALE)
      .setDepth(5);
  }

  /** Draw a full rectangle of walls (corners + edges), skipping doorway gaps. */
  private drawRectWalls(
    rect: { x: number; y: number; w: number; h: number },
    doors: { side: 'top' | 'bottom' | 'left' | 'right'; at: number; span: number }[],
  ): void {
    const { x, y, w, h } = rect;
    const inDoor = (side: string, n: number) =>
      doors.some((d) => d.side === side && n >= d.at && n < d.at + d.span);

    this.wallPiece('tl', x, y);
    this.wallPiece('tr', x + w - 1, y);
    this.wallPiece('bl', x, y + h - 1);
    this.wallPiece('br', x + w - 1, y + h - 1);
    for (let cx = x + 1; cx < x + w - 1; cx++) {
      if (!inDoor('top', cx)) this.wallPiece('t', cx, y);
      if (!inDoor('bottom', cx)) this.wallPiece('b', cx, y + h - 1);
    }
    for (let cy = y + 1; cy < y + h - 1; cy++) {
      if (!inDoor('left', cy)) this.wallPiece('l', x, cy);
      if (!inDoor('right', cy)) this.wallPiece('r', x + w - 1, cy);
    }
  }

  /** Office perimeter (with an entrance) + only the walls each zone declares
   *  (open-plan zones declare none; the conference room declares its glass
   *  left + bottom walls). */
  private renderRooms(): void {
    // Perimeter, with the entrance doorway in the bottom wall.
    this.drawRectWalls(
      { x: 0, y: 0, w: OFFICE_W, h: OFFICE_H },
      [{ side: 'bottom', at: ENTRANCE.x, span: 2 }],
    );
    for (const room of ROOMS_DEF) {
      for (const wd of room.walls) this.drawWallSide(room.rect, wd.side, wd.door);
    }
  }

  /** Draw a single wall side of a rect (with an optional doorway gap). */
  private drawWallSide(
    rect: { x: number; y: number; w: number; h: number },
    side: 'top' | 'bottom' | 'left' | 'right',
    door?: { at: number; span: number },
  ): void {
    const { x, y, w, h } = rect;
    const skip = (n: number) => door && n >= door.at && n < door.at + door.span;
    if (side === 'top' || side === 'bottom') {
      const ry = side === 'top' ? y : y + h - 1;
      this.wallPiece(side === 'top' ? 'tl' : 'bl', x, ry);
      this.wallPiece(side === 'top' ? 'tr' : 'br', x + w - 1, ry);
      for (let cx = x + 1; cx < x + w - 1; cx++)
        if (!skip(cx)) this.wallPiece(side === 'top' ? 't' : 'b', cx, ry);
    } else {
      const rx = side === 'left' ? x : x + w - 1;
      for (let cy = y + 1; cy < y + h - 1; cy++)
        if (!skip(cy)) this.wallPiece(side === 'left' ? 'l' : 'r', rx, cy);
    }
  }

  /** Place a curated single PNG, anchored by its top-left tile. Depth-sorted by
   *  its bottom edge so agents pass in front of / behind it. */
  private drawSingle(name: SingleName, tileX: number, tileY: number): void {
    const { h } = LZ_SINGLES[name];
    const tile = LZ_FLOOR_TILE_PX * TILE_SCALE;
    this.add
      .image(tileX * tile, tileY * tile, singleTexKey(name))
      .setOrigin(0, 0)
      .setScale(TILE_SCALE)
      .setDepth(10 + tileY + h);
  }

  /** Place a carved LimeZu furniture piece anchored by its top-left tile. */
  private drawObject(name: LzObjectName, tileX: number, tileY: number): void {
    const obj = LZ_OBJECTS[name];
    const texKey = texKeyFor(obj.sheet);
    const texture = this.textures.get(texKey);
    if (!texture.has(name)) texture.add(name, 0, obj.x, obj.y, obj.w, obj.h);

    const tile = LZ_FLOOR_TILE_PX * TILE_SCALE;
    this.add
      .image(tileX * tile, tileY * tile, texKey, name)
      .setOrigin(0, 0)
      .setScale(TILE_SCALE)
      // Depth-sort by the object's bottom edge so agents pass in front/behind.
      .setDepth(10 + tileY + obj.h / LZ_FLOOR_TILE_PX);
  }

  /** Publish the camera view each frame so HUD overlays can anchor to world
   *  positions (e.g. the dashboard on the screen wall). */
  update(): void {
    const cam = this.cameras.main;
    publishCamera(cam.worldView.x, cam.worldView.y, cam.zoom);
  }

  /** Zoom the camera so the whole scene (building + sky + grass) fits, centred. */
  private fitCamera(): void {
    const cam = this.cameras.main;
    const vw = this.scale.gameSize.width;
    const vh = this.scale.gameSize.height;
    const b = this.worldBounds;
    if (!vw || !vh || !b.w || !b.h) return;
    const zoom = Math.min(vw / b.w, vh / b.h) * 0.99;
    cam.setZoom(zoom);
    // Expand the bounds to at least the viewport so a map shorter/narrower than
    // the screen sits CENTRED (margins split evenly) instead of pinned top-left.
    const viewW = vw / zoom;
    const viewH = vh / zoom;
    const bw = Math.max(b.w, viewW);
    const bh = Math.max(b.h, viewH);
    cam.setBounds(b.x - (bw - b.w) / 2, b.y - (bh - b.h) / 2, bw, bh);
    cam.centerOn(b.x + b.w / 2, b.y + b.h / 2);
  }

  // Round-robin cursors so agents fill the workspace / marketing desks in order.
  private workspaceSeatIdx = 0;
  private marketingSeatIdx = 0;

  private async spawnCompany(): Promise<void> {
    // The starting roster comes from the data source (the current Paperclip org).
    // Everyone here is already in the office, seated by role.
    const agents = await getCompanySource().getAgents();
    for (const agent of agents) this.seatAgent(agent, { walkIn: false });
    useOfficeStore.getState().setCompany(agents, ROOMS);
  }

  /** A new hire arrives (Paperclip `agent.hired`): appear at their role's desk. */
  spawnAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) return;
    this.seatAgent(agent, { walkIn: true });
  }

  /** The tile an agent sits at, chosen by their role's zone (CEO/CTO cabins,
   *  CFO printer desk, engineering+product in the workspace, marketing on the right). */
  private seatForAgent(agent: Agent): SeatXY {
    switch (seatZoneForRole(agent.role)) {
      case 'ceo':
        return WA_SEATING.ceo;
      case 'cto':
        return WA_SEATING.cto;
      case 'cfo':
        return WA_SEATING.cfo;
      case 'marketing':
        return WA_SEATING.marketing[this.marketingSeatIdx++ % WA_SEATING.marketing.length];
      default:
        return WA_SEATING.workspace[this.workspaceSeatIdx++ % WA_SEATING.workspace.length];
    }
  }

  private seatAgent(agent: Agent, opts: { walkIn: boolean }): void {
    const seat = this.seatForAgent(agent);
    const deskTile = { x: seat.x, y: seat.y };
    this.deskTileByAgent.set(agent.id, deskTile);
    this.seatByAgent.set(agent.id, deskTile);
    this.faceByAgent.set(agent.id, seat.face);
    this.homeRoomByAgent.set(agent.id, 'workspace');
    this.currentRoomByAgent.set(agent.id, 'workspace');

    const sprite = new AgentSprite(this, agent.spriteKey, deskTile);
    sprite.face(seat.face); // seated, facing their monitor/desk
    this.agents.set(agent.id, sprite);

    if (opts.walkIn) new SpeechCloud(this, sprite, `Hi — I'm ${agent.name}!`);
  }

  /** Walk an agent straight to a tile on the open-plan floor. On arrival at their
   *  own desk they resume their seat facing; elsewhere they face down. */
  private walkAgentTo(agentId: string, roomId: string, target: TileXY): void {
    const sprite = this.agents.get(agentId);
    if (!sprite) return;
    this.currentRoomByAgent.set(agentId, roomId);
    const home = this.deskTileByAgent.get(agentId);
    const atHome = !!home && home.x === target.x && home.y === target.y;
    const onArrive = atHome ? (this.faceByAgent.get(agentId) ?? 'down') : 'down';
    void sprite.walkTo(target).then(() => sprite.face(onArrive));
  }

  private startDirector(): void {
    const source = getCompanySource();
    this.director = new GameDirector(this, useOfficeStore.getState().applyEvent);
    void this.director.run(source);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.director?.stop());
  }

  // --- OfficeWorld surface (driven by the director) ------------------------

  moveAgentToRoom(agentId: string, roomId: string): void {
    if (!this.agents.has(agentId)) return;
    this.endBreakState(agentId); // real work wins over any break in progress
    this.walkAgentTo(agentId, roomId, this.targetFor(agentId, roomId));
  }

  /** Drop an agent out of break state (without the return walk) — used when a
   *  real work/meeting event takes over. */
  private endBreakState(agentId: string): void {
    this.cancelBreakTimer(agentId);
    this.onBreak.delete(agentId);
    // Just did real work / a meeting — settle a while before any next break.
    this.breakCooldown.set(agentId, this.time.now + OfficeScene.BREAK_COOLDOWN_MS);
  }

  speak(agentId: string, text: string): void {
    const sprite = this.agents.get(agentId);
    if (!sprite) return;
    new SpeechCloud(this, sprite, text);
  }

  think(agentId: string, text: string): void {
    const sprite = this.agents.get(agentId);
    if (!sprite) return;
    new SpeechCloud(this, sprite, `💭 ${text}`, { variant: 'thought', durationMs: 2200 });
  }

  gather(_roomId: string, agentIds: string[]): void {
    // Bring the named agents to the conference table up top (a meeting wins over
    // any break in progress).
    agentIds.forEach((id, i) => {
      const sprite = this.agents.get(id);
      if (!sprite) return;
      this.endBreakState(id);
      this.currentRoomByAgent.set(id, 'meeting');
      const seat = WA_MEETING_SEATS[i % WA_MEETING_SEATS.length];
      void sprite.walkTo(seat).then(() => sprite.face(seat.face));
    });
  }

  endMeeting(): void {
    // Everyone returns to their own desk and faces their monitor again.
    for (const [id, sprite] of this.agents) {
      const home = this.deskTileByAgent.get(id);
      if (home) void sprite.walkTo(home).then(() => sprite.face(this.faceByAgent.get(id) ?? 'up'));
    }
  }

  /** Resolve a room id to a concrete tile target for a given agent. On the
   *  open-plan WA map, meetings go to the conference table; everything else
   *  routes the agent to their own desk so events never throw them off-map. */
  private targetFor(agentId: string, roomId: string): TileXY {
    if (roomId === 'meeting' || roomId === 'warroom') {
      return this.seatByAgent.get(agentId) ?? this.deskTileByAgent.get(agentId) ?? WA_SEATING.ceo;
    }
    return this.deskTileByAgent.get(agentId) ?? WA_SEATING.ceo;
  }

  // --- liveliness ----------------------------------------------------------
  // Idle agents (task done / between heartbeats) drift off in small staggered
  // groups to foosball / kitchen / lounge, then return to their desks. Purely
  // visual and status-driven: real work events (move/meeting) always win.

  private static readonly MAX_ON_BREAK = 2; // at most this many away at once
  private static readonly BREAK_COOLDOWN_MS = 150_000; // ~2.5 min before an agent breaks again
  private static readonly BREAK_CHANCE = 0.22; // per tick, when eligible agents exist
  private static readonly DESK_FLAVOR = ['💭', '☕', 'Hmm…', '🎧', 'Focus.', '✅'];

  private startLifeLoop(): void {
    this.time.addEvent({ delay: 6000, loop: true, callback: () => this.deskFlavor() });
    this.time.addEvent({ delay: 14000, loop: true, callback: () => this.lifeTick() });
  }

  /** An agent may wander only when idle, not already in a meeting or on a break,
   *  and past its post-break cooldown — so breaks stay occasional, not constant. */
  private isIdle(id: string): boolean {
    const status = useOfficeStore.getState().agents.find((a) => a.id === id)?.status;
    return (
      status === 'idle' &&
      !this.onBreak.has(id) &&
      this.currentRoomByAgent.get(id) !== 'meeting' &&
      this.time.now >= (this.breakCooldown.get(id) ?? 0)
    );
  }

  /** Occasional thought/coffee bubble over a seated agent. */
  private deskFlavor(): void {
    const seated = [...this.agents.keys()].filter((id) => !this.onBreak.has(id));
    if (!seated.length || Math.random() > 0.45) return;
    const sprite = this.agents.get(seated[Math.floor(Math.random() * seated.length)]);
    if (sprite) {
      const f = OfficeScene.DESK_FLAVOR;
      new SpeechCloud(this, sprite, f[Math.floor(Math.random() * f.length)], {
        variant: 'thought',
        durationMs: 1700,
      });
    }
  }

  private lifeTick(): void {
    // Pull anyone whose work resumed back to their desk first.
    for (const id of [...this.onBreak]) {
      const status = useOfficeStore.getState().agents.find((a) => a.id === id)?.status;
      if (status === 'working' || status === 'meeting' || status === 'thinking') this.returnFromBreak(id);
    }
    if (this.onBreak.size >= OfficeScene.MAX_ON_BREAK) return;
    const idle = [...this.agents.keys()].filter((id) => this.isIdle(id));
    if (!idle.length || Math.random() > OfficeScene.BREAK_CHANCE) return;

    // Pick a break. Foosball needs a pair; the rest take one or two.
    const buddy = (n: number) => idle.sort(() => Math.random() - 0.5).slice(0, n);
    const r = Math.random();
    if (r < 0.35 && idle.length >= 2) {
      const table = WA_SOCIAL.foosball[Math.floor(Math.random() * WA_SOCIAL.foosball.length)];
      this.sendOnBreak(buddy(2), table, '⚽');
    } else if (r < 0.6) {
      this.sendOnBreak(buddy(Math.random() < 0.5 ? 2 : 1), WA_SOCIAL.kitchen, '☕');
    } else if (r < 0.8) {
      this.sendOnBreak(buddy(Math.min(idle.length, 1 + Math.floor(Math.random() * 2))), WA_SOCIAL.lounge, '🛋️');
    } else {
      this.sendOnBreak(buddy(Math.random() < 0.5 ? 2 : 1), WA_SOCIAL.tvBeanbags, '📺');
    }
  }

  private sendOnBreak(ids: string[], spots: SeatXY[], prop: string): void {
    ids.forEach((id, i) => {
      const sprite = this.agents.get(id);
      const spot = spots[i % spots.length];
      if (!sprite || !spot) return;
      this.onBreak.add(id);
      this.cancelBreakTimer(id);
      void sprite.walkTo(spot).then(() => {
        if (!this.onBreak.has(id)) return; // pulled back to work mid-walk
        sprite.face(spot.face);
        new SpeechCloud(this, sprite, prop, { durationMs: 2600 });
      });
      const back = this.time.delayedCall(26000 + Math.random() * 9000, () => this.returnFromBreak(id));
      this.breakTimers.set(id, back);
    });
  }

  private returnFromBreak(id: string): void {
    this.cancelBreakTimer(id);
    if (!this.onBreak.delete(id)) return;
    this.breakCooldown.set(id, this.time.now + OfficeScene.BREAK_COOLDOWN_MS);
    const sprite = this.agents.get(id);
    const home = this.deskTileByAgent.get(id);
    if (sprite && home) {
      this.currentRoomByAgent.set(id, 'workspace');
      void sprite.walkTo(home).then(() => sprite.face(this.faceByAgent.get(id) ?? 'down'));
    }
  }

  private cancelBreakTimer(id: string): void {
    this.breakTimers.get(id)?.remove();
    this.breakTimers.delete(id);
  }

  // --- stand-up ------------------------------------------------------------

  /** Watch the store for a user-triggered stand-up and choreograph it. */
  private subscribeStandup(): void {
    const unsub = useOfficeStore.subscribe((s) => {
      const su = s.standup;
      if (su && su.seq !== this.lastStandupSeq) {
        this.lastStandupSeq = su.seq;
        this.runStandup(su.reports);
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsub);
  }

  /** Everyone gathers at the table and reports their current focus in turn,
   *  then returns to their desks. */
  private runStandup(reports: StandupReport[]): void {
    const present = reports.filter((r) => this.agents.has(r.agentId));
    this.gather('meeting', present.map((r) => r.agentId));

    const STEP = 2600;
    present.forEach((r, i) => {
      this.time.delayedCall(1700 + i * STEP, () => {
        const sprite = this.agents.get(r.agentId);
        if (!sprite) return;
        const line = r.working
          ? `${r.name}: on “${r.working.slice(0, 60)}”`
          : `${r.name}: free — between tasks`;
        new SpeechCloud(this, sprite, line, { durationMs: STEP });
      });
    });

    const total = 1700 + present.length * STEP + 1400;
    this.time.delayedCall(total, () => {
      this.endMeeting();
      useOfficeStore.getState().endStandup();
    });
  }
}
