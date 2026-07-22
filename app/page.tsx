"use client";

// Solo baseline after removing the WebRTC layer — the Supabase online
// session (lobby + live ops) is wired in by net/online-session + Lobby.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apply, createEmptyGrid, indexOf, type Grid } from "@/lib/grid";
import { PALETTE, ERASER } from "@/lib/palette";
import { pushStroke, recordPaint, undoOps, type Stroke } from "@/lib/undo";
import { getOrCreatePeerId } from "@/lib/peerId";
import { loadGrid, saveGrid } from "@/lib/storage";
import { exportGridAsPng } from "@/lib/exportPng";
import CanvasGrid from "@/components/CanvasGrid";
import Toolbar from "@/components/Toolbar";

export default function Home() {
  const [grid, setGrid] = useState<Grid>(() => loadGrid() ?? createEmptyGrid());
  const [peerId] = useState(() => getOrCreatePeerId());
  const [selectedColor, setSelectedColor] = useState(0);
  const [heatMode, setHeatMode] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const currentStroke = useRef<Stroke>([]);
  const undoStack = useRef<Stroke[]>([]);

  // persist on every grid change (localStorage = local cache)
  useEffect(() => {
    saveGrid(grid);
  }, [grid]);

  const handlePaint = useCallback(
    (x: number, y: number) => {
      const pixel = { x, y, color: selectedColor, ts: Date.now(), peerId };
      setGrid((g) => {
        recordPaint(currentStroke.current, x, y, g[indexOf(x, y)], pixel.color, pixel.ts);
        return apply(g, pixel);
      });
    },
    [selectedColor, peerId]
  );

  const handleStrokeEnd = useCallback(() => {
    undoStack.current = pushStroke(undoStack.current, currentStroke.current);
    currentStroke.current = [];
    setUndoAvailable(undoStack.current.length > 0);
  }, []);

  const handleUndo = useCallback(() => {
    const stroke = undoStack.current[undoStack.current.length - 1];
    if (!stroke) return;
    undoStack.current = undoStack.current.slice(0, -1);
    setUndoAvailable(undoStack.current.length > 0);
    const now = Date.now();
    setGrid((g) => {
      let next = g;
      for (const op of undoOps(g, stroke, peerId, now)) {
        next = apply(next, op);
      }
      return next;
    });
  }, [peerId]);

  // keyboard: Ctrl/Cmd+Z = undo, E = toggle eraser
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "e") {
        setSelectedColor((c) => (c === ERASER ? 0 : ERASER));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

  function resetUndoHistory() {
    undoStack.current = [];
    currentStroke.current = [];
    setUndoAvailable(false);
  }

  function handleClearConfirm() {
    setGrid(createEmptyGrid());
    resetUndoHistory();
    setConfirmClear(false);
  }

  return (
    <>
      <header className="app-header">
        <h1>Pixel Canvas</h1>
        <p>วาด canvas 64×64 กับเพื่อนสด ๆ ผ่านลิงก์ห้องเดียวกัน</p>
        <div className="nav-buttons">
          <Link href="/method" className="btn btn-outline btn-sm">
            วิธีการทำงาน
          </Link>
        </div>
      </header>

      <main>
        <div className="workspace">
          <div className="workspace-canvas">
            <CanvasGrid
              grid={grid}
              palette={PALETTE}
              onPaint={handlePaint}
              onStrokeEnd={handleStrokeEnd}
              onCursorMove={() => {}}
              friendCursor={null}
              heatMode={heatMode}
              myPeerId={peerId}
            />

            {confirmClear && (
              <div className="clear-banner">
                <p>ยืนยันล้างผืนทั้งหมด? การกระทำนี้กู้คืนไม่ได้</p>
                <div className="toolbar-actions">
                  <button type="button" className="btn btn-sm btn-danger" onClick={handleClearConfirm}>
                    ยืนยัน
                  </button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setConfirmClear(false)}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="workspace-tools">
            <Toolbar
              palette={PALETTE}
              selectedColor={selectedColor}
              onSelectColor={setSelectedColor}
              onUndo={handleUndo}
              undoDisabled={!undoAvailable}
              heatMode={heatMode}
              onToggleHeat={() => setHeatMode((h) => !h)}
              onExport={() => exportGridAsPng(grid, PALETTE)}
              onClearRequest={() => setConfirmClear(true)}
              clearDisabled={confirmClear}
            />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Pixel Canvas · วาดด้วยกันผ่านลิงก์ ห้องส่วนตัวไม่เกิน 4 คน</p>
      </footer>
    </>
  );
}
