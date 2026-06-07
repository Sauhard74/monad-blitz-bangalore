import Phaser from 'phaser';

/** Anything the cloud can hover above (an AgentSprite satisfies this). */
export interface CloudTarget {
  x: number;
  y: number;
  displayHeight: number;
}

export type CloudVariant = 'speech' | 'thought';

const STYLE = {
  ink: 0x1b1228,
  radius: 8,
  pad: 9,
  wrap: 168,
  tail: 11,
};

const FILL: Record<CloudVariant, number> = {
  speech: 0xfdfdff,
  thought: 0xe9f1ff,
};

/**
 * A comic-style speech bubble: a white rounded cloud with a thick dark outline
 * and a little tail pointing down at the speaker. Pops in, follows its target,
 * and auto-dismisses.
 */
export class SpeechCloud extends Phaser.GameObjects.Container {
  private readonly target: CloudTarget;
  private readonly halfHeight: number;
  private readonly onUpdate: () => void;
  private dismissed = false;

  constructor(
    scene: Phaser.Scene,
    target: CloudTarget,
    text: string,
    opts: { durationMs?: number; variant?: CloudVariant } = {},
  ) {
    super(scene, target.x, target.y);
    this.target = target;
    const durationMs = opts.durationMs ?? 2800;
    const fill = FILL[opts.variant ?? 'speech'];

    const label = scene.add
      .text(0, 0, text, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#1b1228',
        align: 'center',
        wordWrap: { width: STYLE.wrap },
      })
      .setOrigin(0.5)
      .setResolution(2);

    const w = label.width + STYLE.pad * 2;
    const h = label.height + STYLE.pad * 2;
    this.halfHeight = h / 2;

    const g = scene.add.graphics();
    // Bubble body.
    g.fillStyle(fill, 1);
    g.lineStyle(3, STYLE.ink, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, STYLE.radius);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, STYLE.radius);
    // Tail (fill first to mask the body's bottom stroke, then outline the sides).
    g.fillStyle(fill, 1);
    g.fillTriangle(-7, h / 2 - 2, 7, h / 2 - 2, 0, h / 2 + STYLE.tail);
    g.lineStyle(3, STYLE.ink, 1);
    g.lineBetween(-7, h / 2 - 1, 0, h / 2 + STYLE.tail);
    g.lineBetween(7, h / 2 - 1, 0, h / 2 + STYLE.tail);

    this.add([g, label]);
    this.setDepth(1000);
    scene.add.existing(this);

    this.reposition();
    this.onUpdate = () => this.reposition();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);

    this.setScale(0);
    scene.tweens.add({ targets: this, scale: 1, duration: 170, ease: 'Back.out' });
    scene.time.delayedCall(durationMs, () => this.dismiss());
  }

  private reposition(): void {
    this.x = this.target.x;
    this.y = this.target.y - this.target.displayHeight * 0.6 - STYLE.tail - this.halfHeight;
  }

  dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 150,
      ease: 'Back.in',
      onComplete: () => this.destroy(),
    });
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    super.destroy(fromScene);
  }
}
