// Anonymous identity: stable localStorage uuid (reuses lib/peerId) + a
// nickname, plus the fixed per-slot tint palette for per-author cursors/heat.

import { getOrCreatePeerId } from "@/lib/peerId";

export interface Peer {
  peerId: string;
  nickname: string;
}

const NICK_KEY = "pixel-canvas-nickname";
const DEFAULT_NICKNAME = "ศิลปินนิรนาม";

export function getPeer(): Peer {
  return {
    peerId: getOrCreatePeerId(),
    nickname: localStorage.getItem(NICK_KEY) ?? DEFAULT_NICKNAME,
  };
}

export function setNickname(n: string): void {
  localStorage.setItem(NICK_KEY, n.trim() || DEFAULT_NICKNAME);
}

// Stable tints for slots 1..4 (per-author heat + cursor color).
const SLOT_TINTS = ["#e4572e", "#2e86ab", "#3f9e4d", "#b05fbf"] as const;

export function heatColor(slot: number): string {
  return SLOT_TINTS[(slot - 1 + SLOT_TINTS.length * 100) % SLOT_TINTS.length]!;
}
