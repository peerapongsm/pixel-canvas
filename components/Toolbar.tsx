"use client";

export interface ToolbarProps {
  palette: string[];
  selectedColor: number;
  onSelectColor: (index: number) => void;
  heatMode: boolean;
  onToggleHeat: () => void;
  onExport: () => void;
  onClearRequest: () => void;
  clearDisabled: boolean;
}

export default function Toolbar({
  palette,
  selectedColor,
  onSelectColor,
  heatMode,
  onToggleHeat,
  onExport,
  onClearRequest,
  clearDisabled,
}: ToolbarProps) {
  return (
    <div className="panel">
      <div className="toolbar-row">
        <div className="palette">
          {palette.map((color, i) => (
            <button
              key={color}
              type="button"
              className={`swatch${i === selectedColor ? " active" : ""}`}
              style={{ background: color }}
              aria-label={`สี ${i + 1}`}
              onClick={() => onSelectColor(i)}
            />
          ))}
        </div>
      </div>

      <div className="toggle-row">
        <span>โหมด heat: ใครวาดตรงไหน (ฉัน/เพื่อน)</span>
        <button type="button" className="btn btn-sm btn-outline" onClick={onToggleHeat}>
          {heatMode ? "ปิด" : "เปิด"}
        </button>
      </div>

      <div className="toolbar-actions">
        <button type="button" className="btn btn-sm btn-outline" onClick={onExport}>
          ส่งออก PNG
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={onClearRequest} disabled={clearDisabled}>
          ล้างผืนทั้งหมด
        </button>
      </div>
    </div>
  );
}
