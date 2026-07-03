import { describe, expect, test } from "vitest";
import { encode, decode, type Message } from "@/lib/proto";
import { createEmptyGrid, apply, type Grid } from "@/lib/grid";

describe("proto encode/decode round-trips", () => {
  test("pixel message", () => {
    const msg: Message = { type: "pixel", x: 3, y: 4, color: 9, ts: 12345, peerId: "host" };
    expect(decode(encode(msg))).toEqual(msg);
  });

  test("cursor message", () => {
    const msg: Message = { type: "cursor", x: 10.5, y: 20.25, peerId: "guest" };
    expect(decode(encode(msg))).toEqual(msg);
  });

  test("fullSync message carries a serialized grid", () => {
    let grid: Grid = createEmptyGrid();
    grid = apply(grid, { x: 1, y: 1, color: 2, ts: 1, peerId: "host" });
    const msg: Message = { type: "fullSync", grid };
    const round = decode(encode(msg));
    expect(round).toEqual(msg);
  });

  test("clearRequest message", () => {
    const msg: Message = { type: "clearRequest", peerId: "host", ts: 999 };
    expect(decode(encode(msg))).toEqual(msg);
  });

  test("clearAccept message", () => {
    const msg: Message = { type: "clearAccept", peerId: "guest", ts: 1000 };
    expect(decode(encode(msg))).toEqual(msg);
  });
});

describe("decode validation", () => {
  test("rejects garbage (not JSON)", () => {
    expect(() => decode("not json{{{")).toThrow();
  });

  test("rejects JSON with unknown type", () => {
    expect(() => decode(JSON.stringify({ type: "explode" }))).toThrow();
  });

  test("rejects pixel message missing fields", () => {
    expect(() => decode(JSON.stringify({ type: "pixel", x: 1 }))).toThrow();
  });

  test("rejects cursor message with non-numeric coordinates", () => {
    expect(() => decode(JSON.stringify({ type: "cursor", x: "a", y: 1, peerId: "host" }))).toThrow();
  });

  test("rejects non-object JSON (array/number/string)", () => {
    expect(() => decode(JSON.stringify([1, 2, 3]))).toThrow();
    expect(() => decode(JSON.stringify(42))).toThrow();
    expect(() => decode(JSON.stringify("hello"))).toThrow();
  });
});
