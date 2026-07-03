// 64x64 pixel grid with last-write-wins (LWW) conflict resolution.
// Each painted cell remembers who painted it and when, so two peers can
// paint concurrently and always converge on the same result.

export const GRID_SIZE = 64;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export interface Cell {
  color: number; // palette index, 0-15
  ts: number; // paint timestamp (ms)
  peerId: string;
}

export type Grid = (Cell | null)[];

export interface PixelInput {
  x: number;
  y: number;
  color: number;
  ts: number;
  peerId: string;
}

export function createEmptyGrid(): Grid {
  return new Array<Cell | null>(CELL_COUNT).fill(null);
}

export function indexOf(x: number, y: number): number {
  return y * GRID_SIZE + x;
}

export function inBounds(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

// Does `candidate` win over `current` under LWW rules?
// Higher ts wins; ties broken by lexicographically-greater peerId so both
// peers deterministically agree on the outcome without further coordination.
function wins(candidate: { ts: number; peerId: string }, current: Cell | null): boolean {
  if (current === null) return true;
  if (candidate.ts !== current.ts) return candidate.ts > current.ts;
  return candidate.peerId >= current.peerId;
}

export function apply(grid: Grid, pixel: PixelInput): Grid {
  if (!inBounds(pixel.x, pixel.y)) return grid;
  const i = indexOf(pixel.x, pixel.y);
  if (!wins(pixel, grid[i])) return grid;
  const next = grid.slice();
  next[i] = { color: pixel.color, ts: pixel.ts, peerId: pixel.peerId };
  return next;
}

export function merge(grid: Grid, other: Grid): Grid {
  const next = grid.slice();
  for (let i = 0; i < CELL_COUNT; i++) {
    const candidate = other[i];
    if (candidate !== null && wins(candidate, next[i])) {
      next[i] = candidate;
    }
  }
  return next;
}

// Sparse encoding: only painted cells take up space, so an empty or lightly
// painted 64x64 grid stays tiny instead of always paying for all 4096 cells.
type SerializedCell = [index: number, color: number, ts: number, peerId: string];

interface SerializedGrid {
  v: 1;
  cells: SerializedCell[];
}

export function serialize(grid: Grid): string {
  const cells: SerializedCell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const cell = grid[i];
    if (cell !== null) cells.push([i, cell.color, cell.ts, cell.peerId]);
  }
  const payload: SerializedGrid = { v: 1, cells };
  return JSON.stringify(payload);
}

export function deserialize(data: string): Grid {
  const payload = JSON.parse(data) as SerializedGrid;
  const grid = createEmptyGrid();
  for (const [i, color, ts, peerId] of payload.cells) {
    grid[i] = { color, ts, peerId };
  }
  return grid;
}
