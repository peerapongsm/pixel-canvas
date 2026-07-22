"use client";

// Room-link lobby: nickname + เปิดผืนใหม่ / auto-join via ?room=<id>.
// Replaces the old WebRTC copy-paste stepper entirely.

import { useEffect, useState } from "react";
import { getPeer, setNickname, type Peer } from "@/net/identity";
import { ensureRoom } from "@/net/canvas";
import { joinRoomChannel, type RoomHandle } from "@/net/room";
import QrCode from "@/components/QrCode";

export interface LobbyResult {
  room: RoomHandle;
  me: Peer;
  roomId: string;
}

type Phase = "idle" | "joining" | "full" | "error";

function roomIdFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get("room");
}

export function inviteLinkFor(roomId: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
}

export default function Lobby({ onEnter }: { onEnter: (r: LobbyResult) => void }) {
  const [nick, setNick] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);

  useEffect(() => {
    setNick(getPeer().nickname);
    setPendingRoom(roomIdFromLocation());
  }, []);

  async function join(roomId: string, isNew: boolean) {
    setPhase("joining");
    setNickname(nick);
    const me = getPeer();
    try {
      if (isNew) await ensureRoom(roomId);
      const { handle, full } = await joinRoomChannel(roomId, me);
      if (full) {
        setPhase("full");
        return;
      }
      if (!isNew) await ensureRoom(roomId); // joining a link to a not-yet-created room = fresh room
      window.history.replaceState(null, "", inviteLinkFor(roomId));
      onEnter({ room: handle, me, roomId });
    } catch {
      setPhase("error");
    }
  }

  function createRoom() {
    void join(crypto.randomUUID().slice(0, 13), true);
  }

  return (
    <div className="panel lobby">
      <h2>{pendingRoom ? "เข้าร่วมผืนของเพื่อน" : "เปิดผืนใหม่แล้วชวนเพื่อน"}</h2>

      <label className="lobby-label" htmlFor="nickname">
        ชื่อที่จะโชว์ให้เพื่อนเห็น
      </label>
      <input
        id="nickname"
        className="lobby-input"
        value={nick}
        maxLength={20}
        onChange={(e) => setNick(e.target.value)}
        placeholder="ศิลปินนิรนาม"
      />

      {phase === "full" && <p className="lobby-note error">ผืนเต็มแล้ว (4 คน) ลองใหม่เมื่อมีคนออก</p>}
      {phase === "error" && <p className="lobby-note error">เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง</p>}

      {pendingRoom ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={phase === "joining"}
          onClick={() => void join(pendingRoom, false)}
        >
          {phase === "joining" ? "กำลังเข้าห้อง..." : "เข้าร่วมวาดด้วยกัน"}
        </button>
      ) : (
        <button type="button" className="btn btn-primary" disabled={phase === "joining"} onClick={createRoom}>
          {phase === "joining" ? "กำลังเปิดผืน..." : "เปิดผืนใหม่"}
        </button>
      )}

      <p className="lobby-note">ห้องส่วนตัวไม่เกิน 4 คน แชร์ลิงก์ให้เฉพาะเพื่อนที่อยากชวน ผืนเก็บไว้ให้ 30 วัน</p>
    </div>
  );
}

export function InvitePanel({ roomId, count }: { roomId: string; count: number }) {
  const [copied, setCopied] = useState(false);
  const link = inviteLinkFor(roomId);
  return (
    <div className="panel invite-panel">
      <h2>ชวนเพื่อน ({count}/4)</h2>
      <div className="invite-row">
        <code className="invite-link">{link}</code>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            void navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        </button>
      </div>
      <QrCode text={link} />
    </div>
  );
}
