// Reed-Solomon error correction codeword generation for QR codes (ISO/IEC 18004 Annex A).
//
// QR uses a Reed-Solomon code over GF(256). The error correction codewords for a
// block of data codewords are the remainder of dividing the data polynomial
// (message shifted up by the number of EC codewords) by a generator polynomial
// whose roots are consecutive powers of the primitive element: (x - a^0)(x - a^1)...(x - a^(n-1)).
// Since GF(256) has characteristic 2, subtraction is the same as addition (XOR).
import { EXP, gfMul } from "./gf";

/** Multiply two GF(256) polynomials, each given as coefficients highest-degree-first. */
export function polyMulGF(a: number[], b: number[]): number[] {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return result;
}

/** Build the Reed-Solomon generator polynomial of the given degree (= number of EC codewords). */
export function rsGeneratorPoly(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    g = polyMulGF(g, [1, EXP[i]]);
  }
  return g;
}

/**
 * Compute Reed-Solomon error correction codewords for a block of data codewords.
 * This performs polynomial long division of the data (as the high-order coefficients
 * of a polynomial padded with `ecLen` zero low-order coefficients) by the generator
 * polynomial, using the standard LFSR-style algorithm. The remainder is the EC codewords.
 */
export function rsComputeRemainder(data: number[], ecLen: number): number[] {
  const generator = rsGeneratorPoly(ecLen);
  const remainder = new Uint8Array(data.length + ecLen);
  remainder.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = remainder[i];
    if (coef !== 0) {
      for (let j = 0; j < generator.length; j++) {
        remainder[i + j] ^= gfMul(generator[j], coef);
      }
    }
  }
  return Array.from(remainder.slice(data.length));
}
