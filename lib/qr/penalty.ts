// Mask penalty scoring (ISO/IEC 18004 §6.8.2, four rules). The mask that minimizes the
// total penalty is chosen, since low penalty correlates with a symbol that's easy for a
// camera/scanner to lock onto (few same-colour runs, few false finder-like patterns,
// balanced dark/light ratio).

const RUN_PENALTY_BASE = 3;
const BLOCK_PENALTY = 3;
const FINDER_LIKE_PENALTY = 40;
const BALANCE_PENALTY_UNIT = 10;

/** Rule 1: 5+ same-colour modules in a row/column. Penalty 3 + (run length - 5). */
function rule1(grid: boolean[][]): number {
  const size = grid.length;
  let penalty = 0;

  for (let r = 0; r < size; r++) {
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (grid[r][c] === grid[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += RUN_PENALTY_BASE + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += RUN_PENALTY_BASE + (runLen - 5);
  }

  for (let c = 0; c < size; c++) {
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (grid[r][c] === grid[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += RUN_PENALTY_BASE + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += RUN_PENALTY_BASE + (runLen - 5);
  }

  return penalty;
}

/** Rule 2: every 2x2 block of same-colour modules scores 3, including overlapping blocks. */
function rule2(grid: boolean[][]): number {
  const size = grid.length;
  let penalty = 0;
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (grid[r][c + 1] === v && grid[r + 1][c] === v && grid[r + 1][c + 1] === v) {
        penalty += BLOCK_PENALTY;
      }
    }
  }
  return penalty;
}

// The 1:1:3:1:1 finder-like ratio pattern, with 4 light modules of "quiet zone" on one
// side: dark,light,dark,dark,dark,light,dark,light,light,light,light (and its reverse).
const FINDER_PATTERN_A = [true, false, true, true, true, false, true, false, false, false, false];
const FINDER_PATTERN_B = FINDER_PATTERN_A.slice().reverse();

function matchesFinderPattern(line: boolean[], start: number): boolean {
  for (let i = 0; i < FINDER_PATTERN_A.length; i++) {
    if (line[start + i] !== FINDER_PATTERN_A[i]) return matchesFinderPatternB(line, start);
  }
  return true;
}

function matchesFinderPatternB(line: boolean[], start: number): boolean {
  for (let i = 0; i < FINDER_PATTERN_B.length; i++) {
    if (line[start + i] !== FINDER_PATTERN_B[i]) return false;
  }
  return true;
}

/** Rule 3: 1:1:3:1:1 finder-like patterns found in any row or column, 40 points each. */
function rule3(grid: boolean[][]): number {
  const size = grid.length;
  let penalty = 0;
  const windowLen = FINDER_PATTERN_A.length;

  for (let r = 0; r < size; r++) {
    const row = grid[r];
    for (let c = 0; c + windowLen <= size; c++) {
      if (matchesFinderPattern(row, c)) penalty += FINDER_LIKE_PENALTY;
    }
  }

  for (let c = 0; c < size; c++) {
    const col = grid.map((row) => row[c]);
    for (let r = 0; r + windowLen <= size; r++) {
      if (matchesFinderPattern(col, r)) penalty += FINDER_LIKE_PENALTY;
    }
  }

  return penalty;
}

/** Rule 4: penalize the dark-module ratio deviating from 50%, in steps of 5%. */
function rule4(grid: boolean[][]): number {
  const size = grid.length;
  const total = size * size;
  let dark = 0;
  for (const row of grid) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / total;
  const prevMultipleOf5 = Math.floor(percent / 5) * 5;
  const nextMultipleOf5 = prevMultipleOf5 + 5;
  const a = Math.abs(prevMultipleOf5 - 50) / 5;
  const b = Math.abs(nextMultipleOf5 - 50) / 5;
  return Math.min(a, b) * BALANCE_PENALTY_UNIT;
}

export interface PenaltyBreakdown {
  rule1: number;
  rule2: number;
  rule3: number;
  rule4: number;
  total: number;
}

export function computePenalty(grid: boolean[][]): PenaltyBreakdown {
  const rule1Score = rule1(grid);
  const rule2Score = rule2(grid);
  const rule3Score = rule3(grid);
  const rule4Score = rule4(grid);
  return {
    rule1: rule1Score,
    rule2: rule2Score,
    rule3: rule3Score,
    rule4: rule4Score,
    total: rule1Score + rule2Score + rule3Score + rule4Score,
  };
}
