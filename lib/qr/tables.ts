// Fixed tables from ISO/IEC 18004, restricted to versions 1-10 (this project's supported
// range — see spec's "no kanji, versions 1-10" scope). Values reproduced from the
// standard's error-correction characteristics table (Annex, widely tabulated e.g. by
// thonky.com's "QR Code Tutorial"), cross-checked here so each row's
// (dataCodewords + ecCodewordsPerBlock) * blockCount sums to the version's total codeword
// count (see tables.test.ts).

export type ECLevel = "L" | "M" | "Q" | "H";
export type Mode = "numeric" | "alphanumeric" | "byte";

export interface BlockGroup {
  count: number;
  dataCodewords: number;
}

export interface VersionECInfo {
  ecCodewordsPerBlock: number;
  groups: BlockGroup[];
}

// EC_TABLE[version][level]
export const EC_TABLE: Record<number, Record<ECLevel, VersionECInfo>> = {
  1: {
    L: { ecCodewordsPerBlock: 7, groups: [{ count: 1, dataCodewords: 19 }] },
    M: { ecCodewordsPerBlock: 10, groups: [{ count: 1, dataCodewords: 16 }] },
    Q: { ecCodewordsPerBlock: 13, groups: [{ count: 1, dataCodewords: 13 }] },
    H: { ecCodewordsPerBlock: 17, groups: [{ count: 1, dataCodewords: 9 }] },
  },
  2: {
    L: { ecCodewordsPerBlock: 10, groups: [{ count: 1, dataCodewords: 34 }] },
    M: { ecCodewordsPerBlock: 16, groups: [{ count: 1, dataCodewords: 28 }] },
    Q: { ecCodewordsPerBlock: 22, groups: [{ count: 1, dataCodewords: 22 }] },
    H: { ecCodewordsPerBlock: 28, groups: [{ count: 1, dataCodewords: 16 }] },
  },
  3: {
    L: { ecCodewordsPerBlock: 15, groups: [{ count: 1, dataCodewords: 55 }] },
    M: { ecCodewordsPerBlock: 26, groups: [{ count: 1, dataCodewords: 44 }] },
    Q: { ecCodewordsPerBlock: 18, groups: [{ count: 2, dataCodewords: 17 }] },
    H: { ecCodewordsPerBlock: 22, groups: [{ count: 2, dataCodewords: 13 }] },
  },
  4: {
    L: { ecCodewordsPerBlock: 20, groups: [{ count: 1, dataCodewords: 80 }] },
    M: { ecCodewordsPerBlock: 18, groups: [{ count: 2, dataCodewords: 32 }] },
    Q: { ecCodewordsPerBlock: 26, groups: [{ count: 2, dataCodewords: 24 }] },
    H: { ecCodewordsPerBlock: 16, groups: [{ count: 4, dataCodewords: 9 }] },
  },
  5: {
    L: { ecCodewordsPerBlock: 26, groups: [{ count: 1, dataCodewords: 108 }] },
    M: { ecCodewordsPerBlock: 24, groups: [{ count: 2, dataCodewords: 43 }] },
    Q: {
      ecCodewordsPerBlock: 18,
      groups: [
        { count: 2, dataCodewords: 15 },
        { count: 2, dataCodewords: 16 },
      ],
    },
    H: {
      ecCodewordsPerBlock: 22,
      groups: [
        { count: 2, dataCodewords: 11 },
        { count: 2, dataCodewords: 12 },
      ],
    },
  },
  6: {
    L: { ecCodewordsPerBlock: 18, groups: [{ count: 2, dataCodewords: 68 }] },
    M: { ecCodewordsPerBlock: 16, groups: [{ count: 4, dataCodewords: 27 }] },
    Q: { ecCodewordsPerBlock: 24, groups: [{ count: 4, dataCodewords: 19 }] },
    H: { ecCodewordsPerBlock: 28, groups: [{ count: 4, dataCodewords: 15 }] },
  },
  7: {
    L: { ecCodewordsPerBlock: 20, groups: [{ count: 2, dataCodewords: 78 }] },
    M: { ecCodewordsPerBlock: 18, groups: [{ count: 4, dataCodewords: 31 }] },
    Q: {
      ecCodewordsPerBlock: 18,
      groups: [
        { count: 2, dataCodewords: 14 },
        { count: 4, dataCodewords: 15 },
      ],
    },
    H: {
      ecCodewordsPerBlock: 26,
      groups: [
        { count: 4, dataCodewords: 13 },
        { count: 1, dataCodewords: 14 },
      ],
    },
  },
  8: {
    L: { ecCodewordsPerBlock: 24, groups: [{ count: 2, dataCodewords: 97 }] },
    M: {
      ecCodewordsPerBlock: 22,
      groups: [
        { count: 2, dataCodewords: 38 },
        { count: 2, dataCodewords: 39 },
      ],
    },
    Q: {
      ecCodewordsPerBlock: 22,
      groups: [
        { count: 4, dataCodewords: 18 },
        { count: 2, dataCodewords: 19 },
      ],
    },
    H: {
      ecCodewordsPerBlock: 26,
      groups: [
        { count: 4, dataCodewords: 14 },
        { count: 2, dataCodewords: 15 },
      ],
    },
  },
  9: {
    L: { ecCodewordsPerBlock: 30, groups: [{ count: 2, dataCodewords: 116 }] },
    M: {
      ecCodewordsPerBlock: 22,
      groups: [
        { count: 3, dataCodewords: 36 },
        { count: 2, dataCodewords: 37 },
      ],
    },
    Q: {
      ecCodewordsPerBlock: 20,
      groups: [
        { count: 4, dataCodewords: 16 },
        { count: 4, dataCodewords: 17 },
      ],
    },
    H: {
      ecCodewordsPerBlock: 24,
      groups: [
        { count: 4, dataCodewords: 12 },
        { count: 4, dataCodewords: 13 },
      ],
    },
  },
  10: {
    L: {
      ecCodewordsPerBlock: 18,
      groups: [
        { count: 2, dataCodewords: 68 },
        { count: 2, dataCodewords: 69 },
      ],
    },
    M: {
      ecCodewordsPerBlock: 26,
      groups: [
        { count: 4, dataCodewords: 43 },
        { count: 1, dataCodewords: 44 },
      ],
    },
    Q: {
      ecCodewordsPerBlock: 24,
      groups: [
        { count: 6, dataCodewords: 19 },
        { count: 2, dataCodewords: 20 },
      ],
    },
    H: {
      ecCodewordsPerBlock: 28,
      groups: [
        { count: 6, dataCodewords: 15 },
        { count: 2, dataCodewords: 16 },
      ],
    },
  },
};

