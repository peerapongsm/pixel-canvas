import { describe, expect, it } from "vitest";
import { PALETTE, ERASER, isEraser } from "@/lib/palette";

// The first 16 palette entries are a compatibility contract: palette indexes
// live in localStorage saves and on the wire, so these exact values in this
// exact order must never change.
const ORIGINAL_16 = [
  "#1a1c2c",
  "#5d275d",
  "#b13e53",
  "#ef7d57",
  "#ffcd75",
  "#a7f070",
  "#38b764",
  "#257179",
  "#29366f",
  "#3b5dc9",
  "#41a6f6",
  "#73eff7",
  "#f4f4f4",
  "#94b0c2",
  "#566c86",
  "#333c57",
];

describe("PALETTE", () => {
  it("keeps the original 16 colors frozen at indexes 0-15", () => {
    expect(PALETTE.slice(0, 16)).toEqual(ORIGINAL_16);
  });

  it("has exactly 64 colors", () => {
    expect(PALETTE).toHaveLength(64);
  });

  it("has no duplicates", () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });

  it("contains only lowercase #rrggbb values", () => {
    for (const color of PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("ERASER", () => {
  it("is -1 and never a valid palette index", () => {
    expect(ERASER).toBe(-1);
    expect(isEraser(ERASER)).toBe(true);
    expect(isEraser(0)).toBe(false);
  });
});
