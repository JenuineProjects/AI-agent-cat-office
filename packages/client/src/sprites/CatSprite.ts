import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import {
  TILE_SIZE,
  CatState,
  FRAME_DURATIONS,
  type CatData,
  type CatSkin,
  type Direction,
  type Position,
} from '@cat-office/shared';
import { getCatFrames, getCatFrameSize } from '../assets/AssetLoader.js';
import { isoProject, isoDepth } from '../utils/isoUtils.js';

// Identity colours to distinguish cats — matches taskbar dot
const IDENTITY_COLORS: number[] = [
  0x4488ff, // blue
  0xff4444, // red
  0x44cc44, // green
  0x222222, // black
  0xaa44ff, // purple
  0xff66aa, // pink
  0xff8800, // orange
  0x00cccc, // teal
  0xdddd00, // yellow
  0xff44ff, // magenta
];

const STATE_LABELS: Record<CatState, string> = {
  [CatState.Idle]: 'Idle',
  [CatState.Walking]: 'Walking',
  [CatState.Typing]: 'Coding',
  [CatState.Reading]: 'Reading',
  [CatState.Searching]: 'Searching',
  [CatState.Sleeping]: 'Sleeping',
  [CatState.Playing]: 'Playing',
  [CatState.Eating]: 'Eating',
};

const STATE_PIXEL_OFFSETS: Partial<Record<CatState, { dx: number; dy: number }>> = {
  [CatState.Sleeping]: { dx: 8, dy: 6 },
  [CatState.Eating]: { dx: 0, dy: -2 },
  [CatState.Playing]: { dx: 0, dy: -4 },
};

export class CatSprite {
  container = new Container();
  private sprite: Sprite;
  private stateDot = new Graphics();
  private shadowGraphic = new Graphics();

  readonly id: string;
  readonly name: string;
  readonly skin: CatSkin;
  readonly sessionId: string;
  readonly catIndex: number;
  currentState: CatState;
  private direction: Direction = 'down';

  private animFrame = 0;
  private animTimer = 0;
  private targetX: number;
  private targetY: number;
  private tileX: number;
  private tileY: number;

  /** All preloaded frames keyed by state. */
  private framesByState: Map<CatState, Texture[]>;
  /** Current animation frames for active state. */
  private currentFrames: Texture[];
  /** Native frame pixel size for this skin (32, 48, or 20). */
  private nativeSize: number;

  /** Click-to-inspect label */
  private nameLabel: Container;
  private nameLabelText: Text;
  private nameLabelBg: Graphics;
  private labelTimer = 0;
  private labelVisible = false;

  /** Speech bubble for waiting-for-input */
  private speechBubble: Container;
  private speechBubbleTimer = 0;
  private _waitingForInput = false;

  /** Zzz animation for sleeping */
  private zzzText: Text;
  private zzzTimer = 0;

  /** Callback for click events */
  onSelect: ((catId: string) => void) | null = null;

