import { Container } from 'pixi.js';
import {
  CatState,
  type CatData,
  type CatSkin,
  type OfficeLayout,
  type Position,
  type Direction,
  type ServerMessage,
} from '@cat-office/shared';
import { CatSprite } from '../sprites/CatSprite.js';
import { renderTileMap } from '../tiles/TileMapRenderer.js';

export interface CatInfo {
  id: string;
  name: string;
  skin: CatSkin;
  state: CatState;
  sessionId: string;
}

export class OfficeScene {
  container = new Container();
  private backgroundLayer = new Container();
  private gameObjectLayer = new Container();
  private foregroundLayer = new Container();
  private cats = new Map<string, CatSprite>();
  private office: OfficeLayout | null = null;
  private selectedCatId: string | null = null;

  constructor() {
    this.container.addChild(this.backgroundLayer);
    this.container.addChild(this.gameObjectLayer);
    this.container.addChild(this.foregroundLayer);

    this.drawBackground();

    // Click background to deselect
    this.backgroundLayer.eventMode = 'static';
    this.backgroundLayer.on('pointerdown', () => {
      this.deselectCat();
    });
  }

  private selectCat(catId: string): void {
    // Deselect previous
    if (this.selectedCatId && this.selectedCatId !== catId) {
      const prev = this.cats.get(this.selectedCatId);
      if (prev) prev.hideLabel();
    }
    this.selectedCatId = catId;
  }

  private deselectCat(): void {
    if (this.selectedCatId) {
      const cat = this.cats.get(this.selectedCatId);
      if (cat) cat.hideLabel();
      this.selectedCatId = null;
    }
  }

  private drawBackground(): void {
    const { background, foreground } = renderTileMap();
    this.backgroundLayer.addChild(background);
    this.foregroundLayer.addChild(foreground);
  }

  private sortGameObjects(): void {
    this.gameObjectLayer.children.sort((a, b) => {
      const da = (a as any).isoDepth ?? 0;
      const db = (b as any).isoDepth ?? 0;
      return da - db;
    });
  }

  handleSnapshot(msg: Extract<ServerMessage, { type: 'room:snapshot' }>): void {
    this.office = msg.office;

    // Clear existing cats
    for (const cat of this.cats.values()) {
      this.gameObjectLayer.removeChild(cat.container);
    }
    this.cats.clear();

    // Spawn all cats from snapshot
    for (const catData of msg.cats) {
      this.spawnCat(catData);
    }

    this.updateCatCount();
  }

  handleCatSpawn(catData: CatData): void {
    this.spawnCat(catData);
    this.updateCatCount();
  }

  handleCatDespawn(catId: string): void {
    const cat = this.cats.get(catId);
    if (cat) {
      this.gameObjectLayer.removeChild(cat.container);
      this.cats.delete(catId);
      this.updateCatCount();
    }
  }

  handleCatStateChange(catId: string, state: CatState, direction?: Direction, waitingForInput?: boolean): void {
    const cat = this.cats.get(catId);
    if (cat) {
      cat.setState(state);
      if (direction) cat.setDirection(direction);
      cat.setWaitingForInput(waitingForInput ?? false);
    }
  }

  handleCatMove(catId: string, position: Position, targetPosition: Position | null): void {
    const cat = this.cats.get(catId);
    if (cat) {
      cat.moveTo(position);
    }
  }

  setConnectionStatus(_connected: boolean): void {
    // Connection status is shown in the HTML overlay toolbar
  }

  getCatsInfo(): CatInfo[] {
    const infos: CatInfo[] = [];
    for (const cat of this.cats.values()) {
      infos.push({ id: cat.id, name: cat.name, skin: cat.skin, state: cat.currentState, sessionId: cat.sessionId });
    }
    return infos;
  }

  getCatCount(): number {
    return this.cats.size;
  }

  update(deltaMs: number): void {
    for (const cat of this.cats.values()) {
      cat.update(deltaMs);
    }
    this.sortGameObjects();
  }

  private spawnCat(catData: CatData): void {
    const cat = new CatSprite(catData);
    cat.onSelect = (catId) => this.selectCat(catId);
    if (catData.waitingForInput) cat.setWaitingForInput(true);
    this.gameObjectLayer.addChild(cat.container);
    this.cats.set(catData.id, cat);
  }

  private updateCatCount(): void {
    // Cat count is shown in the HTML overlay toolbar
  }
}
