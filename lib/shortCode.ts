// Short connection codes: instead of dictionary-compressing the whole SDP
// (lib/codes.ts, now the legacy format), extract only the fields that
// actually vary between sessions — ICE ufrag/pwd, the DTLS fingerprint, and
// the candidate list — pack them into bytes, and rebuild the rest of the SDP
// from a fixed template on decode. Cuts a code from ~400-700 chars down to
// ~100-160.
//
// Codes carry a "P2." prefix so decoders can tell them apart from legacy
// codes; decodeAnyCodeToSdp falls back to the legacy decoder for codes
// without the prefix, so old codes keep working.

import { decodeCodeToSdp as decodeLegacy, encodeSdpToCode as encodeLegacy } from "@/lib/codes";

export const SHORT_CODE_PREFIX = "P2.";

type Kind = "offer" | "answer";

// candidate tag byte: what kind of address follows
const TAG_HOST_V4 = 0; // 4 bytes
const TAG_HOST_V6 = 1; // 16 bytes
const TAG_HOST_MDNS = 2; // 16 bytes (uuid)
const TAG_SRFLX_V4 = 3; // 4 bytes
const TAG_SRFLX_V6 = 4; // 16 bytes

interface Candidate {
  tag: number;
  addr: Uint8Array; // 4 or 16 bytes
  port: number;
}

interface ParsedSdp {
  kind: Kind;
  ufrag: string;
  pwd: string;
  fingerprint: Uint8Array; // 32 bytes (sha-256)
  candidates: Candidate[];
}

// --- parsing helpers ---

function parseIPv4(text: string): Uint8Array | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    if (!/^\d{1,3}$/.test(parts[i])) return null;
    const n = Number(parts[i]);
    if (n > 255) return null;
    bytes[i] = n;
  }
  return bytes;
}

function parseIPv6(text: string): Uint8Array | null {
  // strip zone index (fe80::1%eth0)
  const clean = text.split("%")[0];
  if (!clean.includes(":")) return null;
  const halves = clean.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] === "" ? [] : halves[0].split(":");
  const tail = halves.length === 2 ? (halves[1] === "" ? [] : halves[1].split(":")) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 0 : missing !== 0) return null;
  const groups = [...head, ...new Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(groups[i])) return null;
    const n = parseInt(groups[i], 16);
    bytes[i * 2] = n >> 8;
    bytes[i * 2 + 1] = n & 255;
  }
  return bytes;
}

function formatIPv6(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
  }
  return groups.join(":");
}

