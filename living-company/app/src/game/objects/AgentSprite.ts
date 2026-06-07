import Phaser from 'phaser';
import { AGENT_SCALE, OFFICE_TILE_PX } from '@/game/config';
import {
  CHARACTER_FRAME_H,
  CHARACTER_FRAME_W,
  RUN_FRAMES,
  TILE_PX,
  type Direction,
  charTextureKey,
  idleFrame,
} from '@/game/office/atlas';
import { type TileXY, pathBetween } from '@/game/objects/pathing';

const STEP_MS = 230;

/**
 * A character in the office: a LimeZu 16×32 sprite that walks tile-to-tile with
 * directional run animations, standing on the first frame of a direction when
 * idle. Each character has its own texture (`char-<name>`).
 */
export class AgentSprite extends Phaser.GameObjects.Sprite {
  readonly charName: string;
  tile: TileXY;
  private facing: Direction = 'down';

  constructor(scene: Phaser.Scene, charName: string, tile: TileXY) {
    const tilePx = OFFICE_TILE_PX;
    const key = charTextureKey(charName);
    super(scene, tile.x * tilePx + tilePx / 2, tile.y * tilePx + tilePx / 2, key, idleFrame('down'));
    this.charName = charName;
    this.tile = { ...tile };

    AgentSprite.registerAnims(scene, charName);
    // Render the 16×32 sprite on the 32px office grid; anchor near the feet so the
    // character stands in the middle of its tile with the head overhanging up.
    this.setScale(AGENT_SCALE);
    this.setOrigin(0.5, 0.8);
    this.setDepth(100 + tile.y);
    scene.add.existing(this);
    this.face('down');
  }

  static registerAnims(scene: Phaser.Scene, name: string): void {
    const key = charTextureKey(name);
    (Object.keys(RUN_FRAMES) as Direction[]).forEach((dir) => {
      const animKey = AgentSprite.walkKey(name, dir);
      if (scene.anims.exists(animKey)) return;
      scene.anims.create({
        key: animKey,
        frames: RUN_FRAMES[dir].map((frame) => ({ key, frame })),
        frameRate: 10,
        repeat: -1,
      });
    });
  }

  private static walkKey(name: string, dir: Direction): string {
    return `${name}-walk-${dir}`;
  }

  /** Face a direction while standing still. */
  face(dir: Direction): void {
    this.facing = dir;
    this.stop();
    this.setFrame(idleFrame(dir));
  }

  /** Walk through a sequence of waypoints in order (routes through doorways). */
  async walkPath(waypoints: TileXY[]): Promise<void> {
    for (const wp of waypoints) await this.walkTo(wp);
  }

  /** Walk to a target tile, animating one tile at a time. Resolves on arrival. */
  walkTo(target: TileXY): Promise<void> {
    this.scene.tweens.killTweensOf(this);
    const path = pathBetween(this.tile, target);
    const tilePx = OFFICE_TILE_PX;

    return new Promise((resolve) => {
      let i = 0;
      const advance = () => {
        if (i >= path.length) {
          this.face(this.facing);
          resolve();
          return;
        }
        const step = path[i++];
        const dir = step.dir as Direction;
        this.facing = dir;
        const animKey = AgentSprite.walkKey(this.charName, dir);
        if (this.anims.currentAnim?.key !== animKey || !this.anims.isPlaying) {
          this.play(animKey, true);
        }
        this.tile = { x: step.x, y: step.y };
        this.scene.tweens.add({
          targets: this,
          x: step.x * tilePx + tilePx / 2,
          y: step.y * tilePx + tilePx / 2,
          duration: STEP_MS,
          ease: 'Linear',
          onUpdate: () => this.setDepth(100 + this.tile.y),
          onComplete: advance,
        });
      };
      advance();
    });
  }
}
