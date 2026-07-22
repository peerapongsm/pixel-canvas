import { describe, it, expect, beforeEach } from "vitest";
import { getPeer, setNickname, heatColor } from "../net/identity";

describe("identity", () => {
  beforeEach(() => localStorage.clear());

  it("mints a stable peerId + nickname", () => {
    const a = getPeer();
    const b = getPeer();
    expect(a.peerId).toBe(b.peerId); // stable across calls
    expect(a.nickname).toBeTruthy();
  });

  it("nickname persists", () => {
    setNickname("เอก");
    expect(getPeer().nickname).toBe("เอก");
  });

  it("blank nickname falls back to the default", () => {
    setNickname("   ");
    expect(getPeer().nickname).not.toBe("");
  });

  it("heatColor is distinct per slot 1..4", () => {
    const set = new Set([1, 2, 3, 4].map(heatColor));
    expect(set.size).toBe(4);
  });
});
