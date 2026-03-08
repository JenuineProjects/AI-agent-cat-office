import { EventEmitter } from 'node:events';
import {
  CatState,
  ServerMessage,
  ToolEvent,
  OfficeLayout,
  Position,
  IDLE_BEHAVIOR_INTERVAL,
} from '@cat-office/shared';
import { CatAgent } from './catAgent.js';
import { toolEventToAction } from './transcriptParser.js';
import { bfsPath } from './pathfinding.js';
import { detectRoleFromFile } from './roleDetector.js';

export interface CatManagerEvents {
  message: [msg: ServerMessage];
}

export class CatManager extends EventEmitter<CatManagerEvents> {
  private cats = new Map<string, CatAgent>();
  private sessionToCat = new Map<string, string>();
  private office: OfficeLayout;
  private agentNames: string[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private moveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(office: OfficeLayout) {
    super();
    this.office = office;
  }

  setAgentNames(names: string[]): void {
    this.agentNames = names;
  }

  start(): void {
    // Idle behavior tick
    this.tickInterval = setInterval(() => this.idleTick(), IDLE_BEHAVIOR_INTERVAL);
    // Movement tick (move cats along their paths)
    this.moveInterval = setInterval(() => this.moveTick(), 500);
  }

  stop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.moveInterval) clearInterval(this.moveInterval);
  }

  async handleToolEvent(event: ToolEvent): Promise<void> {
    let cat = this.getCatBySession(event.sessionId);

    if (!cat) {
      cat = await this.spawnCat(event.sessionId, event.filePath);
    }

    if (event.type === 'tool_use') {
      const action = toolEventToAction(event);
      if (action) {
        this.updateOccupiedTiles(cat);
        const changed = cat.handleEvent({ type: 'TOOL_USE', toolAction: action });
        if (changed) {
          this.computePath(cat);
          this.broadcastStateChange(cat);
        }
      }
    } else if (event.type === 'tool_result') {
      const changed = cat.handleEvent({ type: 'TOOL_RESULT' });
      if (changed) {
        this.broadcastStateChange(cat);
      }
    }
  }

  async handleSessionStart(sessionId: string, filePath?: string): Promise<void> {
    let cat = this.getCatBySession(sessionId);
    if (!cat) {
      await this.spawnCat(sessionId, filePath);
    } else {
      const changed = cat.handleEvent({ type: 'NEW_SESSION' });
      if (changed) this.broadcastStateChange(cat);
    }
  }

  getSnapshot(): ServerMessage {
    return {
      type: 'room:snapshot',
      cats: Array.from(this.cats.values()).map((c) => c.toData()),
      office: this.office,
    };
  }

  private async spawnCat(sessionId: string, filePath?: string): Promise<CatAgent> {
    const catIndex = this.cats.size;

    // Priority: 1) config page name, 2) auto-detected role, 3) default cat name
    let customName = this.agentNames[catIndex] || undefined;
    if (!customName && filePath) {
      const detected = await detectRoleFromFile(filePath);
      if (detected) {
        customName = detected;
        console.log(`[catManager] Auto-detected role: "${detected}" from transcript`);
      }
    }

    // Find desks and chairs
    const desks = this.office.furniture.filter((f) => f.type === 'desk');
    const chairs = this.office.furniture.filter((f) => f.type === 'chair');
    const assignedDeskIds = new Set(
      Array.from(this.cats.values())
        .map((c) => c.assignedFurniture.get('desk'))
        .filter(Boolean),
    );

    // Pick an unassigned desk (null if all taken)
    const availableDesk = desks.find((d) => !assignedDeskIds.has(d.id)) ?? null;

    // Find the matching chair (same index in layout order)
    const deskIdx = availableDesk ? desks.indexOf(availableDesk) : -1;
    const matchingChair = deskIdx >= 0 ? chairs[deskIdx] : null;

    // Collect all walkable tiles
    const walkableTiles: Position[] = [];
    for (let y = 0; y < this.office.height; y++) {
      for (let x = 0; x < this.office.width; x++) {
        if (this.office.walkable[y]?.[x]) walkableTiles.push({ x, y });
      }
    }

    // Tiles already occupied by other cats
    const occupiedSet = new Set(
      Array.from(this.cats.values()).map((c) => `${c.position.x},${c.position.y}`),
    );

    let spawnPos: Position | undefined;
    if (availableDesk) {
      // Spawn near assigned desk
      const candidates = [
        { x: availableDesk.position.x, y: availableDesk.position.y + 1 },
        { x: availableDesk.position.x, y: availableDesk.position.y - 1 },
        { x: availableDesk.position.x + 1, y: availableDesk.position.y },
        { x: availableDesk.position.x - 1, y: availableDesk.position.y },
        { x: availableDesk.position.x + 1, y: availableDesk.position.y + 1 },
        { x: availableDesk.position.x - 1, y: availableDesk.position.y + 1 },
      ];
      for (const c of candidates) {
        if (this.office.walkable[c.y]?.[c.x] && !occupiedSet.has(`${c.x},${c.y}`)) {
          spawnPos = c;
          break;
        }
      }
    }

    // No desk or no free tile near desk — pick a random unoccupied walkable tile
    if (!spawnPos) {
      const free = walkableTiles.filter((t) => !occupiedSet.has(`${t.x},${t.y}`));
      if (free.length > 0) {
        spawnPos = free[Math.floor(Math.random() * free.length)];
      }
    }

    const cat = new CatAgent(sessionId, this.office, catIndex, spawnPos, customName);

    // Pre-assign desk and chair so each cat goes to their own
    if (availableDesk) cat.assignedFurniture.set('desk', availableDesk.id);
    if (matchingChair) cat.assignedFurniture.set('chair', matchingChair.id);

    this.cats.set(cat.id, cat);
    this.sessionToCat.set(sessionId, cat.id);

    console.log(`[catManager] Spawned cat "${cat.name}" (${cat.skin}) for session ${sessionId.slice(0, 8)}...`);

    this.emit('message', { type: 'cat:spawn', cat: cat.toData() });
    return cat;
  }

  private getCatBySession(sessionId: string): CatAgent | undefined {
    const catId = this.sessionToCat.get(sessionId);
    return catId ? this.cats.get(catId) : undefined;
  }

  private computePath(cat: CatAgent): void {
    if (!cat.targetPosition) return;
    cat.path = bfsPath(this.office.walkable, cat.position, cat.targetPosition);
  }

  private moveTick(): void {
    for (const cat of this.cats.values()) {
      if (cat.state !== CatState.Walking) continue;
      if (cat.path.length === 0) {
        const preSnapPos = { ...cat.position };
        cat.arriveAtDestination();
        // Broadcast snap move if position changed (cat snapped onto furniture)
        if (cat.position.x !== preSnapPos.x || cat.position.y !== preSnapPos.y) {
          this.emit('message', {
            type: 'cat:move',
            catId: cat.id,
            position: cat.position,
            targetPosition: null,
          });
        }
        this.broadcastStateChange(cat);
        continue;
      }

      const next = cat.path.shift()!;
      // Update direction
      if (next.x > cat.position.x) cat.direction = 'right';
      else if (next.x < cat.position.x) cat.direction = 'left';
      else if (next.y > cat.position.y) cat.direction = 'down';
      else if (next.y < cat.position.y) cat.direction = 'up';

      cat.position = next;

      this.emit('message', {
        type: 'cat:move',
        catId: cat.id,
        position: cat.position,
        targetPosition: cat.targetPosition,
      });

      if (cat.path.length === 0) {
        const preSnapPos = { ...cat.position };
        cat.arriveAtDestination();
        if (cat.position.x !== preSnapPos.x || cat.position.y !== preSnapPos.y) {
          this.emit('message', {
            type: 'cat:move',
            catId: cat.id,
            position: cat.position,
            targetPosition: null,
          });
        }
        this.broadcastStateChange(cat);
      }
    }
  }

  /** Track previous waitingForInput state to detect changes */
  private prevWaitingState = new Map<string, boolean>();

  private idleTick(): void {
    for (const cat of this.cats.values()) {
      this.updateOccupiedTiles(cat);
      const changed = cat.handleEvent({ type: 'IDLE_TICK' });
      if (changed) {
        this.computePath(cat);
        this.broadcastStateChange(cat);
      }

      // Check if waitingForInput changed
      const prevWaiting = this.prevWaitingState.get(cat.id) ?? false;
      const nowWaiting = cat.waitingForInput;
      if (prevWaiting !== nowWaiting) {
        this.prevWaitingState.set(cat.id, nowWaiting);
        if (!changed) this.broadcastStateChange(cat); // broadcast if not already sent
      }
    }
  }

  private updateOccupiedTiles(cat: CatAgent): void {
    const occupied = new Set<string>();
    const furnitureByType = new Map<string, Set<string>>();
    for (const other of this.cats.values()) {
      if (other.id === cat.id) continue;
      occupied.add(`${other.position.x},${other.position.y}`);
      if (other.targetPosition) {
        occupied.add(`${other.targetPosition.x},${other.targetPosition.y}`);
      }
      // Track which furniture is currently in use by other cats
      for (const [type, furnitureId] of other.assignedFurniture) {
        // Only count as occupied if the cat is actively using it (not idle/walking)
        if (other.state !== CatState.Idle && other.state !== CatState.Walking) {
          if (!furnitureByType.has(type)) furnitureByType.set(type, new Set());
          furnitureByType.get(type)!.add(furnitureId);
        }
      }
    }
    cat.occupiedTiles = occupied;
    cat.occupiedFurniture = furnitureByType;
  }

  private broadcastStateChange(cat: CatAgent): void {
    this.emit('message', {
      type: 'cat:stateChange',
      catId: cat.id,
      state: cat.state,
      direction: cat.direction,
      waitingForInput: cat.waitingForInput,
    });
  }
}
