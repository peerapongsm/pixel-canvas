// Top-level QR code generation pipeline: encode text -> build function patterns ->
// place data -> try all 8 masks -> pick the lowest-penalty mask -> draw its format info.
import { encode } from "./encode";
import { buildFunctionGrid, placeData, drawFormatInfoFinal, type QRGrid } from "./matrix";
import { applyMask, MASK_COUNT } from "./mask";
import { computePenalty, type PenaltyBreakdown } from "./penalty";
import type { ECLevel, Mode } from "./tables";

export interface MaskScore {
  mask: number;
  penalty: PenaltyBreakdown;
}

export interface QRCodeResult {
  text: string;
  version: number;
  ecLevel: ECLevel;
  mode: Mode;
  mask: number;
  size: number;
  /** modules[row][col] = true means a dark (black) module. */
  modules: boolean[][];
  maskScores: MaskScore[];
  dataCodewords: number[];
  finalCodewords: number[];
}

export function codewordsToBits(codewords: number[]): number[] {
  const bits: number[] = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  return bits;
}

/** Generate a complete QR code for `text` at the given error-correction level. */
export function generateQR(text: string, ecLevel: ECLevel, mode?: Mode): QRCodeResult {
  const encoded = encode(text, ecLevel, mode);
  const bits = codewordsToBits(encoded.finalCodewords);

  const baseGrid = buildFunctionGrid(encoded.version, encoded.ecLevel);
  placeData(baseGrid, bits);

  const maskScores: MaskScore[] = [];
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestModules: boolean[][] | null = null;

  for (let maskId = 0; maskId < MASK_COUNT; maskId++) {
    const masked = applyMask(baseGrid.dark, baseGrid.isFunction, maskId);
    const scoredGrid: QRGrid = {
      size: baseGrid.size,
      dark: masked,
      isFunction: baseGrid.isFunction,
    };
    // Format info (which encodes the EC level + mask id) is drawn per-mask, not masked
    // itself, and its own bit pattern contributes to the penalty score.
    drawFormatInfoFinal(scoredGrid, encoded.ecLevel, maskId);
    const penalty = computePenalty(scoredGrid.dark);
    maskScores.push({ mask: maskId, penalty });
    if (penalty.total < bestPenalty) {
      bestPenalty = penalty.total;
      bestMask = maskId;
      bestModules = scoredGrid.dark;
    }
  }

  return {
    text,
    version: encoded.version,
    ecLevel: encoded.ecLevel,
    mode: encoded.mode,
    mask: bestMask,
    size: baseGrid.size,
    modules: bestModules!,
    maskScores,
    dataCodewords: encoded.dataCodewords,
    finalCodewords: encoded.finalCodewords,
  };
}

/** Build a QR code for a fixed, explicit mask (used by the "8 mask switcher" UI section,
 *  which needs to show every mask, not just the auto-selected best one). */
export function generateQRWithMask(text: string, ecLevel: ECLevel, maskId: number, mode?: Mode): QRCodeResult {
  const encoded = encode(text, ecLevel, mode);
  const bits = codewordsToBits(encoded.finalCodewords);

  const baseGrid = buildFunctionGrid(encoded.version, encoded.ecLevel);
  placeData(baseGrid, bits);

  const masked = applyMask(baseGrid.dark, baseGrid.isFunction, maskId);
  const scoredGrid: QRGrid = { size: baseGrid.size, dark: masked, isFunction: baseGrid.isFunction };
  drawFormatInfoFinal(scoredGrid, encoded.ecLevel, maskId);
  const penalty = computePenalty(scoredGrid.dark);

  return {
    text,
    version: encoded.version,
    ecLevel: encoded.ecLevel,
    mode: encoded.mode,
    mask: maskId,
    size: baseGrid.size,
    modules: scoredGrid.dark,
    maskScores: [{ mask: maskId, penalty }],
    dataCodewords: encoded.dataCodewords,
    finalCodewords: encoded.finalCodewords,
  };
}
