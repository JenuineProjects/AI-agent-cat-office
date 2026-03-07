import {
  CatData,
  CatSkin,
  CatState,
  Direction,
  Position,
  FurnitureData,
  OfficeLayout,
  CAT_SKINS,
  CAT_NAMES,
  ACTION_FURNITURE_MAP,
  FURNITURE_INTERACTION,
  transition,
  type StateMachineContext,
  type TransitionEvent,
} from '@cat-office/shared';

let nextCatIndex = 0;

export class CatAgent {
  readonly id: string;
  readonly name: string;
  readonly skin: CatSkin;
  readonly sessionId: string;
  readonly catIndex: number;

  /** Maps furniture type → assigned furniture ID for this cat */
  assignedFurniture = new Map<string, string>();

  state: CatState = CatState.Idle;
  position: Position;
  direction: Direction = 'down';
  targetPosition: Position | null = null;
  targetAction: CatState | null = null;
  snapPosition: Position | null = null;
  path: Position[] = [];

  lastActivityTime: number = Date.now();
  private idleStartTime: number | null = Date.now();
  private lastStateChangeTime: number = 0;
  private office: OfficeLayout;

  /** Minimum ms between state changes to prevent flashing */
  private static STATE_CHANGE_COOLDOWN = 5000;

  constructor(sessionId: string, office: OfficeLayout, catIndex: number, spawnPos?: Position) {
    this.id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.name = CAT_NAMES[catIndex % CAT_NAMES.length];
    this.skin = CAT_SKINS[catIndex % CAT_SKINS.length];
    this.sessionId = sessionId;
    this.office = office;
    this.catIndex = catIndex;
    nextCatIndex++;

    // Start at assigned position or center
    this.position = spawnPos ?? { x: Math.floor(office.width / 2), y: Math.floor(office.height / 2) };
  }

  handleEvent(event: TransitionEvent): boolean {
    const ctx: StateMachineContext = {
      currentState: this.state,
      lastActivityTime: this.lastActivityTime,
      idleStartTime: this.idleStartTime,
    };

    const result = transition(ctx, event);
    if (!result) return false;

    // Enforce cooldown to prevent rapid flashing from burst tool events
    const now = Date.now();
    if (event.type === 'TOOL_USE' && now - this.lastStateChangeTime < CatAgent.STATE_CHANGE_COOLDOWN) {
      // Still update activity time but don't change state
      this.lastActivityTime = now;
      return false;
    }

    const prevState = this.state;
    this.state = result.newState;
    this.lastStateChangeTime = now;

    if (result.targetAction) {
      this.targetAction = result.targetAction;
    }

    if (result.newState === CatState.Idle) {
      this.idleStartTime = Date.now();
      this.targetAction = null;
    } else {
      this.idleStartTime = null;
    }

    if (event.type === 'TOOL_USE' || event.type === 'TOOL_RESULT') {
      this.lastActivityTime = Date.now();
    }

    // If leaving a non-walkable tile (was snapped onto furniture), jump back to walkable
    if (result.newState === CatState.Walking && !this.office.walkable[this.position.y]?.[this.position.x]) {
      const adj = this.findAdjacentWalkable(this.position);
      if (adj) this.position = adj;
    }

    // If transitioning to walking, find target furniture
    if (result.newState === CatState.Walking && this.targetAction) {
      this.snapPosition = null;
      const furnitureType = ACTION_FURNITURE_MAP[this.targetAction];
      if (furnitureType) {
        const target = this.findAssignedFurniture(furnitureType);
        if (target) {
          const interaction = FURNITURE_INTERACTION[furnitureType];
          if (interaction?.mode === 'on') {
            const snapTile = interaction.offset
              ? { x: target.position.x + interaction.offset.dx, y: target.position.y + interaction.offset.dy }
              : { x: target.position.x, y: target.position.y };
            this.snapPosition = snapTile;
            const walkTarget = this.findAdjacentWalkable(snapTile);
            this.targetPosition = walkTarget ?? this.randomWalkablePosition();
            console.log(`[${this.name}] mode:on → snap=(${snapTile.x},${snapTile.y}) walkTo=(${this.targetPosition.x},${this.targetPosition.y}) furniture=${target.id} from=(${this.position.x},${this.position.y})`);
          } else {
            // mode 'below' — walk to tile below furniture
            const belowTile = { x: target.position.x, y: target.position.y + target.size.height };
            if (this.office.walkable[belowTile.y]?.[belowTile.x]) {
              this.targetPosition = belowTile;
            } else {
              // Below tile blocked — find nearest walkable adjacent to furniture
              this.targetPosition = this.findAdjacentWalkable(belowTile) ?? this.randomWalkablePosition();
            }
            console.log(`[${this.name}] mode:below → target=(${this.targetPosition.x},${this.targetPosition.y}) furniture=${target.id}`);
          }
        } else {
          this.targetPosition = this.randomWalkablePosition();
          console.log(`[${this.name}] no furniture for ${furnitureType}, random target`);
        }
      } else {
        this.targetPosition = this.randomWalkablePosition();
      }
    } else if (result.newState === CatState.Walking && !this.targetAction) {
      this.snapPosition = null;
      // Wander
      this.targetPosition = this.randomWalkablePosition();
    }

    return prevState !== this.state;
  }

