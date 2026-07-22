// Realtime layer: channel `pixel:<roomId>` carries op broadcasts (encoded via
// lib/proto) + presence for the ≤4-player roster. Thin — LWW/validation live
// in the pure libs; wiring is net/online-session.

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { encode, decode, type Message } from "@/lib/proto";
import type { Peer } from "./identity";

export const MAX_PLAYERS = 4;

export interface RosterEntry {
  peerId: string;
  nickname: string;
  slot: number; // 1..4, stable while present — drives cursor/heat tint
}

export interface RoomHandle {
  roomId: string;
  sendOp(op: Message): void;
  onOp(cb: (op: Message) => void): void;
  onRoster(cb: (peers: RosterEntry[]) => void): void;
  leave(): void;
}

function rosterFromPresence(channel: RealtimeChannel): RosterEntry[] {
  const state = channel.presenceState<{ peerId: string; nickname: string }>();
  const peers = Object.values(state)
    .flat()
    .map((p) => ({ peerId: p.peerId, nickname: p.nickname }));
  // dedupe (same peer in two tabs keeps one slot), stable slot by sorted peerId
  const unique = [...new Map(peers.map((p) => [p.peerId, p])).values()].sort((a, b) =>
    a.peerId.localeCompare(b.peerId)
  );
  return unique.map((p, i) => ({ ...p, slot: i + 1 }));
}

export function joinRoomChannel(roomId: string, me: Peer): Promise<{ handle: RoomHandle; full: boolean }> {
  return new Promise((resolve, reject) => {
    const channel = supabase.channel(`pixel:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: me.peerId } },
    });

    let opCb: ((op: Message) => void) | null = null;
    let rosterCb: ((peers: RosterEntry[]) => void) | null = null;
    let resolved = false;

    channel.on("broadcast", { event: "op" }, ({ payload }) => {
      if (typeof payload?.data !== "string") return;
      let msg: Message;
      try {
        msg = decode(payload.data);
      } catch {
        return; // malformed peer message: drop, never crash
      }
      if ("peerId" in msg && msg.peerId === me.peerId) return; // own echo
      opCb?.(msg);
    });

    channel.on("presence", { event: "sync" }, () => {
      rosterCb?.(rosterFromPresence(channel));
    });

    const handle: RoomHandle = {
      roomId,
      sendOp(op) {
        void channel.send({ type: "broadcast", event: "op", payload: { data: encode(op) } });
      },
      onOp(cb) {
        opCb = cb;
      },
      onRoster(cb) {
        rosterCb = cb;
        cb(rosterFromPresence(channel));
      },
      leave() {
        void channel.untrack();
        void supabase.removeChannel(channel);
      },
    };

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && !resolved) {
        resolved = true;
        // room-full check BEFORE tracking ourselves
        const present = rosterFromPresence(channel);
        const alreadyIn = present.some((p) => p.peerId === me.peerId);
        if (!alreadyIn && present.length >= MAX_PLAYERS) {
          void supabase.removeChannel(channel);
          resolve({ handle, full: true });
          return;
        }
        await channel.track({ peerId: me.peerId, nickname: me.nickname });
        resolve({ handle, full: false });
      } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !resolved) {
        resolved = true;
        reject(new Error(`realtime subscribe failed: ${status}`));
      }
    });
  });
}
