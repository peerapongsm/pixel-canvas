"use client";

import { DownloadIcon, FlameIcon, TrashIcon } from "@/components/icons";

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
    <div className="dock">
      <div className="dock-row">
        <div className="palette-tray">
          {palette.map((color, i) => (
            <button
              key={color}
              type="button"
              className={`well${i === selectedColor ? " active" : ""}`}
              style={{ background: color }}
              aria-label={`สี ${i + 1}`}
              onClick={() => onSelectColor(i)}
            />
          ))}
        </div>
      </div>

      <div className="dock-actions">
        <div className="heat-legend">
          <button
            type="button"
            className={`icon-btn${heatMode ? " on" : ""}`}
            onClick={onToggleHeat}
            aria-pressed={heatMode}
          >
            <FlameIcon />
            heat
          </button>
          <span className={`legend-chip mine${heatMode ? " active" : ""}`}>
            <span className="dot" />
            ฉัน
          </span>
          <span className={`legend-chip theirs${heatMode ? " active" : ""}`}>
            <span className="dot" />
            เพื่อน
          </span>
        </div>

        <div className="dock-row" style={{ gap: 6 }}>
          <button type="button" className="icon-btn" onClick={onExport}>
            <DownloadIcon />
            PNG
          </button>
          <button type="button" className="icon-btn" onClick={onClearRequest} disabled={clearDisabled}>
            <TrashIcon />
            ล้าง
          </button>
        </div>
      </div>
    </div>
  );
}
