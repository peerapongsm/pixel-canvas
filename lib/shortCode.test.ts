import { describe, expect, it } from "vitest";
import { encodeSdpToCode as encodeLegacy } from "@/lib/codes";
import { SHORT_CODE_PREFIX, decodeAnyCodeToSdp, encodeSdp, validateAnyCode } from "@/lib/shortCode";

// Shaped like a real Chrome datachannel offer: mDNS-obscured host candidates
// plus one srflx, trickle ICE, sha-256 fingerprint.
const CHROME_OFFER = [
  "v=0",
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:2999745851 1 udp 2113937151 a1b2c3d4-1234-4abc-9def-0123456789ab.local 56789 typ host generation 0 network-cost 999",
  "a=candidate:842163049 1 udp 1677729535 203.0.113.7 61042 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999",
  "a=ice-ufrag:4aFz",
  "a=ice-pwd:by4GZGG1lw1RVFXe2XQqOB6B",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 19:E2:1C:3B:4B:9F:81:E6:B8:5C:F4:A5:A8:D8:73:04:BB:05:2F:70:9F:04:A9:0E:05:E9:26:33:E8:70:88:A2",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
].join("\r\n") + "\r\n";

const FIREFOX_ANSWER = [
  "v=0",
  "o=mozilla...THIS_IS_SDPARTA-99.0 8697926912015624 0 IN IP4 0.0.0.0",
  "s=-",
  "t=0 0",
  "a=fingerprint:sha-256 CD:34:D1:62:16:95:7B:B7:EB:74:E2:39:27:97:EB:0B:23:73:AC:BC:BF:2F:E3:91:CB:57:A9:9D:4A:A2:0B:40",
  "a=group:BUNDLE 0",
  "a=ice-options:trickle",
  "a=msid-semantic:WMS *",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 192.0.2.33",
  "a=candidate:0 1 UDP 2122252543 192.0.2.33 51556 typ host",
  "a=candidate:1 1 UDP 1686052863 198.51.100.9 51556 typ srflx raddr 192.0.2.33 rport 51556",
  "a=sendrecv",
  "a=ice-pwd:e81b4820b2c8b90fbd4f4b3c9b2be59f",
  "a=ice-ufrag:9f478f21",
  "a=mid:0",
  "a=setup:active",
  "a=sctp-port:5000",
  "a=max-message-size:1073741823",
].join("\r\n") + "\r\n";

describe("encodeSdp / decodeAnyCodeToSdp", () => {
  it("round-trips the fields that matter from a Chrome offer", () => {
    const code = encodeSdp(CHROME_OFFER);
    expect(code.startsWith(SHORT_CODE_PREFIX)).toBe(true);
    const sdp = decodeAnyCodeToSdp(code);
    expect(sdp).toContain("a=ice-ufrag:4aFz");
    expect(sdp).toContain("a=ice-pwd:by4GZGG1lw1RVFXe2XQqOB6B");
    expect(sdp).toContain(
      "a=fingerprint:sha-256 19:E2:1C:3B:4B:9F:81:E6:B8:5C:F4:A5:A8:D8:73:04:BB:05:2F:70:9F:04:A9:0E:05:E9:26:33:E8:70:88:A2"
    );
    expect(sdp).toContain("a1b2c3d4-1234-4abc-9def-0123456789ab.local 56789 typ host");
    expect(sdp).toContain("203.0.113.7 61042 typ srflx");
    expect(sdp).toContain("a=setup:actpass");
    expect(sdp).toContain("m=application 9 UDP/DTLS/SCTP webrtc-datachannel");
    expect(sdp.startsWith("v=0")).toBe(true);
  });

  it("round-trips a Firefox answer (uppercase UDP, no generation suffix)", () => {
    const code = encodeSdp(FIREFOX_ANSWER);
    expect(code.startsWith(SHORT_CODE_PREFIX)).toBe(true);
    const sdp = decodeAnyCodeToSdp(code);
    expect(sdp).toContain("a=ice-ufrag:9f478f21");
    expect(sdp).toContain("a=ice-pwd:e81b4820b2c8b90fbd4f4b3c9b2be59f");
    expect(sdp).toContain("192.0.2.33 51556 typ host");
    expect(sdp).toContain("198.51.100.9 51556 typ srflx");
    expect(sdp).toContain("a=setup:active");
  });

  it("produces dramatically shorter codes than the legacy encoding", () => {
    const shortCode = encodeSdp(CHROME_OFFER);
    const legacyCode = encodeLegacy(CHROME_OFFER);
    expect(shortCode.length).toBeLessThan(200);
    expect(shortCode.length).toBeLessThan(legacyCode.length / 2);
  });

  it("re-encoding a rebuilt SDP is stable (idempotent template)", () => {
    const once = decodeAnyCodeToSdp(encodeSdp(CHROME_OFFER));
    const twice = decodeAnyCodeToSdp(encodeSdp(once));
    expect(twice).toBe(once);
  });

  it("still decodes legacy codes", () => {
    const legacyCode = encodeLegacy(CHROME_OFFER);
    expect(decodeAnyCodeToSdp(legacyCode)).toBe(CHROME_OFFER);
  });

  it("falls back to legacy encoding when no candidate is encodable", () => {
    const noCandidates = CHROME_OFFER.split("\r\n")
      .filter((l) => !l.startsWith("a=candidate:"))
      .join("\r\n");
    const code = encodeSdp(noCandidates);
    expect(code.startsWith(SHORT_CODE_PREFIX)).toBe(false);
    expect(decodeAnyCodeToSdp(code)).toBe(noCandidates);
  });

  it("drops tcp/relay candidates but keeps udp ones", () => {
    const withTcp = CHROME_OFFER.replace(
      "a=ice-ufrag:4aFz",
      "a=candidate:3 1 tcp 1518280447 192.0.2.5 9 typ host tcptype active generation 0\r\na=ice-ufrag:4aFz"
    );
    const sdp = decodeAnyCodeToSdp(encodeSdp(withTcp));
    expect(sdp).not.toContain("tcp");
    expect(sdp).toContain("typ srflx");
  });

  it("handles IPv6 srflx candidates", () => {
    const v6 = CHROME_OFFER.replace(
      "a=candidate:842163049 1 udp 1677729535 203.0.113.7 61042 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999",
      "a=candidate:842163049 1 udp 1677729535 2001:db8::1234:5678 61042 typ srflx raddr :: rport 0 generation 0 network-cost 999"
    );
    const sdp = decodeAnyCodeToSdp(encodeSdp(v6));
    expect(sdp).toMatch(/2001:db8:0:0:0:0:1234:5678 61042 typ srflx/);
  });
});

describe("validateAnyCode", () => {
  it("accepts a valid short code", () => {
    expect(validateAnyCode(encodeSdp(CHROME_OFFER))).toEqual({ valid: true });
  });

  it("accepts a valid legacy code", () => {
    expect(validateAnyCode(encodeLegacy(CHROME_OFFER))).toEqual({ valid: true });
  });

  it("rejects empty input", () => {
    expect(validateAnyCode("  ").valid).toBe(false);
  });

  it("rejects garbage characters", () => {
    expect(validateAnyCode("P2.abc!!def").valid).toBe(false);
  });

  it("rejects a truncated short code", () => {
    const code = encodeSdp(CHROME_OFFER);
    expect(validateAnyCode(code.slice(0, 20)).valid).toBe(false);
  });

  it("rejects a short code with flipped payload bytes", () => {
    expect(validateAnyCode("P2.AAAA").valid).toBe(false);
  });
});
