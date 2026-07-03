import { describe, expect, test } from "vitest";
import { encodeSdpToCode, decodeCodeToSdp, validateCode } from "@/lib/codes";

// A realistic-ish SDP offer fixture (trimmed but structurally representative,
// including the kind of repeated tokens real WebRTC SDP is full of).
const SDP_FIXTURE = [
  "v=0",
  "o=- 4611730001 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=ice-ufrag:abcd",
  "a=ice-pwd:efghijklmnopqrstuvwxyz012345",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "a=candidate:1 1 udp 2130706431 192.168.1.5 54321 typ host generation 0 network-cost 999",
  "a=candidate:2 1 udp 1694498815 203.0.113.9 54322 typ srflx raddr 192.168.1.5 rport 54321 generation 0 network-cost 999",
  "",
].join("\r\n");

describe("encodeSdpToCode / decodeCodeToSdp round-trip", () => {
  test("round-trips the fixture SDP exactly", () => {
    const code = encodeSdpToCode(SDP_FIXTURE);
    expect(decodeCodeToSdp(code)).toBe(SDP_FIXTURE);
  });

  test("round-trips short/empty-ish SDP text", () => {
    const code = encodeSdpToCode("v=0\r\n");
    expect(decodeCodeToSdp(code)).toBe("v=0\r\n");
  });

  test("code is base64url (no +, /, or = padding characters)", () => {
    const code = encodeSdpToCode(SDP_FIXTURE);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("compresses repeated SDP tokens to a shorter code than naive base64", () => {
    const code = encodeSdpToCode(SDP_FIXTURE);
    const naiveBase64Length = Math.ceil((SDP_FIXTURE.length * 4) / 3);
    expect(code.length).toBeLessThan(naiveBase64Length);
  });
});

describe("validateCode", () => {
  test("accepts a freshly encoded valid code", () => {
    const code = encodeSdpToCode(SDP_FIXTURE);
    expect(validateCode(code)).toEqual({ valid: true });
  });

  test("rejects empty input", () => {
    const result = validateCode("");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBeTruthy();
  });

  test("rejects whitespace-only input", () => {
    const result = validateCode("   ");
    expect(result.valid).toBe(false);
  });

  test("rejects non-base64url characters", () => {
    const result = validateCode("not a valid code!!! ***");
    expect(result.valid).toBe(false);
  });

  test("rejects base64url garbage that doesn't decode to SDP-shaped text", () => {
    // valid base64url alphabet, but decodes to nonsense bytes / doesn't look like SDP
    const result = validateCode("QUJDREVGRw");
    expect(result.valid).toBe(false);
  });

  test("rejects truncated/corrupted real code", () => {
    const code = encodeSdpToCode(SDP_FIXTURE);
    const corrupted = code.slice(0, Math.floor(code.length / 2));
    const result = validateCode(corrupted);
    expect(result.valid).toBe(false);
  });

  test("decodeCodeToSdp throws with a readable message on invalid code", () => {
    expect(() => decodeCodeToSdp("!!!not valid!!!")).toThrow();
  });
});
