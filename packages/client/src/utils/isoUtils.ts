import { TILE_SIZE, OFFICE_WIDTH, OFFICE_HEIGHT, CANVAS_SCALE } from '@cat-office/shared';

// Flat top-down grid constants
export const FLAT_ROOM_W = OFFICE_WIDTH * TILE_SIZE;   // 320
export const FLAT_ROOM_H = OFFICE_HEIGHT * TILE_SIZE;  // 224
export const FLAT_CANVAS_SCALE = CANVAS_SCALE;         // 3

// Keep these exports for backwards compat with imports
export const ISO_ROOM_W = FLAT_ROOM_W;
export const ISO_ROOM_H = FLAT_ROOM_H;
export const ISO_CANVAS_SCALE = FLAT_CANVAS_SCALE;
export const ISO_TILE_W = TILE_SIZE;

/** Project tile coordinates to flat screen coordinates. */
export function isoProject(tileX: number, tileY: number) {
  return {
    x: tileX * TILE_SIZE,
    y: tileY * TILE_SIZE,
  };
}

/** Depth for sorting (higher Y = further back rendered later). */
export function isoDepth(tileX: number, tileY: number): number {
  return tileY * OFFICE_WIDTH + tileX;
}