  constructor(data: CatData) {
    this.id = data.id;
    this.name = data.name;
    this.skin = data.skin;
    this.sessionId = data.sessionId;
    this.catIndex = data.catIndex;
    this.currentState = data.state;
    this.direction = data.direction;
    this.nativeSize = getCatFrameSize(data.skin);

    // Preload all state frames for this skin
    this.framesByState = new Map();
    for (const state of Object.values(CatState)) {
      const frames = getCatFrames(data.skin, state);
      this.framesByState.set(state, frames);
    }

    this.currentFrames = this.framesByState.get(data.state) ?? [Texture.WHITE];

    this.tileX = data.position.x;
    this.tileY = data.position.y;
    const isoPos = isoProject(this.tileX, this.tileY);
    this.container.position.set(isoPos.x, isoPos.y);
    this.targetX = isoPos.x;
    this.targetY = isoPos.y;

    // Shadow
    this.shadowGraphic.rect(4, 14, 8, 2);
    this.shadowGraphic.fill({ color: 0x000000, alpha: 0.2 });
    this.container.addChild(this.shadowGraphic);

    // Cat sprite — scale native frame size to fit TILE_SIZE (16px)
    this.sprite = new Sprite(this.currentFrames[0]);
    this.sprite.anchor.set(0, 0);
    const scale = TILE_SIZE / this.nativeSize;
    this.sprite.scale.set(scale, scale);
    this.container.addChild(this.sprite);

    // State indicator dot
    this.stateDot.visible = false;
    this.container.addChild(this.stateDot);

    // Name label (click-to-inspect popup)
    this.nameLabel = new Container();
    this.nameLabel.visible = false;
    const labelStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xffffff,
      align: 'center',
      fontWeight: 'bold',
      dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 0.8 },
    });
    this.nameLabelText = new Text({ text: `${this.name}\n${STATE_LABELS[this.currentState]}`, style: labelStyle });
    this.nameLabelText.anchor.set(0.5, 1);
    this.nameLabelBg = new Graphics();
    this.nameLabel.addChild(this.nameLabelBg);
    this.nameLabel.addChild(this.nameLabelText);
    this.nameLabel.position.set(8, -20);
    this.container.addChild(this.nameLabel);

    // Speech bubble ("..." when waiting for input)
    this.speechBubble = new Container();
    this.speechBubble.visible = false;
    const bubbleBg = new Graphics();
    bubbleBg.roundRect(-10, -14, 20, 11, 4);
    bubbleBg.fill({ color: 0xffffff, alpha: 0.9 });
    // Small triangle tail
    bubbleBg.moveTo(-2, -3);
    bubbleBg.lineTo(2, -3);
    bubbleBg.lineTo(0, 1);
    bubbleBg.closePath();
    bubbleBg.fill({ color: 0xffffff, alpha: 0.9 });
    this.speechBubble.addChild(bubbleBg);
    const dotsStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 7, fill: 0x333333, fontWeight: 'bold' });
    const dotsText = new Text({ text: '...', style: dotsStyle });
    dotsText.anchor.set(0.5, 0.5);
    dotsText.position.set(0, -8);
    this.speechBubble.addChild(dotsText);
    this.speechBubble.position.set(8, -6);
    this.container.addChild(this.speechBubble);

    // Zzz text for sleeping
    const zzzStyle = new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: 0xffffff, fontWeight: 'bold' });
    this.zzzText = new Text({ text: 'Zzz', style: zzzStyle });
    this.zzzText.anchor.set(0.5, 1);
    this.zzzText.position.set(14, -2);
    this.zzzText.visible = false;
    this.container.addChild(this.zzzText);

    // Click handler
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.on('pointerdown', (e) => {
      e.stopPropagation();
      this.showLabel();
      if (this.onSelect) this.onSelect(this.id);
    });

    this.applyDirection();
    this.updateStateIndicator();
  }

  setState(state: CatState): void {
    if (this.currentState === state) return;
    const prevState = this.currentState;
    this.currentState = state;
    this.animFrame = 0;
    this.animTimer = 0;
    this.currentFrames = this.framesByState.get(state) ?? [Texture.WHITE];
    this.sprite.texture = this.currentFrames[0];
    this.applyDirection();
    this.updateStateIndicator();
    this.updateLabelText();

    // Re-apply pixel offset for new state relative to iso position
    const isoPos = isoProject(this.tileX, this.tileY);
    const newOffset = STATE_PIXEL_OFFSETS[state];
    this.targetX = isoPos.x + (newOffset?.dx ?? 0);
    this.targetY = isoPos.y + (newOffset?.dy ?? 0);
  }

  showLabel(): void {
    this.updateLabelText();
    this.nameLabel.visible = true;
    this.labelVisible = true;
    this.labelTimer = 3500; // auto-hide after 3.5 seconds
  }

  hideLabel(): void {
    this.nameLabel.visible = false;
    this.labelVisible = false;
    this.labelTimer = 0;
  }

  setWaitingForInput(waiting: boolean): void {
    this._waitingForInput = waiting;
    this.speechBubble.visible = waiting;
    this.speechBubbleTimer = 0;
  }

  private updateLabelText(): void {
    const label = STATE_LABELS[this.currentState] ?? this.currentState;
    this.nameLabelText.text = `${this.name}\n${label}`;
    // Redraw background pill
    this.nameLabelBg.clear();
    const w = this.nameLabelText.width + 8;
    const h = this.nameLabelText.height + 5;
    this.nameLabelBg.roundRect(-w / 2, -h, w, h, 6);
    this.nameLabelBg.fill({ color: 0x000000, alpha: 0.9 });
    this.nameLabelBg.position.set(0, 0);
    this.nameLabelText.position.set(0, 0);
  }

  setDirection(direction: Direction): void {
    this.direction = direction;
    this.applyDirection();
  }

  moveTo(position: Position): void {
    this.tileX = position.x;
    this.tileY = position.y;
    const isoPos = isoProject(this.tileX, this.tileY);
    const offset = STATE_PIXEL_OFFSETS[this.currentState];
    this.targetX = isoPos.x + (offset?.dx ?? 0);
    this.targetY = isoPos.y + (offset?.dy ?? 0);

    const dx = this.targetX - this.container.x;
    const dy = this.targetY - this.container.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'right' : 'left';
    } else if (dy !== 0) {
      this.direction = dy > 0 ? 'down' : 'up';
    }
    this.applyDirection();
  }

  update(deltaMs: number): void {
    // Animation frames
    this.animTimer += deltaMs;
    const frameDuration = FRAME_DURATIONS[this.currentState];
    if (this.animTimer >= frameDuration) {
      this.animTimer -= frameDuration;
      this.animFrame = (this.animFrame + 1) % this.currentFrames.length;
      this.sprite.texture = this.currentFrames[this.animFrame];
    }

    // Smooth movement
    const speed = 0.12;
    const dx = this.targetX - this.container.x;
    const dy = this.targetY - this.container.y;
    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
      this.container.x += dx * speed;
      this.container.y += dy * speed;
    } else {
      this.container.x = this.targetX;
      this.container.y = this.targetY;
    }

    // Update iso depth for sorting (cats render slightly above same-depth furniture)
    (this.container as any).isoDepth = isoDepth(this.tileX, this.tileY) + 0.1;

    // Name label auto-hide timer
    if (this.labelVisible) {
      this.labelTimer -= deltaMs;
      if (this.labelTimer <= 0) {
        this.hideLabel();
      }
    }

    // Speech bubble bob animation
    if (this._waitingForInput) {
      this.speechBubbleTimer += deltaMs;
      this.speechBubble.position.y = -4 + Math.sin(this.speechBubbleTimer / 400) * 1.5;
    }

    // Zzz floating animation
    if (this.currentState === CatState.Sleeping) {
      this.zzzTimer += deltaMs;
      this.zzzText.visible = true;
      // Float upward and fade, then reset
      const cycle = (this.zzzTimer % 2000) / 2000; // 0→1 over 2 seconds
      this.zzzText.position.y = -4 - cycle * 10;
      this.zzzText.alpha = 1 - cycle * 0.7;
    } else {
      this.zzzText.visible = false;
      this.zzzTimer = 0;
    }
  }

  /** Flip sprite horizontally based on direction. Side-view sheets face right by default. */
  private applyDirection(): void {
    const scale = TILE_SIZE / this.nativeSize;

    // For sleeping/eating states, lock facing direction (no flip)
    if (this.currentState === CatState.Sleeping || this.currentState === CatState.Eating) {
      this.sprite.scale.x = scale;
      this.sprite.anchor.x = 0;
      return;
    }

    if (this.direction === 'left') {
      // Flip horizontally: negative scale, anchor at right edge
      this.sprite.scale.x = -scale;
      this.sprite.anchor.x = 1;
    } else {
      this.sprite.scale.x = scale;
      this.sprite.anchor.x = 0;
    }
  }

  private updateStateIndicator(): void {
    const color = IDENTITY_COLORS[this.catIndex % IDENTITY_COLORS.length];
    this.stateDot.clear();
    this.stateDot.circle(8, -1, 2.5);
    this.stateDot.fill(color);
    this.stateDot.stroke({ color: 0xffffff, width: 0.5 });
    this.stateDot.visible = true;
  }
}
