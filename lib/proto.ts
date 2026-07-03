// Wire protocol for the WebRTC data channel: small, explicit message
// shapes, encoded to/decoded from JSON strings with validation so a
// malformed or malicious peer message never crashes the app.

import { CELL_COUNT, serialize as serializeGrid, deserialize as deserializeGrid, type Grid } from "@/lib/grid";

export type Message =
  | { type: "pixel"; x: number; y: number; color: number; ts: number; peerId: string }
  | { type: "cursor"; x: number; y: number; peerId: string }
  | { type: "fullSync"; grid: Grid }
  | { type: "clearRequest"; peerId: string; ts: number }
  | { type: "clearAccept"; peerId: string; ts: number };

export function encode(message: Message): string {
  if (message.type === "fullSync") {
    // wire form carries the compact serialized grid, not the raw 4096-cell array
    return JSON.stringify({ type: "fullSync", grid: serializeGrid(message.grid) });
  }
  return JSON.stringify(message);
}

function assertNumber(v: unknown, field: string): asserts v is number {
  if (typeof v !== "number" || Number.isNaN(v)) throw new Error(`invalid message: "${field}" must be a number`);
}

function assertString(v: unknown, field: string): asserts v is string {
  if (typeof v !== "string") throw new Error(`invalid message: "${field}" must be a string`);
}

export function decode(data: string): Message {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error("invalid message: not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("invalid message: expected a JSON object");
  }
  const obj = parsed as Record<string, unknown>;

  switch (obj.type) {
    case "pixel": {
      assertNumber(obj.x, "x");
      assertNumber(obj.y, "y");
      assertNumber(obj.color, "color");
      assertNumber(obj.ts, "ts");
      assertString(obj.peerId, "peerId");
      return { type: "pixel", x: obj.x, y: obj.y, color: obj.color, ts: obj.ts, peerId: obj.peerId };
    }
    case "cursor": {
      assertNumber(obj.x, "x");
      assertNumber(obj.y, "y");
      assertString(obj.peerId, "peerId");
      return { type: "cursor", x: obj.x, y: obj.y, peerId: obj.peerId };
    }
    case "fullSync": {
      assertString(obj.grid, "grid");
      const grid = deserializeGrid(obj.grid);
      if (grid.length !== CELL_COUNT) throw new Error("invalid message: fullSync grid has wrong size");
      return { type: "fullSync", grid };
    }
    case "clearRequest": {
      assertString(obj.peerId, "peerId");
      assertNumber(obj.ts, "ts");
      return { type: "clearRequest", peerId: obj.peerId, ts: obj.ts };
    }
    case "clearAccept": {
      assertString(obj.peerId, "peerId");
      assertNumber(obj.ts, "ts");
      return { type: "clearAccept", peerId: obj.peerId, ts: obj.ts };
    }
    default:
      throw new Error(`invalid message: unknown type "${String(obj.type)}"`);
  }
}
