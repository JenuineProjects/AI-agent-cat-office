export enum CatState {
  Idle = 'idle',
  Walking = 'walking',
  Typing = 'typing',
  Reading = 'reading',
  Searching = 'searching',
  Sleeping = 'sleeping',
  Playing = 'playing',
  Eating = 'eating',
}

export type CatSkin =
  | 'tabby'
  | 'black'
  | 'white'
  | 'ginger'
  | 'tuxedo'
  | 'grey'
  | 'calico'
  | 'siamese'
  | 'tortoiseshell'
  | 'mackerel';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

export interface CatData {
  id: string;
  name: string;
  skin: CatSkin;
  state: CatState;
  position: Position;
  direction: Direction;
  targetPosition: Position | null;
  sessionId: string;
  lastActivityTime: number;
  waitingForInput?: boolean;
}

export type ToolName =
  | 'Write'
  | 'Edit'
  | 'MultiEdit'
  | 'Read'
  | 'Grep'
  | 'Glob'
  | 'Bash'
  | 'WebFetch'
  | 'WebSearch'
  | 'Agent'
  | 'NotebookEdit';

export interface ToolEvent {
  type: 'tool_use' | 'tool_result';
  toolName: ToolName | string;
  sessionId: string;
  timestamp: number;
}

export type FurnitureType =
  | 'desk'
  | 'monitor'
  | 'chair'
  | 'food_bowl'
  | 'yarn_ball'
  | 'cat_bed'
  | 'cardboard_box'
  | 'plant'
  | 'bookshelf'
  | 'cat_tree'
  | 'ball'
  | 'painting'
  | 'window'
  | 'filing_shelf'
  | 'mouse_toy'
  | 'scratching_post';

export interface FurnitureData {
  id: string;
  type: FurnitureType;
  position: Position;
  size: { width: number; height: number };
}

export interface OfficeLayout {
  width: number;
  height: number;
  furniture: FurnitureData[];
  walkable: boolean[][];
}

// Server -> Client messages
export type ServerMessage =
  | { type: 'room:snapshot'; cats: CatData[]; office: OfficeLayout }
  | { type: 'cat:spawn'; cat: CatData }
  | { type: 'cat:despawn'; catId: string }
  | { type: 'cat:stateChange'; catId: string; state: CatState; direction?: Direction; waitingForInput?: boolean }
  | { type: 'cat:move'; catId: string; position: Position; targetPosition: Position | null };

// Client -> Server messages
export type ClientMessage =
  | { type: 'room:requestSnapshot' };
