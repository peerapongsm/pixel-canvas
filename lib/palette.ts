// 64-color palette. The first 16 entries are the original curated set and
// MUST keep their order/values: the palette index is the `color` value stored
// in Grid cells, saved to localStorage, and sent over the wire — reordering
// would recolor old saves. The 48 appended colors are hue ramps (dark→light)
// that stay coherent with the original set.
export const PALETTE: string[] = [
  // original 16 (frozen)
  "#1a1c2c", // ink
  "#5d275d", // plum
  "#b13e53", // brick
  "#ef7d57", // orange
  "#ffcd75", // sand
  "#a7f070", // lime
  "#38b764", // green
  "#257179", // teal
  "#29366f", // indigo
  "#3b5dc9", // blue
  "#41a6f6", // sky
  "#73eff7", // cyan
  "#f4f4f4", // white
  "#94b0c2", // fog
  "#566c86", // slate
  "#333c57", // dusk
  // browns / skin
  "#2e1a12",
  "#4d2b1a",
  "#7a4326",
  "#a86844",
  "#d19a6a",
  "#eec39a",
  // reds
  "#45101e",
  "#811d2e",
  "#b52547",
  "#e23d5b",
  "#f47c7c",
  "#ffb3a7",
  // oranges
  "#7a2d0c",
  "#b34a12",
  "#e06d1f",
  "#f59a34",
  "#ffc26e",
  "#ffe0a3",
  // yellows
  "#8a6d0b",
  "#c2a112",
  "#e8c520",
  "#f7e26b",
  "#fff3a3",
  "#fffbe0",
  // greens
  "#0d2b1e",
  "#14532d",
  "#1e7a3c",
  "#2fa84f",
  "#6bcf6b",
  "#b4e88a",
  // teals / cyans
  "#04303a",
  "#0b5563",
  "#12808c",
  "#1fb0b8",
  "#59d8d8",
  "#a8f0e8",
  // blues
  "#101a4a",
  "#1c2f7a",
  "#2a4bb8",
  "#3f74e8",
  "#6aa3f8",
  "#a8ccff",
  // purples / pinks
  "#2a1038",
  "#4d1a6b",
  "#7a2ba8",
  "#a84fd1",
  "#d17ce8",
  "#f0a8f0",
];

// Painting with this "color" erases the cell: a tombstone that participates
// in LWW like any paint, so erases sync between peers and beat older paints.
export const ERASER = -1;

export function isEraser(color: number): boolean {
  return color === ERASER;
}
