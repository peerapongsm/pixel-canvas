import { describe, expect, it } from "vitest";
import { apply, createEmptyGrid, indexOf, type Grid } from "@/lib/grid";
import { ERASER } from "@/lib/palette";
import { MAX_STROKES, pushStroke, recordPaint, undoOps, type Stroke } from "@/lib/undo";

const ME = "me-1";
const FRIEND = "fr-1";

function paint(grid: Grid, x: number, y: number, color: number, ts: number, peerId = ME): Grid {
  return apply(grid, { x, y, color, ts, peerId });
}

describe("recordPaint", () => {
  it("keeps only the first write per cell so prev stays the true pre-stroke value", () => {
    const stroke: Stroke = [];
    recordPaint(stroke, 1, 1, null, 3, 100);
    recordPaint(stroke, 1, 1, { color: 3, ts: 100, peerId: ME }, 5, 120);
    expect(stroke).toHaveLength(1);
    expect(stroke[0].prev).toBeNull();
    expect(stroke[0].applied).toEqual({ color: 3, ts: 100 });
  });
});

describe("pushStroke", () => {
  it("ignores empty strokes", () => {
    expect(pushStroke([], [])).toHaveLength(0);
  });

  it("caps the stack at MAX_STROKES, dropping the oldest", () => {
    let stack: Stroke[] = [];
    for (let i = 0; i < MAX_STROKES + 5; i++) {
      const stroke: Stroke = [];
      recordPaint(stroke, 0, 0, null, i, i);
      stack = pushStroke(stack, stroke);
    }
    expect(stack).toHaveLength(MAX_STROKES);
    expect(stack[0][0].applied.ts).toBe(5);
  });
});

describe("undoOps", () => {
  it("restores the previous color for cells still holding my stroke", () => {
    let grid = createEmptyGrid();
    grid = paint(grid, 2, 2, 7, 100, FRIEND);
    const prev = grid[indexOf(2, 2)];
    grid = paint(grid, 2, 2, 3, 200);
    const stroke: Stroke = [];
    recordPaint(stroke, 2, 2, prev, 3, 200);

    const ops = undoOps(grid, stroke, ME, 300);
    expect(ops).toEqual([{ x: 2, y: 2, color: 7, ts: 300, peerId: ME }]);
  });

  it("restores previously-empty cells as eraser tombstones", () => {
    let grid = createEmptyGrid();
    grid = paint(grid, 0, 0, 4, 100);
    const stroke: Stroke = [];
    recordPaint(stroke, 0, 0, null, 4, 100);

    const ops = undoOps(grid, stroke, ME, 200);
    expect(ops).toEqual([{ x: 0, y: 0, color: ERASER, ts: 200, peerId: ME }]);
  });

  it("skips pixels the friend has overwritten since", () => {
    let grid = createEmptyGrid();
    grid = paint(grid, 5, 5, 2, 100);
    const stroke: Stroke = [];
    recordPaint(stroke, 5, 5, null, 2, 100);
    grid = paint(grid, 5, 5, 9, 150, FRIEND);

    expect(undoOps(grid, stroke, ME, 200)).toHaveLength(0);
  });

  it("skips pixels I repainted in a later stroke", () => {
    let grid = createEmptyGrid();
    grid = paint(grid, 5, 5, 2, 100);
    const stroke: Stroke = [];
    recordPaint(stroke, 5, 5, null, 2, 100);
    grid = paint(grid, 5, 5, 6, 180);

    expect(undoOps(grid, stroke, ME, 200)).toHaveLength(0);
  });

  it("undoing an erase restores the erased color", () => {
    let grid = createEmptyGrid();
    grid = paint(grid, 3, 3, 8, 100);
    const prev = grid[indexOf(3, 3)];
    grid = paint(grid, 3, 3, ERASER, 200);
    const stroke: Stroke = [];
    recordPaint(stroke, 3, 3, prev, ERASER, 200);

    const ops = undoOps(grid, stroke, ME, 300);
    expect(ops).toEqual([{ x: 3, y: 3, color: 8, ts: 300, peerId: ME }]);
  });
});