const MDNS_RE = /^([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{12})\.local$/;

function parseMdns(text: string): Uint8Array | null {
  const m = MDNS_RE.exec(text);
  if (!m) return null;
  const hex = m.slice(1).join("");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function formatMdns(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}.local`;
}

function parseCandidateLine(line: string): Candidate | null {
  // a=candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> ...
  const parts = line.slice("a=candidate:".length).split(" ");
  if (parts.length < 8) return null;
  const [, component, transport, , address, portText, typLabel, typ] = parts;
  if (component !== "1" || transport.toLowerCase() !== "udp" || typLabel !== "typ") return null;
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 0 || port > 65535) return null;

  if (typ === "host") {
    const mdns = parseMdns(address);
    if (mdns) return { tag: TAG_HOST_MDNS, addr: mdns, port };
    const v4 = parseIPv4(address);
    if (v4) return { tag: TAG_HOST_V4, addr: v4, port };
    const v6 = parseIPv6(address);
    if (v6) return { tag: TAG_HOST_V6, addr: v6, port };
    return null;
  }
  if (typ === "srflx") {
    const v4 = parseIPv4(address);
    if (v4) return { tag: TAG_SRFLX_V4, addr: v4, port };
    const v6 = parseIPv6(address);
    if (v6) return { tag: TAG_SRFLX_V6, addr: v6, port };
    return null;
  }
  // relay/tcp/unknown types are dropped; remaining candidates still connect
  return null;
}

function parseSdp(sdp: string): ParsedSdp | null {
  const lines = sdp.split(/\r?\n/);
  let ufrag = "";
  let pwd = "";
  let fingerprint: Uint8Array | null = null;
  let kind: Kind | null = null;
  const candidates: Candidate[] = [];

  for (const line of lines) {
    if (line.startsWith("a=ice-ufrag:")) ufrag = line.slice("a=ice-ufrag:".length).trim();
    else if (line.startsWith("a=ice-pwd:")) pwd = line.slice("a=ice-pwd:".length).trim();
    else if (line.startsWith("a=fingerprint:sha-256 ")) {
      const hex = line.slice("a=fingerprint:sha-256 ".length).trim().split(":");
      if (hex.length !== 32 || hex.some((h) => !/^[0-9a-fA-F]{2}$/.test(h))) return null;
      fingerprint = new Uint8Array(hex.map((h) => parseInt(h, 16)));
    } else if (line.startsWith("a=setup:")) {
      const setup = line.slice("a=setup:".length).trim();
      kind = setup === "actpass" ? "offer" : "answer";
    } else if (line.startsWith("a=candidate:")) {
      const candidate = parseCandidateLine(line);
      if (candidate) candidates.push(candidate);
    }
  }

  if (!ufrag || !pwd || !fingerprint || !kind || candidates.length === 0) return null;
  if (ufrag.length > 255 || pwd.length > 255) return null;
  // ufrag/pwd are ice-chars (ASCII); anything else won't survive byte packing
  if (!/^[\x21-\x7e]+$/.test(ufrag) || !/^[\x21-\x7e]+$/.test(pwd)) return null;
  return { kind, ufrag, pwd, fingerprint, candidates };
}

// --- byte packing ---

const VERSION = 1;

function pack(parsed: ParsedSdp): Uint8Array {
  const bytes: number[] = [];
  bytes.push((VERSION << 4) | (parsed.kind === "answer" ? 1 : 0));
  bytes.push(parsed.ufrag.length);
  for (const ch of parsed.ufrag) bytes.push(ch.charCodeAt(0));
  bytes.push(parsed.pwd.length);
  for (const ch of parsed.pwd) bytes.push(ch.charCodeAt(0));
  bytes.push(...parsed.fingerprint);
  bytes.push(parsed.candidates.length);
  for (const c of parsed.candidates) {
    bytes.push(c.tag, ...c.addr, c.port >> 8, c.port & 255);
  }
  return new Uint8Array(bytes);
}

class ByteReader {
  private i = 0;
  constructor(private bytes: Uint8Array) {}
  u8(): number {
    if (this.i >= this.bytes.length) throw new Error("short code truncated");
    return this.bytes[this.i++];
  }
  take(n: number): Uint8Array {
    if (this.i + n > this.bytes.length) throw new Error("short code truncated");
    const out = this.bytes.slice(this.i, this.i + n);
    this.i += n;
    return out;
  }
  ascii(n: number): string {
    return String.fromCharCode(...this.take(n));
  }
  get done(): boolean {
    return this.i === this.bytes.length;
  }
}

function unpack(bytes: Uint8Array): ParsedSdp {
  const r = new ByteReader(bytes);
  const head = r.u8();
  if (head >> 4 !== VERSION) throw new Error("unsupported short code version");
  const kind: Kind = (head & 1) === 1 ? "answer" : "offer";
  const ufrag = r.ascii(r.u8());
  const pwd = r.ascii(r.u8());
  const fingerprint = r.take(32);
  const count = r.u8();
  const candidates: Candidate[] = [];
  for (let i = 0; i < count; i++) {
    const tag = r.u8();
    const addrLen = tag === TAG_HOST_V4 || tag === TAG_SRFLX_V4 ? 4 : 16;
    if (![TAG_HOST_V4, TAG_HOST_V6, TAG_HOST_MDNS, TAG_SRFLX_V4, TAG_SRFLX_V6].includes(tag)) {
      throw new Error("unknown candidate tag");
    }
    const addr = r.take(addrLen);
    const port = (r.u8() << 8) | r.u8();
    candidates.push({ tag, addr, port });
  }
  if (!r.done) throw new Error("short code has trailing bytes");
  if (candidates.length === 0) throw new Error("short code has no candidates");
  return { kind, ufrag, pwd, fingerprint, candidates };
}

// --- base64url (no padding) ---

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64_LOOKUP = new Map(B64.split("").map((ch, i) => [ch, i] as const));

function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new Error("invalid code length");
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < chunk.length; j++) {
      const v = B64_LOOKUP.get(chunk[j]);
      if (v === undefined) throw new Error("invalid code character");
      n |= v << (18 - j * 6);
    }
    bytes.push((n >> 16) & 255);
    if (chunk.length > 2) bytes.push((n >> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return new Uint8Array(bytes);
}

// --- SDP template rebuild ---

function candidateLines(candidates: Candidate[]): string[] {
  return candidates.map((c, i) => {
    const isHost = c.tag === TAG_HOST_V4 || c.tag === TAG_HOST_V6 || c.tag === TAG_HOST_MDNS;
    const address =
      c.tag === TAG_HOST_MDNS ? formatMdns(c.addr) : c.addr.length === 4 ? Array.from(c.addr).join(".") : formatIPv6(c.addr);
    // foundation/priority are rebuilt: foundation only groups candidates, and
    // priority just orders pairing attempts, so representative values work.
    const priority = (isHost ? 2130706431 : 1694498815) - i;
    const typPart = isHost ? "typ host" : "typ srflx raddr 0.0.0.0 rport 0";
    return `a=candidate:${i + 1} 1 udp ${priority} ${address} ${c.port} ${typPart} generation 0`;
  });
}

function rebuildSdp(parsed: ParsedSdp): string {
  const fingerprintHex = Array.from(parsed.fingerprint, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(":");
  const lines = [
    "v=0",
    "o=- 1 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=extmap-allow-mixed",
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    ...candidateLines(parsed.candidates),
    `a=ice-ufrag:${parsed.ufrag}`,
    `a=ice-pwd:${parsed.pwd}`,
    "a=ice-options:trickle",
    `a=fingerprint:sha-256 ${fingerprintHex}`,
    `a=setup:${parsed.kind === "offer" ? "actpass" : "active"}`,
    "a=mid:0",
    "a=sctp-port:5000",
    "a=max-message-size:262144",
  ];
  return lines.join("\r\n") + "\r\n";
}

// --- public API ---

/** Encode an SDP as a short "P2." code; falls back to the legacy long code if the SDP doesn't fit the template. */
export function encodeSdp(sdp: string): string {
  const parsed = parseSdp(sdp);
  if (!parsed) return encodeLegacy(sdp);
  return SHORT_CODE_PREFIX + toBase64Url(pack(parsed));
}

/** Decode a short or legacy code back to an SDP string. Throws on malformed codes. */
export function decodeAnyCodeToSdp(code: string): string {
  const trimmed = code.trim();
  if (trimmed.startsWith(SHORT_CODE_PREFIX)) {
    return rebuildSdp(unpack(fromBase64Url(trimmed.slice(SHORT_CODE_PREFIX.length))));
  }
  return decodeLegacy(trimmed);
}

export type ValidateResult = { valid: true } | { valid: false; error: string };

export function validateAnyCode(code: string): ValidateResult {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "โค้ดว่างเปล่า กรุณาวางโค้ดที่ได้รับมา" };
  }
  if (!/^(P2\.)?[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: "โค้ดมีอักขระที่ไม่ถูกต้อง ตรวจสอบว่าคัดลอกมาครบและไม่มีการแก้ไข" };
  }
  let sdp: string;
  try {
    sdp = decodeAnyCodeToSdp(trimmed);
  } catch {
    return { valid: false, error: "โค้ดเสียหายหรือไม่สมบูรณ์ ลองคัดลอกใหม่อีกครั้ง" };
  }
  if (!sdp.startsWith("v=0") || !sdp.includes("m=")) {
    return { valid: false, error: "โค้ดนี้ไม่ใช่โค้ดเชื่อมต่อที่ถูกต้อง" };
  }
  return { valid: true };
}
