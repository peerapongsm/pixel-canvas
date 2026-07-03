// Converts a WebRTC SDP blob into a short-ish base64url "code" a human can
// copy-paste (LINE, etc). No compression library — SDP is full of repeated
// boilerplate tokens ("a=candidate:", "generation 0 network-cost 999", …)
// so a small static dictionary substitution shrinks it meaningfully before
// base64url encoding, entirely dependency-free.

// Longest/most distinctive tokens first isn't required for correctness here
// (none of these substrings overlap each other), but keeping them explicit
// and SDP-shaped makes the dictionary easy to audit.
const DICTIONARY: string[] = [
  "a=candidate:",
  "a=fingerprint:sha-256 ",
  "a=ice-ufrag:",
  "a=ice-pwd:",
  "a=ice-options:trickle",
  "a=rtcp-mux",
  "a=setup:actpass",
  "a=setup:active",
  "a=setup:passive",
  "a=group:BUNDLE ",
  "a=msid-semantic: WMS",
  "a=max-message-size:",
  "a=sctp-port:",
  "a=mid:",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 ",
  "o=- ",
  " IN IP4 127.0.0.1",
  " udp 2130706431 ",
  " udp 1694498815 ",
  " typ host generation 0 network-cost 999",
  " typ srflx raddr ",
  " rport ",
  " generation 0 network-cost 999",
  "\r\n",
];
// Reserve one sentinel char (0x01..0x1F) per dictionary entry. SDP text is
// printable ASCII/CRLF only, so these control-range chars never legitimately
// appear in it and are safe to use as stand-ins.
if (DICTIONARY.length > 31) throw new Error("codes.ts dictionary too large for sentinel range");

function compressTokens(text: string): string {
  let out = text;
  for (let i = 0; i < DICTIONARY.length; i++) {
    out = out.split(DICTIONARY[i]).join(String.fromCharCode(i + 1));
  }
  return out;
}

function expandTokens(text: string): string {
  let out = text;
  for (let i = 0; i < DICTIONARY.length; i++) {
    out = out.split(String.fromCharCode(i + 1)).join(DICTIONARY[i]);
  }
  return out;
}

const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function bytesToBase64Url(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result +=
      BASE64URL_CHARS[(n >> 18) & 63] +
      BASE64URL_CHARS[(n >> 12) & 63] +
      BASE64URL_CHARS[(n >> 6) & 63] +
      BASE64URL_CHARS[n & 63];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    result += BASE64URL_CHARS[(n >> 18) & 63] + BASE64URL_CHARS[(n >> 12) & 63];
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result += BASE64URL_CHARS[(n >> 18) & 63] + BASE64URL_CHARS[(n >> 12) & 63] + BASE64URL_CHARS[(n >> 6) & 63];
  }
  return result;
}

const BASE64URL_LOOKUP: Map<string, number> = new Map(
  BASE64URL_CHARS.split("").map((ch, i) => [ch, i] as const)
);

function base64UrlToBytes(code: string): Uint8Array {
  for (const ch of code) {
    if (!BASE64URL_LOOKUP.has(ch)) throw new Error(`invalid code: unexpected character "${ch}"`);
  }
  if (code.length % 4 === 1) throw new Error("invalid code: wrong length");

  const bytes: number[] = [];
  let i = 0;
  for (; i + 4 <= code.length; i += 4) {
    const n =
      (BASE64URL_LOOKUP.get(code[i])! << 18) |
      (BASE64URL_LOOKUP.get(code[i + 1])! << 12) |
      (BASE64URL_LOOKUP.get(code[i + 2])! << 6) |
      BASE64URL_LOOKUP.get(code[i + 3])!;
    bytes.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  const remaining = code.length - i;
  if (remaining === 2) {
    const n = (BASE64URL_LOOKUP.get(code[i])! << 18) | (BASE64URL_LOOKUP.get(code[i + 1])! << 12);
    bytes.push((n >> 16) & 255);
  } else if (remaining === 3) {
    const n =
      (BASE64URL_LOOKUP.get(code[i])! << 18) |
      (BASE64URL_LOOKUP.get(code[i + 1])! << 12) |
      (BASE64URL_LOOKUP.get(code[i + 2])! << 6);
    bytes.push((n >> 16) & 255, (n >> 8) & 255);
  }
  return new Uint8Array(bytes);
}

export function encodeSdpToCode(sdp: string): string {
  const compressed = compressTokens(sdp);
  const bytes = new TextEncoder().encode(compressed);
  return bytesToBase64Url(bytes);
}

export function decodeCodeToSdp(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length === 0) throw new Error("invalid code: empty");
  const bytes = base64UrlToBytes(trimmed);
  const compressed = new TextDecoder().decode(bytes);
  return expandTokens(compressed);
}

export type ValidateResult = { valid: true } | { valid: false; error: string };

function looksLikeSdp(text: string): boolean {
  return text.startsWith("v=0") && text.includes("m=");
}

export function validateCode(code: string): ValidateResult {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "โค้ดว่างเปล่า กรุณาวางโค้ดที่ได้รับมา" };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: "โค้ดมีอักขระที่ไม่ถูกต้อง ตรวจสอบว่าคัดลอกมาครบและไม่มีการแก้ไข" };
  }

  let sdp: string;
  try {
    sdp = decodeCodeToSdp(trimmed);
  } catch {
    return { valid: false, error: "โค้ดเสียหายหรือไม่สมบูรณ์ ลองคัดลอกใหม่อีกครั้ง" };
  }

  if (!looksLikeSdp(sdp)) {
    return { valid: false, error: "โค้ดนี้ไม่ใช่โค้ดเชื่อมต่อที่ถูกต้อง" };
  }

  return { valid: true };
}
