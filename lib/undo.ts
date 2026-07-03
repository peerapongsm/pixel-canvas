// Local, stroke-based, conflict-safe undo.
//
// LWW has no way to "unwin" a write, so undo is expressed as NEW paint ops
// with a fresh timestamp: painting the previous color back, or an eraser
// tombstone if the cell was previously empty. Those ops flow through the
// normal apply/send path, so an undo propagates to the peer with zero
// protocol changes.
//
// Conflict safety: a pixel is only reverted if the grid still shows exactly
// the value this stroke wrote (same ts/color and painted by me). If the
// friend overpainted it since, the undo skips that pixel rather than
// clobbering their newer work.

import { ERASER } from "@/lib/palette";
import { indexOf, type Cell, type Grid, type PixelInput } from "@/lib/grid";

export interface StrokeCell {
  x: number;
  y: number;
  /** cell value before this stroke touched it */
  prev: Cell | null;
  /** what this stroke wrote (mine, so peerId is implied) */
  applied: { color: number; ts: number };
}

export type Stroke = StrokeCell[];

export const MAX_STROKES = 100;

/** Record a paint into the in-progress stroke; only the first write per cell keeps its `prev`. */
export function recordPaint(stroke: Stroke, x: number, y: number, prev: Cell | null, color: number, ts: number): void {
  if (stroke.some((c) => c.x === x && c.y === y)) return;
  stroke.push({ x, y, prev, applied: { color, ts } });
}

/** Push a finished stroke onto the stack, dropping the oldest past MAX_STROKES. */
export function pushStroke(stack: Stroke[], stroke: Stroke): Stroke[] {
  if (stroke.length === 0) return stack;
  const next = [...stack, stroke];
  return next.length > MAX_STROKES ? next.slice(next.length - MAX_STROKES) : next;
}

/**
 * Compute the paint ops that revert `stroke`, skipping pixels the peer has
 * overwritten since. Does not mutate anything; caller applies + sends each op.
 */
export function undoOps(grid: Grid, stroke: Stroke, myPeerId: string, now: number): PixelInput[] {
  const ops: PixelInput[] = [];
  for (const { x, y, prev, applied } of stroke) {
    const current = grid[indexOf(x, y)];
    const stillMine =
      current !== null && current.peerId === myPeerId && current.ts === applied.ts && current.color === applied.color;
    if (!stillMine) continue;
    const color = prev === null ? ERASER : prev.color;
    ops.push({ x, y, color, ts: now, peerId: myPeerId });
  }
  return ops;
}
