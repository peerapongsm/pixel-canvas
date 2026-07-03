// QR module matrix construction (ISO/IEC 18004 §6.3-6.8): finder patterns + separators,
// timing patterns, alignment patterns, the fixed dark module, format/version info areas,
// and zigzag codeword placement.
import { ALIGNMENT_COORDS, EC_LEVEL_BITS, matrixSize, type ECLevel } from "./tables";

export interface QRGrid {
  size: number;
  /** dark[row][col] = true means a dark (black) module. */
  dark: boolean[][];
  /** isFunction[row][col] = true means this module is part of a fixed/function
   *  pattern (finder, separator, timing, alignment, format, version, dark module)
   *  and must never be touched by data placement or masking. */
  isFunction: boolean[][];
}

function makeGrid(size: number): QRGrid {
  return {
    size,
    dark: Array.from({ length: size }, () => new Array(size).fill(false)),
    isFunction: Array.from({ length: size }, () => new Array(size).fill(false)),
  };
}

function set(grid: QRGrid, row: number, col: number, value: boolean): void {
  grid.dark[row][col] = value;
  grid.isFunction[row][col] = true;
}

function drawFinderPattern(grid: QRGrid, topRow: number, leftCol: number): void {
  // Reserve the full 8x8 corner zone (finder + separator) as light, function modules.
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = topRow + dr;
      const c = leftCol + dc;
      if (r < 0 || r >= grid.size || c < 0 || c >= grid.size) continue;
      set(grid, r, c, false);
    }
  }
  // Draw the 7x7 finder pattern itself: dark border (dist 3), light ring (dist 2),
  // dark 3x3 core (dist <= 1), measured in Chebyshev distance from the 7x7 center.
  for (let dr = 0; dr < 7; dr++) {
    for (let dc = 0; dc < 7; dc++) {
      const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
      const dark = dist !== 2;
      set(grid, topRow + dr, leftCol + dc, dark);
    }
  }
}

function drawAlignmentPattern(grid: QRGrid, centerRow: number, centerCol: number): void {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const dist = Math.max(Math.abs(dr), Math.abs(dc));
      const dark = dist !== 1;
      set(grid, centerRow + dr, centerCol + dc, dark);
    }
  }
}

function drawTimingPatterns(grid: QRGrid): void {
  const size = grid.size;
  for (let i = 8; i <= size - 9; i++) {
    const dark = i % 2 === 0;
    if (!grid.isFunction[6][i]) set(grid, 6, i, dark);
    if (!grid.isFunction[i][6]) set(grid, i, 6, dark);
  }
}

function drawAlignmentPatterns(grid: QRGrid, version: number): void {
  const coords = ALIGNMENT_COORDS[version];
  if (coords.length === 0) return;
  const first = coords[0];
  const last = coords[coords.length - 1];
  for (const row of coords) {
    for (const col of coords) {
      // Skip the three positions that would overlap a finder pattern's corner zone.
      const overlapsFinder =
        (row === first && col === first) ||
        (row === first && col === last) ||
        (row === last && col === first);
      if (overlapsFinder) continue;
      drawAlignmentPattern(grid, row, col);
    }
  }
}

/** Bits 0 (MSB) .. 14 (LSB) of a 15-bit format info string, per ISO/IEC 18004 §6.9. */
export function formatInfoBits(ecLevel: ECLevel, maskId: number): number[] {
  const data = (EC_LEVEL_BITS[ecLevel] << 3) | maskId; // 5 bits
  const generator = 0b10100110111; // 0x537, BCH(15,5) generator, degree 10
  let value = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((value >> (i + 10)) & 1) value ^= generator << i;
  }
  const rawFormat = (data << 10) | value; // 15 bits: 5 data + 10 BCH remainder
  const masked = rawFormat ^ 0b101010000010010; // fixed mask, ISO/IEC 18004 §6.9
  const bits: number[] = [];
  for (let i = 14; i >= 0; i--) bits.push((masked >> i) & 1);
  return bits;
}

/** For each of the 15 format-info bits (index 0 = MSB .. 14 = LSB), the (row, col) of
 *  its two on-grid copies: [firstCopyPosition, secondCopyPosition]. Shared by drawing
 *  and by the UI's module classifier so both stay in exact agreement about which cells
 *  are "format info". */
