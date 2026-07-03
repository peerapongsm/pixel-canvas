// Persists the grid to localStorage so work survives a refresh (spec §4).
import { serialize, deserialize, type Grid } from "@/lib/grid";

const GRID_KEY = "pixel-canvas:grid";

export function loadGrid(): Grid | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GRID_KEY);
  if (!raw) return null;
  try {
    return deserialize(raw);
  } catch {
    return null;
  }
}

export function saveGrid(grid: Grid): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GRID_KEY, serialize(grid));
}

export function clearStoredGrid(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GRID_KEY);
}