/** Total data codeword capacity (before EC) for a given version + EC level. */
export function totalDataCodewords(version: number, level: ECLevel): number {
  const info = EC_TABLE[version][level];
  return info.groups.reduce((sum, g) => sum + g.count * g.dataCodewords, 0);
}

// Module width/height for version V is 17 + 4*V, so V=1..10 -> 21..57 modules.
export function matrixSize(version: number): number {
  return 17 + 4 * version;
}

// Alignment pattern center coordinates (row == column candidates) per version.
// Version 1 has no alignment patterns.
export const ALIGNMENT_COORDS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// Number of "remainder bits" appended after all codewords when placing modules,
// so that the bitstream length matches the number of non-function modules exactly.
export const REMAINDER_BITS: Record<number, number> = {
  1: 0,
  2: 7,
  3: 7,
  4: 7,
  5: 7,
  6: 7,
  7: 0,
  8: 0,
  9: 0,
  10: 0,
};

// 45-character alphanumeric mode charset, index = encoded value.
export const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

export const MODE_INDICATOR: Record<Mode, number> = {
  numeric: 0b0001,
  alphanumeric: 0b0010,
  byte: 0b0100,
};

// Character count indicator bit width by mode and version range. This project only
// supports versions 1-10, i.e. the first two ranges of the standard's three.
export function charCountBits(mode: Mode, version: number): number {
  if (version >= 1 && version <= 9) {
    return { numeric: 10, alphanumeric: 9, byte: 8 }[mode];
  }
  // version 10 (this project's ceiling) falls in the 10-26 range.
  return { numeric: 12, alphanumeric: 11, byte: 16 }[mode];
}

// EC level indicator bits used in the 15-bit format information string (ISO/IEC 18004
// Table 12 / thonky.com "Format String" tutorial). Note M is 00, not L.
export const EC_LEVEL_BITS: Record<ECLevel, number> = {
  L: 0b01,
  M: 0b00,
  Q: 0b11,
  H: 0b10,
};