export function formatInfoPositions(size: number): [number, number][][] {
  const firstCopy: [number, number][] = [];
  for (let i = 0; i <= 5; i++) firstCopy.push([8, i]);
  firstCopy.push([8, 7]);
  firstCopy.push([8, 8]);
  firstCopy.push([7, 8]);
  for (let i = 9; i <= 14; i++) firstCopy.push([14 - i, 8]);

  const secondCopy: [number, number][] = [];
  for (let i = 0; i <= 6; i++) secondCopy.push([size - 1 - i, 8]);
  for (let i = 7; i <= 14; i++) secondCopy.push([8, size - 15 + i]);

  return firstCopy.map((pos, i) => [pos, secondCopy[i]]);
}

function drawFormatInfo(grid: QRGrid, ecLevel: ECLevel, maskId: number): void {
  const bits = formatInfoBits(ecLevel, maskId);
  const positions = formatInfoPositions(grid.size);
  for (let i = 0; i < 15; i++) {
    const bit = bits[i] === 1;
    for (const [row, col] of positions[i]) set(grid, row, col, bit);
  }
}

/** Bits 0 (MSB) .. 17 (LSB) of an 18-bit version info string (versions 7+ only). */
export function versionInfoBits(version: number): number[] {
  const generator = 0b1111100100101; // 0x1F25, BCH(18,6) generator, degree 12
  let value = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((value >> (i + 12)) & 1) value ^= generator << i;
  }
  const raw = (version << 12) | value; // 18 bits: 6 data + 12 BCH remainder
  const bits: number[] = [];
  for (let i = 17; i >= 0; i--) bits.push((raw >> i) & 1);
  return bits;
}

/** For each of the 18 version-info bit slots (i=0 is LSB), the mirrored pair of
 *  (row, col) positions that both receive that same bit. Shared with the classifier. */
export function versionInfoPositions(size: number): [number, number][][] {
  const result: [number, number][][] = [];
  for (let i = 0; i < 18; i++) {
    const a = size - 11 + (i % 3);
    const bRow = Math.floor(i / 3);
    result.push([
      [a, bRow],
      [bRow, a],
    ]);
  }
  return result;
}

function drawVersionInfo(grid: QRGrid, version: number): void {
  if (version < 7) return;
  const bits = versionInfoBits(version);
  const positions = versionInfoPositions(grid.size);
  for (let i = 0; i < 18; i++) {
    const bit = bits[17 - i] === 1; // bit(i): i=0 is LSB here to match the a/b loop above
    for (const [row, col] of positions[i]) set(grid, row, col, bit);
  }
}

/** Build the base grid with all function patterns placed, format info reserved as
 *  placeholders (mask 0, overwritten later once the real mask is chosen), and the
 *  fixed dark module set. Does not place data yet. */
export function buildFunctionGrid(version: number, ecLevel: ECLevel): QRGrid {
  const size = matrixSize(version);
  const grid = makeGrid(size);

  drawFinderPattern(grid, 0, 0);
  drawFinderPattern(grid, 0, size - 7);
  drawFinderPattern(grid, size - 7, 0);

  drawTimingPatterns(grid);
  drawAlignmentPatterns(grid, version);

  // Reserve format info areas with placeholder bits (real bits drawn after mask choice).
  drawFormatInfo(grid, ecLevel, 0);
  drawVersionInfo(grid, version);

  // Fixed dark module.
  set(grid, size - 8, 8, true);

  return grid;
}

/** Zigzag-place data bits (MSB-first codeword stream) into all non-function modules,
 *  per ISO/IEC 18004 §6.7.3. Any positions beyond the bitstream (remainder bits) are
 *  filled with light (0) modules. */
export function placeData(grid: QRGrid, bits: number[]): void {
  const size = grid.size;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert;
      for (const colOffset of [0, 1]) {
        const col = right - colOffset;
        if (grid.isFunction[row][col]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        grid.dark[row][col] = bit;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

export function drawFormatInfoFinal(grid: QRGrid, ecLevel: ECLevel, maskId: number): void {
  drawFormatInfo(grid, ecLevel, maskId);
}
