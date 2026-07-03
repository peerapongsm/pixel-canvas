"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apply, merge, createEmptyGrid, type Grid } from "@/lib/grid";
import type { Message } from "@/lib/proto";
import { isValidPixelMessage, isValidCursorMessage, filterValidCells } from "@/lib/validate";
import { shouldAcceptClearAccept, shouldAcceptClearRequest, type ClearFlow } from "@/lib/clearFlow";
import { PixelCanvasConnection, type ConnectionState } from "@/lib/rtc";
import { PALETTE } from "@/lib/palette";
import { getOrCreatePeerId } from "@/lib/peerId";
import { loadGrid, saveGrid } from "@/lib/storage";
import { exportGridAsPng } from "@/lib/exportPng";
import CanvasGrid from "@/components/CanvasGrid";
import Toolbar from "@/components/Toolbar";
import ConnectionStepper from "@/components/ConnectionStepper";

type Role = "none" | "host" | "guest";

export default function Home() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [grid, setGrid] = useState<Grid>(() => loadGrid() ?? createEmptyGrid());
  const [peerId] = useState(() => getOrCreatePeerId());
  const [friendCursor, setFriendCursor] = useState<{ x: number; y: number } | null>(null);
  const [clearFlow, setClearFlow] = useState<ClearFlow>("idle");
  const [role, setRole] = useState<Role>("none");
  const [selectedColor, setSelectedColor] = useState(0);
  const [heatMode, setHeatMode] = useState(false);

  // handleMessage is created once (stable identity, passed to the
  // PixelCanvasConnection at construction) so it can't close over fresh
  // `clearFlow` state; this ref keeps the latest value available to it.
  const clearFlowRef = useRef<ClearFlow>("idle");
  useEffect(() => {
    clearFlowRef.current = clearFlow;
  }, [clearFlow]);

  const handleMessage = useCallback((message: Message) => {
    switch (message.type) {
      case "pixel":
        if (isValidPixelMessage(message)) {
          setGrid((g) => apply(g, message));
        }
        break;
      case "cursor":
        if (isValidCursorMessage(message)) {
          setFriendCursor({ x: message.x, y: message.y });
        }
        break;
      case "fullSync":
        setGrid((g) => merge(g, filterValidCells(message.grid)));
        break;
      case "clearRequest":
        if (shouldAcceptClearRequest(clearFlowRef.current)) {
          setClearFlow("peer-requested");
        }
        break;
      case "clearAccept":
        if (shouldAcceptClearAccept(clearFlowRef.current)) {
          setGrid(createEmptyGrid());
          setClearFlow("idle");
        }
        break;
    }
  }, []);

  const [connection] = useState(
    () => new PixelCanvasConnection({ onStateChange: setConnectionState, onMessage: handleMessage })
  );

  useEffect(() => () => connection.close(), [connection]);

  // persist on every grid change
  useEffect(() => {
    saveGrid(grid);
  }, [grid]);

  // host sends a full sync the moment the connection opens
  const prevConnectionState = useRef<ConnectionState>("idle");
  useEffect(() => {
    if (connectionState === "connected" && prevConnectionState.current !== "connected" && role === "host") {
      setGrid((g) => {
        connection.send({ type: "fullSync", grid: g });
        return g;
      });
    }
    prevConnectionState.current = connectionState;
  }, [connectionState, role, connection]);

  const handlePaint = useCallback(
    (x: number, y: number) => {
      const pixel = { x, y, color: selectedColor, ts: Date.now(), peerId };
      setGrid((g) => apply(g, pixel));
      connection.send({ type: "pixel", ...pixel });
    },
    [selectedColor, peerId, connection]
  );

  const handleCursorMove = useCallback(
    (x: number, y: number) => {
      connection.send({ type: "cursor", x, y, peerId });
    },
    [peerId, connection]
  );

  function handleClearRequest() {
    if (connectionState === "connected") {
      connection.send({ type: "clearRequest", peerId, ts: Date.now() });
      setClearFlow("awaiting-peer");
    } else {
      setClearFlow("confirm-solo");
    }
  }

  function handleClearConfirmSolo() {
    setGrid(createEmptyGrid());
    setClearFlow("idle");
  }

  function handleClearAccept() {
    setGrid(createEmptyGrid());
    connection.send({ type: "clearAccept", peerId, ts: Date.now() });
    setClearFlow("idle");
  }

  function handleClearCancel() {
    setClearFlow("idle");
  }

  return (
    <>
      <header className="app-header">
        <h1>Pixel Canvas สองคน</h1>
        <p>วาด canvas 64×64 กับเพื่อนสด ๆ ผ่าน WebRTC ตรง — ไม่มี server</p>
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
              onCursorMove={handleCursorMove}
              friendCursor={friendCursor}
              heatMode={heatMode}
              myPeerId={peerId}
            />

            {clearFlow === "confirm-solo" && (
              <div className="clear-banner">
                <p>ยืนยันล้างผืนทั้งหมด? การกระทำนี้กู้คืนไม่ได้</p>
                <div className="toolbar-actions">
                  <button type="button" className="btn btn-sm btn-danger" onClick={handleClearConfirmSolo}>
                    ยืนยัน
                  </button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={handleClearCancel}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {clearFlow === "awaiting-peer" && (
              <div className="clear-banner">
                <p>รอเพื่อนกดยอมรับการล้างผืนทั้งหมด...</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={handleClearCancel}>
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
                  <button type="button" className="btn btn-sm btn-outline" onClick={handleClearCancel}>
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
              heatMode={heatMode}
              onToggleHeat={() => setHeatMode((h) => !h)}
              onExport={() => exportGridAsPng(grid, PALETTE)}
              onClearRequest={handleClearRequest}
              clearDisabled={clearFlow !== "idle"}
            />
          </div>

          <div className="workspace-connect panel">
            <h2>เชื่อมต่อกับเพื่อน</h2>
            <ConnectionStepper connection={connection} connectionState={connectionState} role={role} onRoleChange={setRole} />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Pixel Canvas สองคน · ไม่มี server กลาง ภาพวิ่งตรงระหว่างสองเครื่องเท่านั้น</p>
      </footer>
    </>
  );
}
