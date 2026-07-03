// Exports the grid as a PNG, upscaled 10x with nearest-neighbor (crisp
// blocky pixels, no blur). Browser-only: touches canvas/DOM directly, so
// it's not unit tested — same rationale as other pure-render code in this
// project (see /method).
import { GRID_SIZE, indexOf, type Grid } from "@/lib/grid";

const EXPORT_SCALE = 10;

export function exportGridAsPng(grid: Grid, palette: string[], filename = "pixel-canvas.png"): void {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE * EXPORT_SCALE;
  canvas.height = GRID_SIZE * EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = grid[indexOf(x, y)];
      if (cell === null) continue; // leave unpainted cells transparent
      ctx.fillStyle = palette[cell.color] ?? "#000000";
      ctx.fillRect(x * EXPORT_SCALE, y * EXPORT_SCALE, EXPORT_SCALE, EXPORT_SCALE);
    }
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
