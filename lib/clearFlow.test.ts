import { describe, expect, test } from "vitest";
import { shouldAcceptClearAccept, shouldAcceptClearRequest, type ClearFlow } from "@/lib/clearFlow";

const ALL_STATES: ClearFlow[] = ["idle", "awaiting-peer", "peer-requested", "confirm-solo"];

describe("shouldAcceptClearAccept", () => {
  test("accepts only when locally awaiting the peer's acceptance", () => {
    expect(shouldAcceptClearAccept("awaiting-peer")).toBe(true);
  });

  test("rejects an unsolicited clearAccept in every other local state", () => {
    for (const state of ALL_STATES.filter((s) => s !== "awaiting-peer")) {
      expect(shouldAcceptClearAccept(state)).toBe(false);
    }
  });
});

describe("shouldAcceptClearRequest", () => {
  test("accepts when idle (no local clear flow in progress)", () => {
    expect(shouldAcceptClearRequest("idle")).toBe(true);
  });

  test("accepts a repeated clearRequest while already peer-requested", () => {
    expect(shouldAcceptClearRequest("peer-requested")).toBe(true);
  });

  test("does not override an in-progress awaiting-peer state", () => {
    expect(shouldAcceptClearRequest("awaiting-peer")).toBe(false);
  });

  test("does not override an in-progress confirm-solo state", () => {
    expect(shouldAcceptClearRequest("confirm-solo")).toBe(false);
  });
});
