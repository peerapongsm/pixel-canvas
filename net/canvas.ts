// Postgres persistence: the pixel_canvases row is the source of truth.
// Live sync happens over broadcast; durability is a debounced full-grid
// upsert (per-pixel DB writes would be far too heavy for 64×64 painting).

import { supabase } from "@/config/supabase";
import { deserialize, type Grid } from "@/lib/grid";

export type SerializedGrid = string; // lib/grid serialize() output

export async function loadGrid(roomId: string): Promise<Grid | null> {
  const { data, error } = await supabase.from("pixel_canvases").select("grid").eq("id", roomId).maybeSingle();
  if (error || !data || typeof data.grid !== "string" || data.grid === "") return null;
  try {
    return deserialize(data.grid);
  } catch {
    return null;
  }
}

export async function ensureRoom(roomId: string): Promise<void> {
  // idempotent: creates the empty row if absent, never clobbers an existing grid
  await supabase.from("pixel_canvases").upsert({ id: roomId }, { onConflict: "id", ignoreDuplicates: true });
}

async function upsertGrid(roomId: string, grid: SerializedGrid): Promise<void> {
  await supabase
    .from("pixel_canvases")
    .upsert({ id: roomId, grid, updated_at: new Date().toISOString() }, { onConflict: "id" });
}

export function makePersister(
  roomId: string,
  opts?: { debounceMs?: number; upsert?: (g: SerializedGrid) => Promise<void> }
): { schedule(grid: SerializedGrid): void; flush(): Promise<void> } {
  const debounceMs = opts?.debounceMs ?? 1200;
  const upsert = opts?.upsert ?? ((g: SerializedGrid) => upsertGrid(roomId, g));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: SerializedGrid | null = null;

  return {
    schedule(grid: SerializedGrid) {
      pending = grid;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const g = pending;
        pending = null;
        if (g !== null) void upsert(g);
      }, debounceMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const g = pending;
      pending = null;
      if (g !== null) await upsert(g);
    },
  };
}
