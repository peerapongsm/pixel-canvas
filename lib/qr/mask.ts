// The 8 QR data-masking patterns (ISO/IEC 18004 Table 10 / §6.8.1). Masking XORs a
// deterministic pattern over the data (non-function) modules only, so that the final
// symbol avoids large blocks of same-colour modules that would confuse a scanner.
export const MASK_COUNT = 8;

export type MaskFn = (row: number, col: number) => boolean;

export const MASK_FUNCTIONS: MaskFn[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Apply mask `maskId`, flipping every non-function module where the mask condition is true. */
export function applyMask(
  dark: boolean[][],
  isFunction: boolean[][],
  maskId: number,
): boolean[][] {
  const fn = MASK_FUNCTIONS[maskId];
  const size = dark.length;
  const result = dark.map((row) => row.slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFunction[r][c]) continue;
      if (fn(r, c)) result[r][c] = !result[r][c];
    }
  }
  return result;
}
