import { OfficeLayout, FurnitureData, OFFICE_WIDTH, OFFICE_HEIGHT } from '@cat-office/shared';

// Floor tile IDs from the map — positions with these IDs are walkable
const FLOOR_TILE_IDS = new Set([73, 74, 75, 76, 77, 78, 79, 80]);

// Floor tile positions parsed from map.json Floor layer
const FLOOR_POSITIONS: Array<{ x: number; y: number }> = [
  // Office floor (id 73) — left side
  ...Array.from({ length: 11 }, (_, i) => Array.from({ length: 10 }, (_, j) => ({ x: i + 2, y: j + 2 }))).flat()
    .filter(p => p.y >= 2 && p.y <= 11 && p.x >= 2 && p.x <= 12),
  // Cat zone floor (ids 74-80) — right side
  ...Array.from({ length: 6 }, (_, i) => Array.from({ length: 10 }, (_, j) => ({ x: i + 13, y: j + 2 }))).flat()
    .filter(p => p.y >= 2 && p.y <= 11 && p.x >= 13 && p.x <= 18),
];

export function createDefaultOffice(): OfficeLayout {
  const width = OFFICE_WIDTH;  // 19
  const height = OFFICE_HEIGHT; // 12

  // Initialize walkable grid — all non-walkable by default
  const walkable: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    walkable[y] = [];
    for (let x = 0; x < width; x++) {
      walkable[y][x] = false;
    }
  }

  // Mark floor positions as walkable
  for (const pos of FLOOR_POSITIONS) {
    if (pos.y >= 0 && pos.y < height && pos.x >= 0 && pos.x < width) {
      walkable[pos.y][pos.x] = true;
    }
  }

  const furniture: FurnitureData[] = [
    // ── Desks (6) — 2×2 clusters from Computers/Office Furniture layers ──
    { id: 'desk-1', type: 'desk', position: { x: 2, y: 5 }, size: { width: 2, height: 2 } },
    { id: 'desk-2', type: 'desk', position: { x: 4, y: 5 }, size: { width: 2, height: 2 } },
    { id: 'desk-3', type: 'desk', position: { x: 6, y: 5 }, size: { width: 2, height: 2 } },
    { id: 'desk-4', type: 'desk', position: { x: 2, y: 9 }, size: { width: 2, height: 2 } },
    { id: 'desk-5', type: 'desk', position: { x: 4, y: 9 }, size: { width: 2, height: 2 } },
    { id: 'desk-6', type: 'desk', position: { x: 6, y: 9 }, size: { width: 2, height: 2 } },

    // ── Bookshelves — individual 1×1 along top wall (height 1 so y:3 stays walkable) ──
    { id: 'bookshelf-1', type: 'bookshelf', position: { x: 5, y: 2 }, size: { width: 1, height: 1 } },
    { id: 'bookshelf-2', type: 'bookshelf', position: { x: 7, y: 2 }, size: { width: 1, height: 1 } },
    { id: 'bookshelf-3', type: 'bookshelf', position: { x: 8, y: 2 }, size: { width: 1, height: 1 } },
    { id: 'bookshelf-4', type: 'bookshelf', position: { x: 9, y: 2 }, size: { width: 1, height: 1 } },
    { id: 'bookshelf-5', type: 'bookshelf', position: { x: 10, y: 2 }, size: { width: 1, height: 1 } },
    { id: 'bookshelf-6', type: 'bookshelf', position: { x: 12, y: 2 }, size: { width: 1, height: 1 } },

    // ── Filing shelf (left wall area) ──
    { id: 'filing-shelf-1', type: 'filing_shelf', position: { x: 2, y: 1 }, size: { width: 2, height: 2 } },

    // ── Cat beds (3) — 2×2 at bottom of cat zone ──
    { id: 'cat-bed-1', type: 'cat_bed', position: { x: 9, y: 10 }, size: { width: 2, height: 2 } },
    { id: 'cat-bed-2', type: 'cat_bed', position: { x: 11, y: 10 }, size: { width: 2, height: 2 } },
    { id: 'cat-bed-3', type: 'cat_bed', position: { x: 13, y: 10 }, size: { width: 2, height: 2 } },

    // ── Cat tree / play area (right side, x:15-18, y:2-4) ──
    { id: 'cat-tree-1', type: 'cat_tree', position: { x: 15, y: 2 }, size: { width: 4, height: 3 } },

    // ── Scratching post (right wall, x:18, y:5-7) ──
    { id: 'scratching-post-1', type: 'scratching_post', position: { x: 18, y: 5 }, size: { width: 1, height: 3 } },

    // ── Food bowls (right side of cat zone, next to wall) ──
    { id: 'food-bowl-1', type: 'food_bowl', position: { x: 17, y: 5 }, size: { width: 1, height: 1 } },
    { id: 'food-bowl-2', type: 'food_bowl', position: { x: 17, y: 7 }, size: { width: 1, height: 1 } },

    // ── Computer station (bottom-right) ──
    { id: 'monitor-1', type: 'monitor', position: { x: 17, y: 8 }, size: { width: 2, height: 4 } },

    // ── Door (y:0-1 area, x:5) ──
    { id: 'window-1', type: 'window', position: { x: 5, y: 0 }, size: { width: 1, height: 2 } },
  ];

  // Mark furniture tiles as non-walkable
  for (const f of furniture) {
    for (let dy = 0; dy < f.size.height; dy++) {
      for (let dx = 0; dx < f.size.width; dx++) {
        const fx = f.position.x + dx;
        const fy = f.position.y + dy;
        if (fy >= 0 && fy < height && fx >= 0 && fx < width) {
          walkable[fy][fx] = false;
        }
      }
    }
  }

  return { width, height, furniture, walkable };
}
