"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GRID_SIZE, indexOf, inBounds, type Grid } from "@/lib/grid";
import { BrushIcon, PanIcon, ZoomInIcon, ZoomOutIcon } from "@/components/icons";

const CANVAS_PX = 512; // fixed internal raster resolution, CSS scales it to fit
const CELL_PX = CANVAS_PX / GRID_SIZE;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const CURSOR_THROTTLE_MS = 100; // 10Hz
const ZOOM_STEP = 1.4;

interface Point {
  x: number;
  y: number;
}

export interface PeerCursor {
  peerId: string;
  x: number;
  y: number;
  color: string; // slot tint from identity.heatColor
  label: string; // nickname
}

export interface CanvasGridProps {
  grid: Grid;
  palette: string[];
  onPaint: (x: number, y: number) => void;
  /** fired when a drawing gesture ends (pointer up/cancel/leave) — undo stroke boundary */
  onStrokeEnd: () => void;
  onCursorMove: (x: number, y: number) => void;
  cursors: PeerCursor[];
  heatMode: boolean;
  /** per-author tint for heat mode; unknown authors get a neutral grey */
  heatTint: (peerId: string) => string;
}

export default function CanvasGrid({
  grid,
  palette,
  onPaint,
  onStrokeEnd,
  onCursorMove,
  cursors,
  heatMode,
  heatTint,
}: CanvasGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [mode, setMode] = useState<"draw" | "pan">("draw");

  const pointers = useRef(new Map<number, Point>());
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef<{ client: Point; pan: Point } | null>(null);
  const lastPinch = useRef<{ distance: number; midpoint: Point } | null>(null);
  const lastPaintedCell = useRef<string | null>(null);
  const lastCursorSentAt = useRef(0);

  const clampPan = useCallback(
    (p: Point, z: number): Point => {
      const contentSize = CANVAS_PX * z;
      const maxX = Math.max(0, contentSize - CANVAS_PX);
      const maxY = Math.max(0, contentSize - CANVAS_PX);
      return { x: Math.min(Math.max(p.x, 0), maxX), y: Math.min(Math.max(p.y, 0), maxY) };
    },
    []
  );

  // Zoom while keeping the content point under (anchorX, anchorY) fixed on screen.
  const zoomAtPoint = useCallback(
    (newZoom: number, anchorX: number, anchorY: number) => {
      setZoom((prevZoom) => {
        const clampedZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
        setPan((prevPan) => {
          const worldX = (anchorX + prevPan.x) / prevZoom;
          const worldY = (anchorY + prevPan.y) / prevZoom;
          const nextPan = { x: worldX * clampedZoom - anchorX, y: worldY * clampedZoom - anchorY };
          return clampPan(nextPan, clampedZoom);
        });
        return clampedZoom;
      });
    },
    [clampPan]
  );

  const toInternalCoords = useCallback((clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((clientX - rect.left) * CANVAS_PX) / rect.width,
      y: ((clientY - rect.top) * CANVAS_PX) / rect.height,
    };
  }, []);

  const toCell = useCallback(
    (internal: Point): Point => ({
      x: Math.floor((internal.x + pan.x) / (CELL_PX * zoom)),
      y: Math.floor((internal.y + pan.y) / (CELL_PX * zoom)),
    }),
    [pan, zoom]
  );

  const paintAtClient = useCallback(
    (clientX: number, clientY: number) => {
      const internal = toInternalCoords(clientX, clientY);
      if (!internal) return;
      const cell = toCell(internal);
      if (!inBounds(cell.x, cell.y)) return;
      const key = `${cell.x},${cell.y}`;
      if (lastPaintedCell.current === key) return;
      lastPaintedCell.current = key;
      onPaint(cell.x, cell.y);
    },
    [toInternalCoords, toCell, onPaint]
  );

  const reportCursor = useCallback(
    (clientX: number, clientY: number) => {
      const now = Date.now();
      if (now - lastCursorSentAt.current < CURSOR_THROTTLE_MS) return;
      const internal = toInternalCoords(clientX, clientY);
      if (!internal) return;
      const cell = toCell(internal);
      if (!inBounds(cell.x, cell.y)) return;
      lastCursorSentAt.current = now;
      onCursorMove(cell.x, cell.y);
    },
    [toInternalCoords, toCell, onCursorMove]
  );

  const computePinchState = useCallback((): { distance: number; midpoint: Point } | null => {
    const pts = Array.from(pointers.current.values());
    if (pts.length < 2) return null;
    const [a, b] = pts;
    const ia = toInternalCoords(a.x, a.y);
    const ib = toInternalCoords(b.x, b.y);
    if (!ia || !ib) return null;
    return {
      distance: Math.hypot(ib.x - ia.x, ib.y - ia.y),
      midpoint: { x: (ia.x + ib.x) / 2, y: (ia.y + ib.y) / 2 },
    };
  }, [toInternalCoords]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      try {
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      } catch {
        // synthetic/expired pointers can't be captured — drawing still works
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 1) {
        if (mode === "draw") {
          isDrawing.current = true;
          lastPaintedCell.current = null;
          paintAtClient(e.clientX, e.clientY);
        } else {
          isPanning.current = true;
          panStart.current = { client: { x: e.clientX, y: e.clientY }, pan };
        }
      } else if (pointers.current.size === 2) {
        if (isDrawing.current) onStrokeEnd(); // second finger = gesture, close the stroke
        isDrawing.current = false;
        isPanning.current = false;
        lastPinch.current = computePinchState();
      }
    },
    [mode, pan, paintAtClient, computePinchState, onStrokeEnd]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      reportCursor(e.clientX, e.clientY);

      if (pointers.current.size === 1) {
        if (isDrawing.current) {
          paintAtClient(e.clientX, e.clientY);
        } else if (isPanning.current && panStart.current) {
          const dx = e.clientX - panStart.current.client.x;
          const dy = e.clientY - panStart.current.client.y;
          const rect = canvasRef.current?.getBoundingClientRect();
          const scaleX = rect ? CANVAS_PX / rect.width : 1;
          const scaleY = rect ? CANVAS_PX / rect.height : 1;
          const next = {
            x: panStart.current.pan.x - dx * scaleX,
            y: panStart.current.pan.y - dy * scaleY,
          };
          setPan(clampPan(next, zoom));
        }
      } else if (pointers.current.size === 2) {
        const current = computePinchState();
        if (current && lastPinch.current) {
          const dx = current.midpoint.x - lastPinch.current.midpoint.x;
          const dy = current.midpoint.y - lastPinch.current.midpoint.y;
          setPan((prev) => clampPan({ x: prev.x - dx, y: prev.y - dy }, zoom));
          const scaleFactor = current.distance / Math.max(lastPinch.current.distance, 1);
          zoomAtPoint(zoom * scaleFactor, current.midpoint.x, current.midpoint.y);
        }
        lastPinch.current = current;
      }
    },
    [reportCursor, paintAtClient, clampPan, zoom, computePinchState, zoomAtPoint]
  );

  const endPointer = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointers.current.delete(e.pointerId);
      if (isDrawing.current) onStrokeEnd();
      isDrawing.current = false;
      lastPaintedCell.current = null;
      if (pointers.current.size < 1) isPanning.current = false;
      if (pointers.current.size < 2) lastPinch.current = null;
    },
    [onStrokeEnd]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const internal = toInternalCoords(e.clientX, e.clientY);
      if (!internal) return;
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      zoomAtPoint(zoom * factor, internal.x, internal.y);
    },
    [toInternalCoords, zoom, zoomAtPoint]
  );

  // redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = CANVAS_PX;
    canvas.height = CANVAS_PX;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    ctx.save();
    ctx.translate(-pan.x, -pan.y);
    ctx.scale(zoom, zoom);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = grid[indexOf(x, y)];
        // unpainted and erased cells stay transparent so the board's checkerboard shows through
        if (cell === null || cell.color < 0) continue;
        ctx.fillStyle = heatMode ? heatTint(cell.peerId) : palette[cell.color] ?? "#c9bfa9";
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }

    // peer cursors: chunky pixel-arrow pointer per peer, slot-tinted
    for (const c of cursors) {
      if (!inBounds(c.x, c.y)) continue;
      const tipX = c.x * CELL_PX;
      const tipY = c.y * CELL_PX;
      const s = CELL_PX * 1.7;
      ctx.strokeStyle = c.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(tipX, tipY, CELL_PX, CELL_PX);
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(s * 0.3, s * 0.75);
      ctx.lineTo(s * 0.5, s * 1.05);
      ctx.lineTo(s * 0.68, s * 0.9);
      ctx.lineTo(s * 0.42, s * 0.62);
      ctx.lineTo(s * 0.72, s * 0.55);
      ctx.closePath();
      ctx.fillStyle = c.color;
      ctx.fill();
      ctx.lineWidth = 1.4 / zoom;
      ctx.strokeStyle = "#2c2620";
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [grid, zoom, pan, palette, heatMode, heatTint, cursors]);

  const handleZoomIn = useCallback(
    () => zoomAtPoint(zoom * ZOOM_STEP, CANVAS_PX / 2, CANVAS_PX / 2),
    [zoom, zoomAtPoint]
  );
  const handleZoomOut = useCallback(
    () => zoomAtPoint(zoom / ZOOM_STEP, CANVAS_PX / 2, CANVAS_PX / 2),
    [zoom, zoomAtPoint]
  );

  // screen-space positions (in % of the stage) for peer cursors' DOM name tags
  const cursorTags = cursors
    .filter((c) => inBounds(c.x, c.y))
    .map((c) => {
      const dispX = c.x * CELL_PX * zoom - pan.x;
      const dispY = c.y * CELL_PX * zoom - pan.y;
      return {
        key: c.peerId,
        label: c.label,
        color: c.color,
        style: { left: `${(dispX / CANVAS_PX) * 100}%`, top: `${(dispY / CANVAS_PX) * 100}%` },
      };
    });

  return (
    <div className="canvas-board">
      <div className="canvas-stage">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={endPointer}
          onWheel={handleWheel}
        />
        {cursorTags.map((t) => (
          <div key={t.key} className="friend-tag" style={{ ...t.style, background: t.color }}>
            {t.label}
          </div>
        ))}
        <div className="canvas-tools">
          <button
            type="button"
            className={`icon-btn${mode === "pan" ? " active" : ""}`}
            onClick={() => setMode((m) => (m === "draw" ? "pan" : "draw"))}
            aria-pressed={mode === "pan"}
          >
            {mode === "draw" ? <BrushIcon /> : <PanIcon />}
            {mode === "draw" ? "วาด" : "เลื่อน"}
          </button>
        </div>
      </div>

      <div className="zoom-tools">
        <button type="button" className="icon-btn" onClick={handleZoomOut} aria-label="ซูมออก">
          <ZoomOutIcon />
        </button>
        <span className="zoom-readout mono">{Math.round(zoom * 100)}%</span>
        <button type="button" className="icon-btn" onClick={handleZoomIn} aria-label="ซูมเข้า">
          <ZoomInIcon />
        </button>
      </div>
    </div>
  );
}
