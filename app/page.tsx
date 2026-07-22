"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apply, createEmptyGrid, indexOf, type Grid } from "@/lib/grid";
import { shouldAcceptClearRequest, type ClearFlow } from "@/lib/clearFlow";
import { PALETTE, ERASER } from "@/lib/palette";
import { pushStroke, recordPaint, undoOps, type Stroke } from "@/lib/undo";
import { loadGrid as loadCachedGrid, saveGrid } from "@/lib/storage";
import { exportGridAsPng } from "@/lib/exportPng";
import { heatColor, type Peer } from "@/net/identity";
import type { RosterEntry } from "@/net/room";
import { startOnline, type OnlineSession, type RemoteCursor } from "@/net/online-session";
import CanvasGrid, { type PeerCursor } from "@/components/CanvasGrid";
import Toolbar from "@/components/Toolbar";
import Lobby, { InvitePanel, type LobbyResult } from "@/components/Lobby";

export default function Home() {
  const [entered, setEntered] = useState<LobbyResult | null>(null);
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [selectedColor, setSelectedColor] = useState(0);
  const [heatMode, setHeatMode] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [clearFlow, setClearFlow] = useState<ClearFlow>("idle");

  const currentStroke = useRef<Stroke>([]);
  const undoStack = useRef<Stroke[]>([]);
  const clearFlowRef = useRef<ClearFlow>("idle");
  useEffect(() => {
    clearFlowRef.current = clearFlow;
  }, [clearFlow]);

  const me: Peer | null = entered?.me ?? null;
  const roomId = entered?.roomId ?? null;

  // slot lookup: peerId → tint (heat + cursors). Unknown/absent authors = neutral.
  const slotByPeer = new Map(roster.map((r) => [r.peerId, r.slot]));
  const heatTint = useCallback(
    (peerId: string) => {
      const slot = slotByPeer.get(peerId);
      return slot ? heatColor(slot) : "#8a8577";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster]
  );

  // start the online session once the lobby hands over a joined room
  useEffect(() => {
    if (!entered) return;
    let live: OnlineSession | null = null;
    let cancelled = false;
    const cached = loadCachedGrid();
    if (cached) setGrid(cached); // instant paint from local cache; DB merge follows

    void startOnline(entered.room, entered.roomId, entered.me, {
      onGrid: (update) => setGrid(update),
      onCursor: (c) => setRemoteCursors((m) => new Map(m).set(c.peerId, c)),
      onRoster: (peers) => {
        setRoster(peers);
        setRemoteCursors((m) => {
          const present = new Set(peers.map((p) => p.peerId));
          const next = new Map([...m].filter(([id]) => present.has(id)));
          return next.size === m.size ? m : next;
        });
      },
      onClearRequested: () => {
        if (shouldAcceptClearRequest(clearFlowRef.current)) setClearFlow("peer-requested");
      },
      onCleared: () => {
        undoStack.current = [];
        currentStroke.current = [];
        setUndoAvailable(false);
        setClearFlow("idle");
      },
    }).then((s) => {
      if (cancelled) void s.destroy();
      else {
        live = s;
        setSession(s);
      }
    });
    return () => {
      cancelled = true;
      if (live) void live.destroy();
    };
  }, [entered]);

  // localStorage cache + debounced Postgres persist on every grid change
  useEffect(() => {
    saveGrid(grid);
    session?.schedulePersist(grid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  const handlePaint = useCallback(
    (x: number, y: number) => {
      if (!me) return;
      const pixel = { x, y, color: selectedColor, ts: Date.now(), peerId: me.peerId };
      setGrid((g) => {
        recordPaint(currentStroke.current, x, y, g[indexOf(x, y)], pixel.color, pixel.ts);
        return apply(g, pixel);
      });
      session?.sendPixel(pixel);
    },
    [selectedColor, me, session]
  );

  const handleStrokeEnd = useCallback(() => {
    undoStack.current = pushStroke(undoStack.current, currentStroke.current);
    currentStroke.current = [];
    setUndoAvailable(undoStack.current.length > 0);
  }, []);

  const handleUndo = useCallback(() => {
    if (!me) return;
    const stroke = undoStack.current[undoStack.current.length - 1];
    if (!stroke) return;
    undoStack.current = undoStack.current.slice(0, -1);
    setUndoAvailable(undoStack.current.length > 0);
    const now = Date.now();
    setGrid((g) => {
      let next = g;
      for (const op of undoOps(g, stroke, me.peerId, now)) {
        next = apply(next, op);
        session?.sendPixel(op);
      }
      return next;
    });
  }, [me, session]);

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

  function handleClearRequest() {
    if (roster.length > 1) {
      session?.requestClear();
      setClearFlow("awaiting-peer");
    } else {
      setClearFlow("confirm-solo");
    }
  }

  function wipeCanvas() {
    setGrid(() => {
      const empty = createEmptyGrid();
      session?.schedulePersist(empty);
      return empty;
    });
    resetUndoHistory();
    setClearFlow("idle");
  }

  function handleClearAccept() {
    // button is only rendered in the "peer-requested" state — no extra guard
    session?.acceptClear();
    wipeCanvas();
  }

  const nickByPeer = new Map(roster.map((r) => [r.peerId, r.nickname]));
  const cursors: PeerCursor[] = [...remoteCursors.values()]
    .filter((c) => c.peerId !== me?.peerId)
    .map((c) => ({
      peerId: c.peerId,
      x: c.x,
      y: c.y,
      color: heatTint(c.peerId),
      label: nickByPeer.get(c.peerId) ?? "เพื่อน",
    }));

  const handleCursorMove = useCallback(
    (x: number, y: number) => {
      session?.sendCursor(x, y);
    },
    [session]
  );

  return (
    <>
      <header className="app-header">
        <h1>Pixel Canvas</h1>
        <p>วาด canvas 64×64 กับเพื่อนสด ๆ ผ่านลิงก์ห้องเดียวกัน สูงสุด 4 คน</p>
        <div className="nav-buttons">
          <Link href="/method" className="btn btn-outline btn-sm">
            วิธีการทำงาน
          </Link>
        </div>
      </header>

      <main>
        {!entered ? (
          <div className="workspace">
            <Lobby onEnter={setEntered} />
          </div>
        ) : (
          <div className="workspace">
            <div className="workspace-canvas">
              <CanvasGrid
                grid={grid}
                palette={PALETTE}
                onPaint={handlePaint}
                onStrokeEnd={handleStrokeEnd}
                onCursorMove={handleCursorMove}
                cursors={cursors}
                heatMode={heatMode}
                heatTint={heatTint}
              />

              {clearFlow === "confirm-solo" && (
                <div className="clear-banner">
                  <p>ยืนยันล้างผืนทั้งหมด? การกระทำนี้กู้คืนไม่ได้</p>
                  <div className="toolbar-actions">
                    <button type="button" className="btn btn-sm btn-danger" onClick={wipeCanvas}>
                      ยืนยัน
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setClearFlow("idle")}>
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}

              {clearFlow === "awaiting-peer" && (
                <div className="clear-banner">
                  <p>รอเพื่อนกดยอมรับการล้างผืนทั้งหมด...</p>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setClearFlow("idle")}>
                    ยกเลิก
                  </button>
                </div>
              )}

              {clearFlow === "peer-requested" && (
                <div className="clear-banner">
                  <p>เพื่อนขอล้างผืนทั้งหมด ยอมรับไหม?</p>
                  <div className="toolbar-actions">
                    <button type="button" className="btn btn-sm btn-danger" onClick={handleClearAccept}>
                      ยอมรับ
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setClearFlow("idle")}>
                      ปฏิเสธ
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
                onClearRequest={handleClearRequest}
                clearDisabled={clearFlow !== "idle"}
              />
              {heatMode && (
                <div className="heat-legend">
                  {roster.map((r) => (
                    <span key={r.peerId} className="legend-chip">
                      <span className="dot" style={{ background: heatColor(r.slot) }} />
                      {r.nickname}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {roomId && <InvitePanel roomId={roomId} count={roster.length} />}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Pixel Canvas · วาดด้วยกันผ่านลิงก์ ห้องส่วนตัวไม่เกิน 4 คน ผืนเก็บไว้ 30 วัน</p>
      </footer>
    </>
  );
}
