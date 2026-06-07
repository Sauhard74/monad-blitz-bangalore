import type { Direction } from '@/game/office/atlas';

export interface TileXY {
  x: number;
  y: number;
}

export interface Step extends TileXY {
  dir: Direction | null;
}

/**
 * Pure pathing helper: one tile step from `from` toward `to`. Moves on X first,
 * then Y (simple Manhattan stepping — the open-plan office has no obstacles).
 * Returns the next tile plus the facing direction, or `dir: null` if arrived.
 */
export function nextStepToward(from: TileXY, to: TileXY): Step {
  if (from.x < to.x) return { x: from.x + 1, y: from.y, dir: 'right' };
  if (from.x > to.x) return { x: from.x - 1, y: from.y, dir: 'left' };
  if (from.y < to.y) return { x: from.x, y: from.y + 1, dir: 'down' };
  if (from.y > to.y) return { x: from.x, y: from.y - 1, dir: 'up' };
  return { x: from.x, y: from.y, dir: null };
}

/** Full tile path from `from` to `to` (exclusive of the start tile). */
export function pathBetween(from: TileXY, to: TileXY): Step[] {
  const path: Step[] = [];
  let cur: TileXY = { x: from.x, y: from.y };
  // Bound the loop defensively so a bad target can never spin forever.
  for (let guard = 0; guard < 256; guard++) {
    const step = nextStepToward(cur, to);
    if (step.dir === null) break;
    path.push(step);
    cur = { x: step.x, y: step.y };
  }
  return path;
}
