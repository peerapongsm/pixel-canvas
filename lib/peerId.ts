// A stable per-browser identifier, used as the LWW tiebreak key and to tell
// "my" pixels apart from "theirs" in heat view. Persisted so it survives
// refresh; a brand new id is generated the first time a device is used.
const STORAGE_KEY = "pixel-canvas:peer-id";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreatePeerId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = randomId();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}
