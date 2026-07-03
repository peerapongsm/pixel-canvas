"use client";

// Renders a QR code for the invite link using the vendored encoder in lib/qr
// (hand-rolled in project-36-qr-explorable — no dependency). Presentation
// only; encoding correctness is tested in the source project.

import { useEffect, useRef } from "react";
import { generateQR } from "@/lib/qr/qrcode";

const MODULE_PX = 4;
const QUIET_ZONE = 4; // modules, per ISO/IEC 18004

export default function QrCode({ text }: { text: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let modules: boolean[][];
    try {
      ({ modules } = generateQR(text, "L"));
    } catch {
      return; // text too long for supported versions; QR box just stays empty
    }
    const size = modules.length + QUIET_ZONE * 2;
    canvas.width = size * MODULE_PX;
    canvas.height = size * MODULE_PX;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a1c2c";
    for (let r = 0; r < modules.length; r++) {
      for (let c = 0; c < modules.length; c++) {
        if (modules[r][c]) {
          ctx.fillRect((c + QUIET_ZONE) * MODULE_PX, (r + QUIET_ZONE) * MODULE_PX, MODULE_PX, MODULE_PX);
        }
      }
    }
  }, [text]);

  return <canvas ref={canvasRef} className="qr-canvas" role="img" aria-label="QR code ลิงก์ชวน" />;
}
