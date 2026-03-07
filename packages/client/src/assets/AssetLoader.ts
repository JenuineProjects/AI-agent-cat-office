import { Assets, Texture, Rectangle } from 'pixi.js';
import { CatState, type CatSkin } from '@cat-office/shared';
import type { MapData } from '../tiles/TileMapRenderer.js';

// ── Asset paths ──────────────────────────────────────────────────────
const CAT_SHEETS: Record<string, string> = {
  AllCats: '/sprites/cats/AllCats.png',
  OrangeCat: '/sprites/cats/OrangeCat.png',
  Grey: '/sprites/cats/Grey.png',
  WhiteCat: '/sprites/cats/WhiteCat.png',
  'Tuxedo-Idle': '/sprites/cats/Tuxedo-Idle.png',
  'Tuxedo-Run': '/sprites/cats/Tuxedo-Run.png',
  'Tuxedo-Eat': '/sprites/cats/Tuxedo-Eat.png',
  'Tuxedo-Sleep': '/sprites/cats/Tuxedo-Sleep.png',
  'Tuxedo-Sit': '/sprites/cats/Tuxedo-Sit.png',
  Still: '/sprites/cats/Still.png',
  Walk1: '/sprites/cats/Walk1.png',
};

const TILEMAP_SHEET = '/sprites/tilemap/spritesheet.png';
const TILEMAP_JSON = '/sprites/tilemap/map.json';

// ── Loaded base textures ─────────────────────────────────────────────
const loadedTextures = new Map<string, Texture>();

// ── Tilemap data ─────────────────────────────────────────────────────
const tileTextureCache = new Map<number, Texture>();
let mapData: MapData | null = null;
let tilemapBaseTexture: Texture | null = null;

// Spritesheet layout: 8 columns × 11 rows of 32×32 tiles
const SHEET_COLS = 8;
const TILE_PX = 32;

export async function loadAllAssets(): Promise<void> {
  // Load cat sheets
  for (const [key, path] of Object.entries(CAT_SHEETS)) {
    const texture = await Assets.load<Texture>(path);
    texture.source.scaleMode = 'nearest';
    loadedTextures.set(key, texture);
  }

  // Load tilemap spritesheet
  tilemapBaseTexture = await Assets.load<Texture>(TILEMAP_SHEET);
  tilemapBaseTexture.source.scaleMode = 'nearest';

  // Load map.json
  const resp = await fetch(TILEMAP_JSON);
  mapData = await resp.json() as MapData;
}

// ── Tile texture extraction ──────────────────────────────────────────

/** Get a 32×32 tile texture by ID from the spritesheet. */
export function getTileTexture(id: number): Texture | null {
  if (!tilemapBaseTexture) return null;

  const cached = tileTextureCache.get(id);
  if (cached) return cached;

  const col = id % SHEET_COLS;
  const row = Math.floor(id / SHEET_COLS);
  const rect = new Rectangle(col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX);
  const tex = new Texture({ source: tilemapBaseTexture.source, frame: rect });
  tex.source.scaleMode = 'nearest';
  tileTextureCache.set(id, tex);
  return tex;
}

/** Get the parsed map data. */
export function getMapData(): MapData | null {
  return mapData;
}

// ── Frame extraction helpers ─────────────────────────────────────────

function extractFrames(
  baseTexture: Texture,
  frameWidth: number,
  frameHeight: number,
  row: number,
  frameCount: number,
  startCol: number = 0,
): Texture[] {
  const frames: Texture[] = [];
  for (let i = 0; i < frameCount; i++) {
    const rect = new Rectangle((startCol + i) * frameWidth, row * frameHeight, frameWidth, frameHeight);
    const tex = new Texture({ source: baseTexture.source, frame: rect });
    tex.source.scaleMode = 'nearest';
    frames.push(tex);
  }
  return frames;
}

function extractStrip(
  baseTexture: Texture,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
): Texture[] {
  return extractFrames(baseTexture, frameWidth, frameHeight, 0, frameCount);
}

// ── Skin → sheet mapping ─────────────────────────────────────────────
type SheetType = 'full' | 'tuxedo' | 'cats1';

interface SkinMapping {
  type: SheetType;
  sheet: string;
  /** For cats1: which 20×20 frame index in Still.png (0=brown, 1=black, 2=orange) */
  stillFrame?: number;
}

