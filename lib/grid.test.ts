import { describe, expect, test } from "vitest";
import {
  GRID_SIZE,
  CELL_COUNT,
  createEmptyGrid,
  indexOf,
  inBounds,
  apply,
  merge,
  serialize,
  deserialize,
} from "@/lib/grid";

describe("grid basics", () => {
  test("createEmptyGrid has CELL_COUNT nulls", () => {
    const g = createEmptyGrid();
    expect(g.length).toBe(CELL_COUNT);
    expect(g.every((c) => c === null)).toBe(true);
  });

  test("GRID_SIZE is 64", () => {
    expect(GRID_SIZE).toBe(64);
    expect(CELL_COUNT).toBe(64 * 64);
  });

  test("indexOf is row-major", () => {
    expect(indexOf(0, 0)).toBe(0);
    expect(indexOf(1, 0)).toBe(1);
    expect(indexOf(0, 1)).toBe(64);
    expect(indexOf(63, 63)).toBe(CELL_COUNT - 1);
  });

  test("inBounds", () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(63, 63)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(0, 64)).toBe(false);
    expect(inBounds(64, 0)).toBe(false);
  });
});

describe("apply (LWW)", () => {
  test("paints an empty cell", () => {
    const g = createEmptyGrid();
    const g2 = apply(g, { x: 1, y: 2, color: 5, ts: 100, peerId: "host" });
    expect(g2[indexOf(1, 2)]).toEqual({ color: 5, ts: 100, peerId: "host" });
    // original grid untouched (immutable)
    expect(g[indexOf(1, 2)]).toBeNull();
  });

  test("newer ts overwrites older", () => {
    let g = createEmptyGrid();
    g = apply(g, { x: 3, y: 3, color: 1, ts: 100, peerId: "host" });
    g = apply(g, { x: 3, y: 3, color: 9, ts: 200, peerId: "guest" });
    expect(g[indexOf(3, 3)]).toEqual({ color: 9, ts: 200, peerId: "guest" });
  });

  test("older ts does not overwrite newer", () => {
    let g = createEmptyGrid();
    g = apply(g, { x: 3, y: 3, color: 1, ts: 200, peerId: "host" });
    g = apply(g, { x: 3, y: 3, color: 9, ts: 100, peerId: "guest" });
    expect(g[indexOf(3, 3)]).toEqual({ color: 1, ts: 200, peerId: "host" });
  });

  test("equal ts: higher peerId (lexicographic) wins deterministically", () => {
    let g = createEmptyGrid();
    g = apply(g, { x: 0, y: 0, color: 1, ts: 100, peerId: "aaa" });
    g = apply(g, { x: 0, y: 0, color: 2, ts: 100, peerId: "bbb" });
    expect(g[indexOf(0, 0)]).toEqual({ color: 2, ts: 100, peerId: "bbb" });

    // order reversed: same outcome (bbb still wins because bbb > aaa)
    let g2 = createEmptyGrid();
    g2 = apply(g2, { x: 0, y: 0, color: 2, ts: 100, peerId: "bbb" });
    g2 = apply(g2, { x: 0, y: 0, color: 1, ts: 100, peerId: "aaa" });
    expect(g2[indexOf(0, 0)]).toEqual({ color: 2, ts: 100, peerId: "bbb" });
  });

  test("equal ts and equal peerId (duplicate/retry) is a no-op replace with same value", () => {
    let g = createEmptyGrid();
    g = apply(g, { x: 0, y: 0, color: 4, ts: 100, peerId: "host" });
    g = apply(g, { x: 0, y: 0, color: 4, ts: 100, peerId: "host" });
    expect(g[indexOf(0, 0)]).toEqual({ color: 4, ts: 100, peerId: "host" });
  });

  test("out-of-bounds pixel is ignored, grid unchanged", () => {
    const g = createEmptyGrid();
    const g2 = apply(g, { x: 64, y: 0, color: 1, ts: 100, peerId: "host" });
    expect(g2).toEqual(g);
  });
});

describe("merge", () => {
  test("merge is idempotent: merge(a, a) === a", () => {
    let a = createEmptyGrid();
    a = apply(a, { x: 1, y: 1, color: 3, ts: 50, peerId: "host" });
    const merged = merge(a, a);
    expect(merged).toEqual(a);
  });

  test("merge picks the LWW winner per cell, commutatively", () => {
    let a = createEmptyGrid();
    a = apply(a, { x: 0, y: 0, color: 1, ts: 100, peerId: "host" });
    let b = createEmptyGrid();
    b = apply(b, { x: 0, y: 0, color: 2, ts: 200, peerId: "guest" });

    const ab = merge(a, b);
    const ba = merge(b, a);
    expect(ab).toEqual(ba);
    expect(ab[indexOf(0, 0)]).toEqual({ color: 2, ts: 200, peerId: "guest" });
  });

  test("merge unions disjoint edits from both sides", () => {
    let a = createEmptyGrid();
    a = apply(a, { x: 0, y: 0, color: 1, ts: 100, peerId: "host" });
    let b = createEmptyGrid();
    b = apply(b, { x: 5, y: 5, color: 7, ts: 150, peerId: "guest" });

    const merged = merge(a, b);
    expect(merged[indexOf(0, 0)]).toEqual({ color: 1, ts: 100, peerId: "host" });
    expect(merged[indexOf(5, 5)]).toEqual({ color: 7, ts: 150, peerId: "guest" });
  });
});

describe("serialize / deserialize", () => {
  test("round-trips an empty grid", () => {
    const g = createEmptyGrid();
    const round = deserialize(serialize(g));
    expect(round).toEqual(g);
  });

  test("round-trips a grid with painted cells", () => {
    let g = createEmptyGrid();
    g = apply(g, { x: 0, y: 0, color: 0, ts: 1, peerId: "host" });
    g = apply(g, { x: 63, y: 63, color: 15, ts: 999999999, peerId: "guest-2" });
    g = apply(g, { x: 10, y: 20, color: 8, ts: 42, peerId: "host" });

    const round = deserialize(serialize(g));
    expect(round).toEqual(g);
  });

  test("serialize output is reasonably compact (not naive verbose JSON per cell)", () => {
    let g = createEmptyGrid();
    g = apply(g, { x: 0, y: 0, color: 0, ts: 1, peerId: "host" });
    const s = serialize(g);
    // a naive per-cell JSON array of 4096 entries would be tens of KB even mostly-empty;
    // a mostly-empty grid should serialize to a small string.
    expect(s.length).toBeLessThan(1000);
  });
});
