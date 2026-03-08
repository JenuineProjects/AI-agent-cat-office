import { CatSkin, CatState, FurnitureType } from './types.js';

export const TILE_SIZE = 32;
export const OFFICE_WIDTH = 19;
export const OFFICE_HEIGHT = 12;
export const CANVAS_SCALE = 2;

export const CAT_SPEED = 2; // tiles per second
export const IDLE_SLEEP_TIMEOUT = 60 * 1000; // 60 seconds before sleeping
export const IDLE_BEHAVIOR_INTERVAL = 10 * 1000; // 10 seconds between idle checks
export const IDLE_BEHAVIOR_CHANCE = 0.15; // low chance — cats stay at workstations longer
export const WORK_IDLE_TIMEOUT = 15 * 1000; // 15 seconds of no tool events before going idle

export const WS_PORT = 3000;
export const WS_RECONNECT_BASE_DELAY = 1000;
export const WS_RECONNECT_MAX_DELAY = 30000;

export const FRAME_DURATIONS: Record<CatState, number> = {
  [CatState.Idle]: 150,
  [CatState.Walking]: 100,
  [CatState.Typing]: 120,
  [CatState.Reading]: 200,
  [CatState.Searching]: 150,
  [CatState.Sleeping]: 500,
  [CatState.Playing]: 130,
  [CatState.Eating]: 180,
};

// Fallback frame counts — CatSprite uses actual loaded frames.length instead
export const FRAME_COUNTS: Record<CatState, number> = {
  [CatState.Idle]: 10,
  [CatState.Walking]: 10,
  [CatState.Typing]: 6,
  [CatState.Reading]: 6,
  [CatState.Searching]: 12,
  [CatState.Sleeping]: 4,
  [CatState.Playing]: 4,
  [CatState.Eating]: 12,
};

export const TOOL_TO_ACTION: Record<string, CatState> = {
  Write: CatState.Typing,
  Edit: CatState.Typing,
  MultiEdit: CatState.Typing,
  NotebookEdit: CatState.Typing,
  Bash: CatState.Typing,
  Read: CatState.Reading,
  WebFetch: CatState.Typing,
  WebSearch: CatState.Typing,
  Grep: CatState.Searching,
  Glob: CatState.Searching,
  Agent: CatState.Typing,
};

export const CAT_SKINS: CatSkin[] = [
  'tabby', 'black', 'white', 'ginger', 'tuxedo',
  'grey', 'calico', 'siamese', 'tortoiseshell', 'mackerel',
];

export const CAT_NAMES: string[] = [
  'Whiskers', 'Mittens', 'Shadow', 'Luna', 'Oliver', 'Mochi',
  'Pixel', 'Debug', 'Byte', 'Cookie', 'Noodle', 'Biscuit',
  'Patches', 'Cleo', 'Felix', 'Gizmo', 'Widget', 'Kernel',
];

export const IDLE_BEHAVIORS: CatState[] = [
  CatState.Playing,
  CatState.Eating,
  CatState.Sleeping,
];

export const ACTION_FURNITURE_MAP: Partial<Record<CatState, FurnitureType>> = {
  [CatState.Typing]: 'desk',
  [CatState.Reading]: 'bookshelf',
  [CatState.Searching]: 'bookshelf',
  [CatState.Eating]: 'food_bowl',
  [CatState.Playing]: 'cat_tree',
  [CatState.Sleeping]: 'cat_bed',
};

export interface FurnitureInteraction {
  mode: 'on' | 'below';
  offset?: { dx: number; dy: number };
}

export const FURNITURE_INTERACTION: Partial<Record<FurnitureType, FurnitureInteraction>> = {
  desk: { mode: 'on' },
  cat_bed: { mode: 'on' },
  food_bowl: { mode: 'on' },
  cat_tree: { mode: 'below' },
  bookshelf: { mode: 'below' },
  filing_shelf: { mode: 'below' },
  mouse_toy: { mode: 'below' },
  scratching_post: { mode: 'below' },
};