const SKIN_MAP: Record<CatSkin, SkinMapping> = {
  tabby:         { type: 'full', sheet: 'AllCats' },
  black:         { type: 'cats1', sheet: 'Walk1', stillFrame: 1 },
  white:         { type: 'full', sheet: 'WhiteCat' },
  ginger:        { type: 'full', sheet: 'OrangeCat' },
  tuxedo:        { type: 'tuxedo', sheet: 'Tuxedo-Idle' },
  grey:          { type: 'full', sheet: 'Grey' },
  calico:        { type: 'cats1', sheet: 'Walk1', stillFrame: 0 },
  siamese:       { type: 'full', sheet: 'AllCats' },
  tortoiseshell: { type: 'cats1', sheet: 'Walk1', stillFrame: 2 },
  mackerel:      { type: 'full', sheet: 'Grey' },
};

// ── Full-sheet row mapping (32x32 frames) ────────────────────────────
interface RowMapping {
  row: number;
  count: number;
  startCol?: number;
}

const FULL_SHEET_STATE_ROWS: Record<CatState, RowMapping> = {
  [CatState.Idle]:      { row: 0, count: 10 },
  [CatState.Walking]:   { row: 1, count: 10 },
  [CatState.Searching]: { row: 3, count: 4 },
  [CatState.Playing]:   { row: 4, count: 8 },
  [CatState.Sleeping]:  { row: 6, count: 4 },
  [CatState.Typing]:    { row: 7, count: 6 },
  [CatState.Reading]:   { row: 7, count: 6 },
  [CatState.Eating]:    { row: 12, count: 12 },
};

// ── Tuxedo strip mapping (48x48 frames) ──────────────────────────────
interface TuxedoMapping {
  sheet: string;
  count: number;
}

const TUXEDO_STATE_MAP: Record<CatState, TuxedoMapping> = {
  [CatState.Idle]:      { sheet: 'Tuxedo-Idle', count: 12 },
  [CatState.Walking]:   { sheet: 'Tuxedo-Run', count: 6 },
  [CatState.Typing]:    { sheet: 'Tuxedo-Sit', count: 7 },
  [CatState.Reading]:   { sheet: 'Tuxedo-Sit', count: 7 },
  [CatState.Searching]: { sheet: 'Tuxedo-Idle', count: 12 },
  [CatState.Sleeping]:  { sheet: 'Tuxedo-Sleep', count: 4 },
  [CatState.Playing]:   { sheet: 'Tuxedo-Run', count: 6 },
  [CatState.Eating]:    { sheet: 'Tuxedo-Eat', count: 8 },
};

// ── Public API ───────────────────────────────────────────────────────

export function getCatFrames(skin: CatSkin, state: CatState): Texture[] {
  const mapping = SKIN_MAP[skin] ?? SKIN_MAP.tabby;

  if (mapping.type === 'tuxedo') {
    return getTuxedoFrames(state);
  }

  if (mapping.type === 'cats1') {
    return getCats1Frames(state, mapping.stillFrame ?? 0);
  }

  const baseTex = loadedTextures.get(mapping.sheet);
  if (!baseTex) return getFallbackFrames();

  const rowInfo = FULL_SHEET_STATE_ROWS[state];
  return extractFrames(baseTex, 32, 32, rowInfo.row, rowInfo.count, rowInfo.startCol);
}

function getTuxedoFrames(state: CatState): Texture[] {
  const info = TUXEDO_STATE_MAP[state];
  const baseTex = loadedTextures.get(info.sheet);
  if (!baseTex) return getFallbackFrames();
  return extractStrip(baseTex, 48, 48, info.count);
}

function getCats1Frames(state: CatState, stillFrame: number): Texture[] {
  if (state === CatState.Walking || state === CatState.Playing) {
    const baseTex = loadedTextures.get('Walk1');
    if (!baseTex) return getFallbackFrames();
    return extractStrip(baseTex, 20, 20, 6);
  }
  // For all non-walking states, extract only the single correct frame from Still.png
  const baseTex = loadedTextures.get('Still');
  if (!baseTex) return getFallbackFrames();
  const rect = new Rectangle(stillFrame * 20, 0, 20, 20);
  const tex = new Texture({ source: baseTex.source, frame: rect });
  tex.source.scaleMode = 'nearest';
  return [tex];
}

function getFallbackFrames(): Texture[] {
  return [Texture.WHITE];
}

export function getCatFrameSize(skin: CatSkin): number {
  const mapping = SKIN_MAP[skin] ?? SKIN_MAP.tabby;
  if (mapping.type === 'tuxedo') return 48;
  if (mapping.type === 'cats1') return 20;
  return 32;
}
