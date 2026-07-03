import { describe, expect, test } from "vitest";
import { isValidPixelMessage, isValidCursorMessage, filterValidCells } from "@/lib/validate";
import { createEmptyGrid, apply, type Grid } from "@/lib/grid";
import { PALETTE } from "@/lib/palette";

const NOW = 1_000_000;

describe("isValidPixelMessage", () => {
  test("accepts a well-formed pixel message", () => {
    expect(isValidPixelMessage({ x: 0, y: 63, color: 5, ts: NOW }, NOW)).toBe(true);
  });

  test("rejects non-integer x", () => {
    expect(isValidPixelMessage({ x: 1.5, y: 0, color: 0, ts: NOW }, NOW)).toBe(false);
  });

  test("rejects x out of range (negative)", () => {
    expect(isValidPixelMessage({ x: -1, y: 0, color: 0, ts: NOW }, NOW)).toBe(false);
  });

  test("rejects x out of range (>= 64)", () => {
    expect(isValidPixelMessage({ x: 64, y: 0, color: 0, ts: NOW }, NOW)).toBe(false);
  });

  test("rejects non-integer y", () => {
    expect(isValidPixelMessage({ x: 0, y: 2.2, color: 0, ts: NOW }, NOW)).toBe(false);
  });

  test("rejects y out of range", () => {
    expect(isValidPixelMessage({ x: 0, y: 64, color: 0, ts: NOW }, NOW)).toBe(false);
  });

  test("rejects non-integer color", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 1.1, ts: NOW }, NOW)).toBe(false);
  });

  test("accepts the eraser tombstone color (-1)", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: -1, ts: NOW }, NOW)).toBe(true);
  });

  test("rejects other negative colors", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: -2, ts: NOW }, NOW)).toBe(false);
  });

  test("rejects color >= palette length", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: PALETTE.length, ts: NOW }, NOW)).toBe(false);
  });

  test("accepts the last valid color index", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: PALETTE.length - 1, ts: NOW }, NOW)).toBe(true);
  });

  test("rejects Infinity ts", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 0, ts: Infinity }, NOW)).toBe(false);
  });

  test("rejects -Infinity ts", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 0, ts: -Infinity }, NOW)).toBe(false);
  });

  test("rejects NaN ts", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 0, ts: NaN }, NOW)).toBe(false);
  });

  test("rejects negative ts", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 0, ts: -1 }, NOW)).toBe(false);
  });

  test("accepts ts of 0", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 0, ts: 0 }, NOW)).toBe(true);
  });

  test("accepts ts exactly at the clock-skew boundary (now + 60_000)", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 0, ts: NOW + 60_000 }, NOW)).toBe(true);
  });

  test("rejects ts one past the clock-skew boundary", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 0, ts: NOW + 60_001 }, NOW)).toBe(false);
  });

  test("defaults now to current time when not injected", () => {
    expect(isValidPixelMessage({ x: 0, y: 0, color: 0, ts: Date.now() })).toBe(true);
  });
});

describe("isValidCursorMessage", () => {
  test("accepts well-formed coordinates", () => {
    expect(isValidCursorMessage({ x: 0, y: 0 })).toBe(true);
    expect(isValidCursorMessage({ x: 63, y: 63 })).toBe(true);
  });

  test("rejects non-integer coordinates", () => {
    expect(isValidCursorMessage({ x: 1.5, y: 0 })).toBe(false);
    expect(isValidCursorMessage({ x: 0, y: 1.5 })).toBe(false);
  });

  test("rejects out-of-range coordinates", () => {
    expect(isValidCursorMessage({ x: -1, y: 0 })).toBe(false);
    expect(isValidCursorMessage({ x: 0, y: 64 })).toBe(false);
  });
});

describe("filterValidCells", () => {
  function gridWith(entries: Array<[number, number, { color: number; ts: number; peerId: string }]>): Grid {
    let g = createEmptyGrid();
    for (const [x, y, cell] of entries) {
      g = apply(g, { x, y, ...cell });
    }
    return g;
  }

  test("keeps a grid of only valid cells untouched", () => {
    const g = gridWith([[1, 1, { color: 2, ts: NOW, peerId: "host" }]]);
    const filtered = filterValidCells(g, NOW);
    expect(filtered).toEqual(g);
  });

  test("drops a cell with an out-of-range color", () => {
    const g = createEmptyGrid();
    const bad = g.slice();
    bad[0] = { color: 999, ts: NOW, peerId: "host" };
    const filtered = filterValidCells(bad, NOW);
    expect(filtered[0]).toBeNull();
  });

  test("drops a cell with a poisoned Infinity ts", () => {
    const g = createEmptyGrid();
    const bad = g.slice();
    bad[0] = { color: 1, ts: Infinity, peerId: "host" };
    const filtered = filterValidCells(bad, NOW);
    expect(filtered[0]).toBeNull();
  });

  test("drops a cell with NaN ts, keeps sibling valid cells", () => {
    const g = createEmptyGrid();
    const bad = g.slice();
    bad[0] = { color: 1, ts: NaN, peerId: "host" };
    bad[1] = { color: 3, ts: NOW, peerId: "guest" };
    const filtered = filterValidCells(bad, NOW);
    expect(filtered[0]).toBeNull();
    expect(filtered[1]).toEqual({ color: 3, ts: NOW, peerId: "guest" });
  });

  test("drops a cell with ts beyond the clock-skew allowance", () => {
    const g = createEmptyGrid();
    const bad = g.slice();
    bad[0] = { color: 1, ts: NOW + 60_001, peerId: "host" };
    const filtered = filterValidCells(bad, NOW);
    expect(filtered[0]).toBeNull();
  });

  test("leaves nulls as nulls", () => {
    const g = createEmptyGrid();
    const filtered = filterValidCells(g, NOW);
    expect(filtered.every((c) => c === null)).toBe(true);
  });
});
