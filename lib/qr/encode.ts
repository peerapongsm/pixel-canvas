// Data encoding for QR codes (ISO/IEC 18004 §7.3-7.5): mode detection, version
// auto-fit, bit-stream assembly (mode indicator + character count + data + terminator
// + padding), and codeword block splitting/interleaving with Reed-Solomon EC codewords.
//
// Supports numeric, alphanumeric, and byte (UTF-8) modes, versions 1-10 only.
// Kanji mode is intentionally out of scope (see /method).
import { rsComputeRemainder } from "./rs";
import {
  ALPHANUMERIC_CHARSET,
  MODE_INDICATOR,
  charCountBits,
  totalDataCodewords,
  EC_TABLE,
  type ECLevel,
  type Mode,
} from "./tables";

export class BitBuffer {
  bits: number[] = [];

  pushBits(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }
}

const NUMERIC_RE = /^[0-9]*$/;
// Build an alphanumeric-mode charset test without a hand-built regex character class
// (avoids escaping pitfalls for "-" etc inside [...]): every char must be in the set.
const ALPHANUMERIC_SET = new Set(ALPHANUMERIC_CHARSET);
function isAlphanumericText(text: string): boolean {
  return text.length > 0 && [...text].every((ch) => ALPHANUMERIC_SET.has(ch));
}

/** Auto-detect the most compact mode that can represent the text losslessly. */
export function detectMode(text: string): Mode {
  if (text.length > 0 && NUMERIC_RE.test(text)) return "numeric";
  if (isAlphanumericText(text)) return "alphanumeric";
  return "byte";
}

/** UTF-8 byte length of a string (Thai and other multi-byte characters count as > 1 byte each). */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Character/byte count used in the character count indicator, per mode. */
export function contentCount(text: string, mode: Mode): number {
  return mode === "byte" ? utf8ByteLength(text) : text.length;
}

/** Number of bits the encoded data payload occupies, before mode/count/padding overhead. */
export function dataBitLength(text: string, mode: Mode): number {
  if (mode === "numeric") {
    const n = text.length;
    const groupsOf3 = Math.floor(n / 3);
    const remainder = n % 3;
    const remainderBits = remainder === 2 ? 7 : remainder === 1 ? 4 : 0;
    return groupsOf3 * 10 + remainderBits;
  }
  if (mode === "alphanumeric") {
    const n = text.length;
    const pairs = Math.floor(n / 2);
    const remainder = n % 2;
    return pairs * 11 + remainder * 6;
  }
  return utf8ByteLength(text) * 8;
}

/** Smallest version (1-10) whose capacity at `level` fits the text; throws if none fits. */
export function selectVersion(text: string, mode: Mode, level: ECLevel): number {
  for (let version = 1; version <= 10; version++) {
    const overhead = 4 + charCountBits(mode, version);
    const total = overhead + dataBitLength(text, mode);
    const capacityBits = totalDataCodewords(version, level) * 8;
    if (total <= capacityBits) return version;
  }
  throw new Error("ข้อความยาวเกินไปสำหรับ QR Code (รองรับ version 1-10 เท่านั้น)");
}

function encodeNumeric(text: string, buffer: BitBuffer): void {
  for (let i = 0; i < text.length; i += 3) {
    const group = text.slice(i, i + 3);
    const bits = group.length === 3 ? 10 : group.length === 2 ? 7 : 4;
    buffer.pushBits(parseInt(group, 10), bits);
  }
}

function encodeAlphanumeric(text: string, buffer: BitBuffer): void {
  for (let i = 0; i < text.length; i += 2) {
    const a = ALPHANUMERIC_CHARSET.indexOf(text[i]);
    if (i + 1 < text.length) {
      const b = ALPHANUMERIC_CHARSET.indexOf(text[i + 1]);
      buffer.pushBits(a * 45 + b, 11);
    } else {
      buffer.pushBits(a, 6);
    }
  }
}

function encodeByte(text: string, buffer: BitBuffer): void {
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) buffer.pushBits(byte, 8);
}

/** Build the full bit stream (mode + count + data + terminator + byte padding), NOT yet
 *  padded with 0xEC/0x11 filler codewords. */
export function buildDataBits(text: string, mode: Mode, version: number): BitBuffer {
  const buffer = new BitBuffer();
  buffer.pushBits(MODE_INDICATOR[mode], 4);
  buffer.pushBits(contentCount(text, mode), charCountBits(mode, version));
  if (mode === "numeric") encodeNumeric(text, buffer);
  else if (mode === "alphanumeric") encodeAlphanumeric(text, buffer);
  else encodeByte(text, buffer);
  return buffer;
}

/** Pad a bit buffer with the terminator, byte-boundary padding, and 0xEC/0x11 filler
 *  codewords up to the given data codeword capacity. Returns the codewords as bytes. */
export function padToCodewords(buffer: BitBuffer, capacityCodewords: number): number[] {
  const capacityBits = capacityCodewords * 8;
  const bits = buffer.bits.slice();

  // Terminator: up to 4 zero bits, but never more than remaining capacity.
  const terminatorLen = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);

  // Pad to a byte boundary.
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to codewords.
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  // Pad codewords, alternating 0xEC / 0x11, until capacity is reached.
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < capacityCodewords) {
    codewords.push(padBytes[padIndex % 2]);
    padIndex++;
  }

  return codewords;
}

export interface EncodedData {
  version: number;
  ecLevel: ECLevel;
  mode: Mode;
  dataCodewords: number[];
  finalCodewords: number[]; // interleaved data + EC codewords, ready for module placement
}

/** Split codewords into the version/level's block groups. */
function splitIntoBlocks(codewords: number[], version: number, level: ECLevel): number[][] {
  const info = EC_TABLE[version][level];
  const blocks: number[][] = [];
  let offset = 0;
  for (const group of info.groups) {
    for (let i = 0; i < group.count; i++) {
      blocks.push(codewords.slice(offset, offset + group.dataCodewords));
      offset += group.dataCodewords;
    }
  }
  return blocks;
}

/** Interleave data codewords across blocks, then EC codewords across blocks (ISO/IEC 18004 §7.6). */
function interleave(dataBlocks: number[][], ecBlocks: number[][]): number[] {
  const result: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  const ecLen = ecBlocks[0].length;
  for (let i = 0; i < ecLen; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }
  return result;
}

/** Full data encoding pipeline: mode -> version -> bitstream -> padded codewords ->
 *  block split -> Reed-Solomon -> interleave. */
export function encode(text: string, level: ECLevel, mode?: Mode): EncodedData {
  const chosenMode = mode ?? detectMode(text);
  const version = selectVersion(text, chosenMode, level);
  const buffer = buildDataBits(text, chosenMode, version);
  const capacity = totalDataCodewords(version, level);
  const dataCodewords = padToCodewords(buffer, capacity);

  const dataBlocks = splitIntoBlocks(dataCodewords, version, level);
  const ecInfo = EC_TABLE[version][level];
  const ecBlocks = dataBlocks.map((block) => rsComputeRemainder(block, ecInfo.ecCodewordsPerBlock));

  const finalCodewords = interleave(dataBlocks, ecBlocks);

  return { version, ecLevel: level, mode: chosenMode, dataCodewords, finalCodewords };
}
