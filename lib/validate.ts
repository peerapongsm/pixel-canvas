// Boundary validation for inbound peer messages. A peer is untrusted: it
// can send any JSON shape that satisfies proto.ts's type checks while still
// carrying out-of-range coordinates/colors or unbounded timestamps designed
// to always win LWW conflict resolution (see grid.ts `wins`). Every peer
// value must pass through here before it touches grid state.

import { GRID_SIZE, type Grid } from "@/lib/grid";
import { PALETTE } from "@/lib/palette";

const MAX_CLOCK_SKEW_MS = 60_000;

function isValidCoord(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < GRID_SIZE;
}

function isValidColor(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < PALETTE.length;
}

function isValidTs(ts: number, now: number): boolean {
  return Number.isFinite(ts) && ts >= 0 && ts <= now + MAX_CLOCK_SKEW_MS;
}

export function isValidPixelMessage(
  msg: { x: number; y: number; color: number; ts: number },
  now: number = Date.now()
): boolean {
  return isValidCoord(msg.x) && isValidCoord(msg.y) && isValidColor(msg.color) && isValidTs(msg.ts, now);
}

export function isValidCursorMessage(msg: { x: number; y: number }): boolean {
  return isValidCoord(msg.x) && isValidCoord(msg.y);
}

// Drops any fullSync cell that wouldn't pass isValidPixelMessage's color/ts
// rules, so a poisoned fullSync can't seed the grid with an unbeatable cell.
export function filterValidCells(grid: Grid, now: number = Date.now()): Grid {
  return grid.map((cell) => (cell !== null && isValidColor(cell.color) && isValidTs(cell.ts, now) ? cell : null));
}