  arriveAtDestination(): void {
    const prePos = `(${this.position.x},${this.position.y})`;
    // Snap onto furniture tile if set
    if (this.snapPosition) {
      this.position = { ...this.snapPosition };
      this.snapPosition = null;
      console.log(`[${this.name}] SNAP from ${prePos} → (${this.position.x},${this.position.y}) action=${this.targetAction}`);
    } else {
      console.log(`[${this.name}] ARRIVE at ${prePos} (no snap) action=${this.targetAction}`);
    }

    if (this.targetAction) {
      this.state = this.targetAction;
      this.targetAction = null;
    } else {
      this.state = CatState.Idle;
      this.idleStartTime = Date.now();
    }
    this.targetPosition = null;
    this.path = [];
  }

  /** Get the assigned furniture for this cat, or fall back to round-robin by catIndex. */
  private findAssignedFurniture(type: string): FurnitureData | null {
    // Check if we already have an assignment
    const assignedId = this.assignedFurniture.get(type);
    if (assignedId) {
      const f = this.office.furniture.find((f) => f.id === assignedId);
      if (f) return f;
    }

    // Find all furniture of this type
    const candidates = this.office.furniture.filter((f) => f.type === type);
    if (candidates.length === 0) return null;

    // Round-robin: pick based on catIndex so each cat gets a different one
    const pick = candidates[this.catIndex % candidates.length];
    this.assignedFurniture.set(type, pick.id);
    return pick;
  }

  private findAdjacentWalkable(target: Position): Position | null {
    const dirs = [
      { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
    ];
    let best: Position | null = null;
    let bestDist = Infinity;
    for (const d of dirs) {
      const nx = target.x + d.x;
      const ny = target.y + d.y;
      if (this.office.walkable[ny]?.[nx]) {
        const dist = Math.abs(nx - this.position.x) + Math.abs(ny - this.position.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = { x: nx, y: ny };
        }
      }
    }
    return best;
  }

  private randomWalkablePosition(): Position {
    const walkable: Position[] = [];
    for (let y = 0; y < this.office.height; y++) {
      for (let x = 0; x < this.office.width; x++) {
        if (this.office.walkable[y]?.[x]) {
          walkable.push({ x, y });
        }
      }
    }
    if (walkable.length === 0) return this.position;
    return walkable[Math.floor(Math.random() * walkable.length)];
  }

  /** Returns true if the agent is likely waiting for user input (idle 15s+ without sleeping/playing/eating). */
  get waitingForInput(): boolean {
    if (this.state !== CatState.Idle) return false;
    return Date.now() - this.lastActivityTime > 15000;
  }

  toData(): CatData {
    return {
      id: this.id,
      name: this.name,
      skin: this.skin,
      state: this.state,
      position: { ...this.position },
      direction: this.direction,
      targetPosition: this.targetPosition ? { ...this.targetPosition } : null,
      sessionId: this.sessionId,
      lastActivityTime: this.lastActivityTime,
      waitingForInput: this.waitingForInput,
    };
  }
}
