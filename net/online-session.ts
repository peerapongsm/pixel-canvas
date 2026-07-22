// Glue between the canvas UI, the room channel, and the persister.
// Join sequence: onOp buffers first → loadGrid seeds → buffered ops apply
// via LWW → live. Order-independence of lib/grid's LWW makes buffering safe.

import { apply, merge, serialize, createEmptyGrid, type Grid } from "@/lib/grid";
import { isValidPixelMessage, isValidCursorMessage, filterValidCells } from "@/lib/validate";
import type { Message } from "@/lib/proto";
import type { Peer } from "./identity";
import type { RoomHandle, RosterEntry } from "./room";
import { loadGrid, makePersister } from "./canvas";

export interface RemoteCursor {
  peerId: string;
  x: number;
  y: number;
}

export interface SessionCallbacks {
  onGrid(update: (g: Grid) => Grid): void; // functional update into React state
  onCursor(c: RemoteCursor): void;
  onRoster(peers: RosterEntry[]): void;
  onClearRequested(): void; // a peer asked to wipe the canvas
  onCleared(): void; // a peer accepted → canvas wiped
}

export interface OnlineSession {
  sendPixel(op: { x: number; y: number; color: number; ts: number; peerId: string }): void;
  sendCursor(x: number, y: number): void;
  requestClear(): void;
  acceptClear(): void;
  schedulePersist(grid: Grid): void;
  destroy(): Promise<void>;
}

const MAX_OPS_PER_SEC = 200; // ponytail: drop-above rate cap, per-peer fairness not needed at ≤4

export async function startOnline(
  room: RoomHandle,
  roomId: string,
  me: Peer,
  cb: SessionCallbacks
): Promise<OnlineSession> {
  const persister = makePersister(roomId);
  let opWindow: number[] = [];

  function allowOp(): boolean {
    const now = Date.now();
    opWindow = opWindow.filter((t) => now - t < 1000);
    if (opWindow.length >= MAX_OPS_PER_SEC) return false;
    opWindow.push(now);
    return true;
  }

  // 1) subscribe first, buffering ops that race the DB load
  let buffer: Message[] | null = [];
  const handleOp = (msg: Message) => {
    switch (msg.type) {
      case "pixel":
        if (isValidPixelMessage(msg)) {
          cb.onGrid((g) => {
            const next = apply(g, msg);
            persister.schedule(serialize(next));
            return next;
          });
        }
        break;
      case "cursor":
        if (isValidCursorMessage(msg)) cb.onCursor({ peerId: msg.peerId, x: msg.x, y: msg.y });
        break;
      case "fullSync":
        cb.onGrid((g) => merge(g, filterValidCells(msg.grid)));
        break;
      case "clearRequest":
        cb.onClearRequested();
        break;
      case "clearAccept":
        cb.onGrid(() => {
          const empty = createEmptyGrid();
          persister.schedule(serialize(empty));
          return empty;
        });
        cb.onCleared();
        break;
    }
  };
  room.onOp((msg) => {
    if (buffer) buffer.push(msg);
    else handleOp(msg);
  });
  room.onRoster(cb.onRoster);

  // 2) seed from Postgres (source of truth), 3) drain the buffer via LWW
  const seeded = await loadGrid(roomId);
  if (seeded) cb.onGrid((g) => merge(g, filterValidCells(seeded)));
  const pending = buffer;
  buffer = null;
  for (const msg of pending) handleOp(msg);

  const flushOnHide = () => void persister.flush();
  window.addEventListener("pagehide", flushOnHide);

  return {
    sendPixel(op) {
      if (!allowOp()) return;
      room.sendOp({ type: "pixel", ...op });
    },
    sendCursor(x, y) {
      room.sendOp({ type: "cursor", x, y, peerId: me.peerId });
    },
    requestClear() {
      room.sendOp({ type: "clearRequest", peerId: me.peerId, ts: Date.now() });
    },
    acceptClear() {
      room.sendOp({ type: "clearAccept", peerId: me.peerId, ts: Date.now() });
    },
    schedulePersist(grid) {
      persister.schedule(serialize(grid));
    },
    async destroy() {
      window.removeEventListener("pagehide", flushOnHide);
      await persister.flush();
      room.leave();
    },
  };
}
