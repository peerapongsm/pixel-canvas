// Per-module classification for the "anatomy" explorable UI section (hover/tap a QR
// module to see whether it's a finder pattern, timing pattern, etc). Built from the
// exact same geometry the matrix drawing code uses (shared position-list helpers,
// alignment coordinate table) so classification can never drift out of sync with what
// was actually drawn.
import { formatInfoPositions, versionInfoPositions } from "./matrix";
import { ALIGNMENT_COORDS, matrixSize, type ECLevel } from "./tables";

export type ModulePart =
  | "finder"
  | "separator"
  | "timing"
  | "alignment"
  | "format"
  | "version"
  | "dark"
  | "data";

export const PART_LABELS_TH: Record<ModulePart, string> = {
  finder: "จุดค้นหา (Finder Pattern)",
  separator: "แถบคั่น (Separator)",
  timing: "แถบจับจังหวะ (Timing Pattern)",
  alignment: "จุดปรับแนว (Alignment Pattern)",
  format: "ข้อมูลรูปแบบ (Format Info)",
  version: "ข้อมูลเวอร์ชัน (Version Info)",
  dark: "โมดูลมืดตายตัว (Fixed Dark Module)",
  data: "ข้อมูล + แก้ไขข้อผิดพลาด (Data / EC codewords)",
};

/** Build a `size x size` grid labelling every module's structural role. */
export function classifyGrid(version: number, ecLevel: ECLevel): ModulePart[][] {
  const size = matrixSize(version);
  const parts: ModulePart[][] = Array.from({ length: size }, () => new Array(size).fill("data"));

  // Finder patterns + their separators: reserve the 8x8 corner zone, then mark the
  // inner 7x7 as "finder" (the rest of the zone is the light separator border).
  const corners: [number, number][] = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  for (const [topRow, leftCol] of corners) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topRow + dr;
        const c = leftCol + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inCore = dr >= 0 && dr < 7 && dc >= 0 && dc < 7;
        parts[r][c] = inCore ? "finder" : "separator";
      }
    }
  }

  // Timing patterns.
  for (let i = 8; i <= size - 9; i++) {
    parts[6][i] = "timing";
    parts[i][6] = "timing";
  }

  // Alignment patterns.
  const coords = ALIGNMENT_COORDS[version];
  if (coords.length > 0) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    for (const row of coords) {
      for (const col of coords) {
        const overlapsFinder =
          (row === first && col === first) ||
          (row === first && col === last) ||
          (row === last && col === first);
        if (overlapsFinder) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            parts[row + dr][col + dc] = "alignment";
          }
        }
      }
    }
  }

  // Format info (both copies).
  for (const [pos1, pos2] of formatInfoPositions(size)) {
    parts[pos1[0]][pos1[1]] = "format";
    parts[pos2[0]][pos2[1]] = "format";
  }

  // Version info (versions 7+ only).
  if (version >= 7) {
    for (const [pos1, pos2] of versionInfoPositions(size)) {
      parts[pos1[0]][pos1[1]] = "version";
      parts[pos2[0]][pos2[1]] = "version";
    }
  }

  // Fixed dark module (overrides format, matching drawing order in matrix.ts).
  parts[size - 8][8] = "dark";

  return parts;
}
