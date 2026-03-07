import type { Position } from '@cat-office/shared';

const DIRS: Position[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export function bfsPath(
  walkable: boolean[][],
  start: Position,
  end: Position,
): Position[] {
  const height = walkable.length;
  const width = walkable[0]?.length ?? 0;

  const key = (p: Position) => `${p.x},${p.y}`;

  // Clamp end to nearest walkable tile if it's not walkable
  let target = end;
  if (!walkable[end.y]?.[end.x]) {
    let best: Position | null = null;
    let bestDist = Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (walkable[y][x]) {
          const d = Math.abs(x - end.x) + Math.abs(y - end.y);
          if (d < bestDist) {
            bestDist = d;
            best = { x, y };
          }
        }
      }
    }
    if (best) target = best;
    else return [];
  }

  if (start.x === target.x && start.y === target.y) return [];

  const visited = new Set<string>();
  const prev = new Map<string, Position>();
  const queue: Position[] = [start];
  visited.add(key(start));

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === target.x && current.y === target.y) {
      // Reconstruct path
      const path: Position[] = [];
      let node: Position | undefined = current;
      while (node && !(node.x === start.x && node.y === start.y)) {
        path.unshift(node);
        node = prev.get(key(node));
      }
      return path;
    }

    for (const dir of DIRS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const nk = `${nx},${ny}`;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && walkable[ny][nx] && !visited.has(nk)) {
        visited.add(nk);
        prev.set(nk, current);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return []; // No path found
}
