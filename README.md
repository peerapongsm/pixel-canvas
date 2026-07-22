# Pixel Canvas

canvas 64×64 ที่คุณกับเพื่อนวาดด้วยกันสด ๆ ผ่านลิงก์ห้องเดียวกัน สูงสุด 4 คน —
live ops วิ่งผ่าน Supabase Realtime (broadcast + presence), ตัวผืนถูกบันทึกลง
Postgres แบบ debounce ทำให้กลับมาวาดต่อทีหลังได้ ผืนที่ไม่มีใครแตะเกิน 30 วัน
ถูกลบอัตโนมัติ (pg_cron). ดู `/method` ในแอปสำหรับคำอธิบายเต็ม.

(v1/v2 เคยเป็น WebRTC P2P + copy-paste signaling — แทนที่ทั้งชั้นด้วย Supabase
ในเวอร์ชันนี้ ดู git history)

## Dev

```
npm install
npm run dev        # http://localhost:3000/
npm test           # vitest (pure libs + persister + identity)
npm run typecheck
npm run build      # static export -> out/
```

## Stack

Next 15 static export (`output: "export"`), TypeScript, Vitest,
`@supabase/supabase-js`. Shared Supabase free project (Duckduckcare) with
torklon/makruk — pixel objects namespaced `pixel_` / `pixel:`.

## Architecture

- `lib/grid.ts` — 64×64 LWW grid: `apply`/`merge`/`serialize`/`deserialize`, eraser tombstone `-1`. TDD.
- `lib/proto.ts` — wire message encode/decode (`pixel`/`cursor`/`fullSync`/`clearRequest`/`clearAccept`) with validation. TDD.
- `lib/validate.ts`, `lib/undo.ts`, `lib/clearFlow.ts`, `lib/palette.ts` (64), `lib/peerId.ts`, `lib/storage.ts` (localStorage = cache; the Postgres row is the source of truth), `lib/exportPng.ts`.
- `net/identity.ts` — anonymous uuid + nickname + slot tints (per-author heat/cursors). TDD.
- `net/canvas.ts` — `loadGrid` / `ensureRoom` / `makePersister` (debounced full-grid upsert). Debounce TDD.
- `net/room.ts` — Realtime channel `pixel:<roomId>`: op broadcast + presence roster, room-full at 4.
- `net/online-session.ts` — glue: subscribe-buffer → DB seed → LWW drain → live.
- `config/supabase.ts` — client (URL + anon key, public-safe; RLS room-id gate).
- `supabase/schema.sql` — `pixel_canvases` + RLS + `pixel_cleanup` pg_cron (30-day retention).
- `components/CanvasGrid.tsx` — draw/pan/zoom + peer cursors + per-author heat. `components/Lobby.tsx` — room-link create/join.

## Why only some files are TDD'd

ตรรกะที่พังแล้วข้อมูลเพี้ยน (LWW, proto, undo, debounce persister) เทสต์แน่นด้วย
red/green TDD; ชั้น Realtime กับ UI (zoom/pan/canvas) ต้องอาศัย browser จริง —
ยืนยันด้วย e2e headless หลายเบราว์เซอร์แทน (jsdom ไม่มี Realtime/WebSocket จริง).
